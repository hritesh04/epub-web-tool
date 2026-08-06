package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/rs/zerolog/pkgerrors"

	"github.com/hritesh04/epub-web-tool/internal/config"
	"github.com/hritesh04/epub-web-tool/internal/db"
	"github.com/hritesh04/epub-web-tool/internal/epub"
	"github.com/hritesh04/epub-web-tool/internal/otel"
	"github.com/hritesh04/epub-web-tool/internal/queue/consumer"
	"github.com/hritesh04/epub-web-tool/internal/repository"
	"github.com/hritesh04/epub-web-tool/internal/s3"
	"github.com/jackc/pgx/v5"
	"go.opentelemetry.io/contrib/instrumentation/runtime"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

func main() {
	ctx := context.Background()
	cfg := config.LoadConfig()

	// Configure zerolog
	zerolog.TimeFieldFormat = time.RFC3339Nano
	zerolog.ErrorStackMarshaler = pkgerrors.MarshalStack
	if cfg.Env == "development" {
		log.Logger = log.Output(zerolog.MultiLevelWriter(zerolog.ConsoleWriter{Out: os.Stdout}, otel.NewZerologWriter())).With().Timestamp().Caller().Logger()
	} else {
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
		log.Logger = log.Output(otel.NewZerologWriter()).With().Timestamp().Caller().Logger()
	}

	otelShutdown, err := otel.InitOTel(ctx, cfg.OpenObserve, "epub-web-tool-compiler")
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize OTel")
	}
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := otelShutdown(shutdownCtx); err != nil {
			log.Error().Err(err).Msg("Error shutting down OTel")
		}
	}()

	if err := otel.InitMetrics("epub-web-tool-compiler"); err != nil {
		log.Error().Err(err).Msg("Failed to initialize metrics")
	}

	if err := runtime.Start(runtime.WithMinimumReadMemStatsInterval(15 * time.Second)); err != nil {
		log.Error().Err(err).Msg("Failed to start runtime metrics")
	}

	database, err := db.New(cfg.DB.Url)
	if err != nil {
		log.Fatal().Err(err).Msg("Error creating db connection")
	}
	downloder := s3.NewDownloader(cfg.S3)
	uploader := s3.NewUploader(cfg.S3)
	remover := s3.NewObjectRemover(cfg.S3)
	zipQueue := consumer.NewRabbitMQZipReqConsumer(cfg.Queue)
	epubRepo := repository.NewEpubRepository(database)
	compiler := epub.NewCompiler(downloder)

	msg, data, err := zipQueue.Consume(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Error consuming from queue")
		return
	}

	// Rebuild the parent trace context propagated from the translator producer
	// and start this service's consumer span under it.
	ctx = otel.ContextFromTraceParent(ctx, data.TraceParent, data.TraceState)
	ctx, span := otel.Tracer("compiler").Start(ctx, "zip.consume",
		trace.WithSpanKind(trace.SpanKindConsumer),
		trace.WithAttributes(
			attribute.String("messaging.system", "rabbitmq"),
			attribute.String("messaging.operation", "process"),
			attribute.String("epub.id", data.EpubID),
		))
	defer func() {
		span.End()
	}()
	logger := otel.TraceLogger(ctx)
	otel.RecordQueueConsumed(ctx, cfg.Queue.ZipQueue, attribute.String("epub.id", data.EpubID))

	info, err := epubRepo.AlreadyCompiling(ctx, data.EpubID)
	if err != nil {
		if err == pgx.ErrNoRows {
			logger.Warn().Err(err).Msg("Error checking epub compilation status: no rows found")
			return
		}
		otel.RecordError(ctx, err)
		logger.Error().Err(err).Str("epub_id", data.EpubID).Msg("Error checking if compiling request is processed")
		msg.Requeue(ctx)
		return
	}
	logger.Info().Str("object_key", info.ObjectKey).Msg("Compiling object")

	if info.ObjectKey == "" {
		msg.Accept(ctx)
		return
	}

	start := time.Now()
	file, err := downloder.Download(ctx, info.ObjectKey)
	otel.RecordPipelineDuration(ctx, "compiler", "download", time.Since(start).Seconds(), attribute.String("epub.id", data.EpubID))
	if err != nil {
		otel.RecordError(ctx, err)
		logger.Error().Err(err).Str("object_key", info.ObjectKey).Msg("Error downloading object")
		msg.Requeue(ctx)
		return
	}

	stats, err := file.Stat()
	if err != nil {
		otel.RecordError(ctx, err)
		logger.Error().Err(err).Msg("Error getting file stats")
		msg.Requeue(ctx)
		return
	}

	epubName := strings.TrimSuffix(stats.Name(), filepath.Ext(stats.Name()))
	extractPath := filepath.Join(os.TempDir(), epubName)

	start = time.Now()
	keys, err := compiler.Unzip(ctx, info.Id, filepath.Join(os.TempDir(), stats.Name()), extractPath)
	otel.RecordPipelineDuration(ctx, "compiler", "unzip", time.Since(start).Seconds(), attribute.String("epub.id", data.EpubID))
	if err != nil {
		otel.RecordError(ctx, err)
		logger.Error().Err(err).Msg("Error unzipping epub")
		msg.Requeue(ctx)
		return
	}
	file.Close()
	start = time.Now()
	if err := downloder.DownloadTranslatedChunks(ctx, info.Id, extractPath); err != nil {
		otel.RecordError(ctx, err)
		logger.Error().Err(err).Msg("Error downloading translated chunks")
	}
	otel.RecordPipelineDuration(ctx, "compiler", "download_chunks", time.Since(start).Seconds(), attribute.String("epub.id", data.EpubID))

	newEpub := filepath.Join(os.TempDir(), epubName+"_translated.epub")

	logger.Info().Str("path", newEpub).Msg("Creating new translated epub")

	start = time.Now()
	if err := compiler.ZipToEpub(ctx, extractPath, newEpub); err != nil {
		otel.RecordError(ctx, err)
		logger.Error().Err(err).Msg("Error zipping translated chunks")
		msg.Requeue(ctx)
		return
	}
	otel.RecordPipelineDuration(ctx, "compiler", "zip", time.Since(start).Seconds(), attribute.String("epub.id", data.EpubID))

	newEpubFile, err := os.Open(newEpub)
	if err != nil {
		otel.RecordError(ctx, err)
		logger.Error().Err(err).Msg("Error opening new epub file")
		msg.Requeue(ctx)
		return
	}
	logger.Info().Str("path", newEpub).Msg("Uploading new translated epub")
	start = time.Now()
	if err := uploader.UploadFile(ctx, info.ObjectKey, newEpubFile); err != nil {
		otel.RecordError(ctx, err)
		logger.Error().Err(err).Msg("Error uploading new epub")
		msg.Requeue(ctx)
		return
	}
	otel.RecordPipelineDuration(ctx, "compiler", "upload", time.Since(start).Seconds(), attribute.String("epub.id", data.EpubID))
	newEpubFile.Close()
	start = time.Now()
	if err := remover.RemoveChunksAndTranslatedChunks(ctx, keys); err != nil {
		otel.RecordError(ctx, err)
		logger.Error().Err(err).Msg("Error removing chunks and translated chunks")
		msg.Requeue(ctx)
		return
	}
	otel.RecordPipelineDuration(ctx, "compiler", "cleanup", time.Since(start).Seconds(), attribute.String("epub.id", data.EpubID))
	logger.Info().Str("path", newEpub).Msg("Removing translated epub")
	if err := os.Remove(newEpub); err != nil {
		logger.Error().Err(err).Msg("Error removing translated epub")
	}
	if err := epubRepo.UpdateStatus(ctx, info.Id, "completed"); err != nil {
		logger.Error().Err(err).Msg("Error updating epub status")
	}
	msg.Accept(ctx)
}