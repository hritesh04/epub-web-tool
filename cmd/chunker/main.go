package main

import (
	"context"
	"os"
	"time"

	"github.com/hritesh04/epub-web-tool/internal/config"
	"github.com/hritesh04/epub-web-tool/internal/db"
	"github.com/hritesh04/epub-web-tool/internal/epub"
	"github.com/hritesh04/epub-web-tool/internal/otel"
	"github.com/hritesh04/epub-web-tool/internal/queue/consumer"
	"github.com/hritesh04/epub-web-tool/internal/queue/producer"
	"github.com/hritesh04/epub-web-tool/internal/repository"
	"github.com/hritesh04/epub-web-tool/internal/s3"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/rs/zerolog/pkgerrors"
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

	otelShutdown, err := otel.InitOTel(ctx, cfg.OpenObserve, "epub-web-tool-chunker")
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

	if err := otel.InitMetrics("epub-web-tool-chunker"); err != nil {
		log.Error().Err(err).Msg("Failed to initialize metrics")
	}

	if err := runtime.Start(runtime.WithMinimumReadMemStatsInterval(15 * time.Second)); err != nil {
		log.Error().Err(err).Msg("Failed to start runtime metrics")
	}

	database, err := db.New(cfg.DB.Url)
	if err != nil {
		log.Fatal().Err(err).Msg("Error creating db connection")
	}
	chunkRepo := repository.NewChunkRepository(database)
	epubRepo := repository.NewEpubRepository(database)
	downloader := s3.NewDownloader(cfg.S3)
	uploader := s3.NewUploader(cfg.S3)
	translationReq := consumer.NewTranslationReqConsumer(cfg.Queue)
	chunkPublisher := producer.NewChunkPublisher(cfg.Queue)
	chunker := epub.NewChunker(chunkRepo, uploader)

	msg, data, err := translationReq.Consume(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Error consuming from queue")
		return
	}

	// Rebuild the parent trace context propagated from the API publisher and
	// start this service's consumer span under it.
	ctx = otel.ContextFromTraceParent(ctx, data.TraceParent, data.TraceState)
	ctx, span := otel.Tracer("chunker").Start(ctx, "translation.consume",
		trace.WithSpanKind(trace.SpanKindConsumer),
		trace.WithAttributes(
			attribute.String("messaging.system", "rabbitmq"),
			attribute.String("messaging.operation", "process"),
			attribute.String("epub.id", data.EpubID),
			attribute.String("s3.key", data.Key),
			attribute.String("translate.to", data.TranslateTo),
		))
	defer func() {
		span.End()
	}()
	logger := otel.TraceLogger(ctx)
	otel.RecordQueueConsumed(ctx, cfg.Queue.ChunkerQueue, attribute.String("epub.id", data.EpubID))

	processed, err := epubRepo.AlreadyProcessed(ctx, data.EpubID)
	if err != nil {
		otel.RecordError(ctx, err)
		logger.Error().Err(err).Str("epub_id", data.EpubID).Msg("Error checking if translation request is processed")
		msg.Requeue(ctx)
		return
	}

	logger.Info().Bool("processed", processed).Msg("Processed status")

	if processed {
		msg.Accept(ctx)
		return
	}

	start := time.Now()
	file, err := downloader.Download(ctx, data.Key)
	otel.RecordPipelineDuration(ctx, "chunker", "download", time.Since(start).Seconds(), attribute.String("epub.id", data.EpubID))
	if err != nil {
		otel.RecordError(ctx, err)
		logger.Error().Err(err).Str("key", data.Key).Msg("Error downloading object")
		msg.Requeue(ctx)
		return
	}

	start = time.Now()
	chunks, err := chunker.Chunk(ctx, file, data)
	otel.RecordPipelineDuration(ctx, "chunker", "chunk", time.Since(start).Seconds(), attribute.String("epub.id", data.EpubID))
	logger.Info().Int("total_chunks", len(chunks)).Msg("Chunking result")
	if err != nil {
		otel.RecordError(ctx, err)
		logger.Error().Err(err).Str("file", file.Name()).Msg("Error chunking epub")
		msg.Requeue(ctx)
		return
	}

	if len(chunks) == 0 {
		msg.Accept(ctx)
		logger.Info().Str("file", file.Name()).Msg("No chunks found")
		epubRepo.UpdateStatus(ctx, data.EpubID, "finished")
		return
	}

	if err := epubRepo.UpdateChunkCount(ctx, data.EpubID, len(chunks)); err != nil {
		otel.RecordError(ctx, err)
		logger.Error().Err(err).Msg("Error updating chunk count")
		msg.Requeue(ctx)
		return
	}

	start = time.Now()
	if err := chunkPublisher.PublishFileChunks(ctx, chunks); err != nil {
		otel.RecordError(ctx, err)
		logger.Error().Err(err).Msg("Error publishing translation chunks")
		msg.Requeue(ctx)
		return
	}
	otel.RecordPipelineDuration(ctx, "chunker", "publish", time.Since(start).Seconds(), attribute.String("epub.id", data.EpubID))
	msg.Accept(ctx)
}