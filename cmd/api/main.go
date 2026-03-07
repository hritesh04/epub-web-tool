package main

import (
	"context"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/hritesh04/epub-web-tool/internal/config"
	"github.com/hritesh04/epub-web-tool/internal/db"
	"github.com/hritesh04/epub-web-tool/internal/handler"
	"github.com/hritesh04/epub-web-tool/internal/middleware"
	"github.com/hritesh04/epub-web-tool/internal/otel"
	"github.com/hritesh04/epub-web-tool/internal/queue/producer"
	"github.com/hritesh04/epub-web-tool/internal/repository"
	"github.com/hritesh04/epub-web-tool/internal/s3"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/rs/zerolog/pkgerrors"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg := config.LoadConfig()

	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	zerolog.ErrorStackMarshaler = pkgerrors.MarshalStack
	if cfg.Env == "development" {
		log.Logger = log.Output(zerolog.MultiLevelWriter(zerolog.ConsoleWriter{Out: os.Stdout}, otel.NewZerologWriter()))
	} else {
		log.Logger = log.Output(otel.NewZerologWriter())
	}

	// Initialize OTel for Traces, Metrics, and Logs
	otelShutdown, err := otel.InitOTel(ctx, cfg.OpenObserve)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize OTel")
	}
	defer func() {
		if err := otelShutdown(context.Background()); err != nil {
			log.Error().Err(err).Msg("Error shutting down OTel")
		}
	}()

	// Initialize custom metrics
	if err := otel.InitMetrics(); err != nil {
		log.Error().Err(err).Msg("Failed to initialize metrics")
	}

	r := gin.New()
	r.Use(otelgin.Middleware("epub-web-tool"))
	r.Use(otel.GinMiddleware())
	r.Use(middleware.RequestID())
	r.Use(middleware.Logger())
	r.Use(gin.Recovery())

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173","https://epub.acerowl.tech"},
		AllowMethods:     []string{"GET", "POST", "DELETE"},
		AllowHeaders:     []string{"Origin", "Content-Type"},
		AllowCredentials: true,
	}))

	database, err := db.New(cfg.DB.Url)
	if err != nil {
		log.Fatal().Err(err).Msg("Error creating db connection")
	}
	defer database.Close()

	userRepo := repository.NewUserRepository(database)
	epubRepo := repository.NewEpubRepository(database)
	chunkRepo := repository.NewChunkRepository(database)

	store := s3.NewPresignUploadS3Client(cfg.S3)
	publisher := producer.NewTranslationRequestPublisher(cfg.Queue)
	user := handler.NewUserHandler(userRepo)
	epub := handler.NewEpubHandler(epubRepo, store, publisher)
	chunk := handler.NewChunkHandler(chunkRepo, epubRepo)

	r.POST("/signin", user.SignIn)
	r.POST("/signup", user.SignUp)
	r.GET("/refresh", user.Refresh)
	r.Use(middleware.Auth())
	r.POST("/signout", user.SignOut)
	r.GET("/auth", user.Auth)
	r.GET("/epubs", epub.GetUserEpub)
	r.DELETE("/epub/:id", epub.DeleteEpub)
	r.GET("/upload", epub.GetPresignPostURL)
	r.POST("/upload/:id", epub.FinishUpload)
	r.GET("/progress/:id", chunk.Progress)
	r.GET("/download/:id", epub.GetPresignTranslatedEpubLink)

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r.Handler(),
	}

	go func() {
		log.Info().Msg("Server started on port " + cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Error starting server")
		}
	}()

	<-ctx.Done()
	log.Info().Msg("Shutting down server...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatal().Err(err).Msg("Error shutting down server")
	}
	log.Info().Msg("Server stopped")
}
