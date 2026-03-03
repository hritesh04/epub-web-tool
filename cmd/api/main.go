package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hritesh04/epub-web-tool/internal/config"
	"github.com/hritesh04/epub-web-tool/internal/db"
	"github.com/hritesh04/epub-web-tool/internal/handler"
	"github.com/hritesh04/epub-web-tool/internal/queue/producer"
	"github.com/hritesh04/epub-web-tool/internal/repository"
	"github.com/hritesh04/epub-web-tool/internal/s3"
	"github.com/hritesh04/epub-web-tool/internal/utils"
)

func requestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		uuid := uuid.New()
		c.Writer.Header().Set("X-Request-Id", uuid.String())
		c.Next()
	}
}

func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        authorizationToken,err := c.Cookie("epub-tool-access-token")
        if err != nil {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
            return
        }

        token, err := utils.ValidateAccessToken(authorizationToken)
        if err != nil || token.ExpiresAt.Compare(time.Now()) == -1 {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
            return
        }

        c.Set("userID", token.UserID)
        c.Next()
    }
}

func main() {
	cfg := config.LoadConfig()
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "DELETE"},
		AllowHeaders:     []string{"Origin", "Content-Type"},
		AllowCredentials: true,
	}))
	r.Use(requestIDMiddleware())

	database,err := db.New(cfg.DB.Url)
	if err != nil {
		log.Fatalln("Error creating db connection:",err)
	}
	defer database.Close()

	userRepo := repository.NewUserRepository(database)
	epubRepo := repository.NewEpubRepository(database)
	chunkRepo := repository.NewChunkRepository(database)

	store := s3.NewPresignUploadS3Client(cfg.S3)
	publisher := producer.NewTranslationRequestPublisher(cfg.Queue)
	user := handler.NewUserHandler(userRepo)
	epub := handler.NewEpubHandler(epubRepo,store,publisher)
	chunk := handler.NewChunkHandler(chunkRepo,epubRepo)

	r.POST("/signin",user.SignIn)
	r.POST("/signup",user.SignUp)
	r.GET("/refresh",user.Refresh)
	r.Use(AuthMiddleware())
	r.GET("/epubs",epub.GetUserEpub)
	r.DELETE("/epub/:id",epub.DeleteEpub)
	r.GET("/upload", epub.GetPresignPostURL)
	r.POST("/upload/:id", epub.FinishUpload)
	r.GET("/progress/:id",chunk.Progress)
	r.GET("/download/:id",epub.GetPresignTranslatedEpubLink)
	port := os.Getenv("PORT")
	r.Run(":"+port)
}
