package main

import (
	"context"
	"os"
	"time"

	"github.com/hritesh04/epub-web-tool/internal/config"
	"github.com/hritesh04/epub-web-tool/internal/db"
	"github.com/hritesh04/epub-web-tool/internal/drive"
	"github.com/hritesh04/epub-web-tool/internal/epub"
	"github.com/hritesh04/epub-web-tool/internal/otel"
	"github.com/hritesh04/epub-web-tool/internal/queue"
	"github.com/hritesh04/epub-web-tool/internal/queue/consumer"
	"github.com/hritesh04/epub-web-tool/internal/queue/producer"
	"github.com/hritesh04/epub-web-tool/internal/repository"
	"github.com/hritesh04/epub-web-tool/internal/s3"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/rs/zerolog/pkgerrors"
)

func main() {
	ctx := context.Background()
	cfg := config.LoadConfig()

	// Configure zerolog
	zerolog.TimeFieldFormat = time.RFC3339Nano
	zerolog.ErrorStackMarshaler = pkgerrors.MarshalStack
	if cfg.Env == "development" {
		log.Logger = log.Output(zerolog.MultiLevelWriter(zerolog.ConsoleWriter{Out: os.Stdout}, otel.NewZerologWriter()))
	} else {
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
		log.Logger = log.Output(otel.NewZerologWriter())
	}

	shutdown, err := otel.InitLogger(ctx, cfg.OpenObserve, "epub-web-tool-chunker")
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize OTel")
	}
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := shutdown(shutdownCtx); err != nil {
			log.Error().Err(err).Msg("Error shutting down OTel")
		}
	}()

	database, err := db.New(cfg.DB.Url)
	if err != nil {
		log.Fatal().Err(err).Msg("Error creating db connection")
	}
	chunkRepo := repository.NewChunkRepository(database)
	epubRepo := repository.NewEpubRepository(database)
	downloader := s3.NewDownloader(cfg.S3)
	uploader := s3.NewUploader(cfg.S3)
	driveService, err := drive.NewService(cfg.Google.DriveAPIKey)
	if err != nil {
		log.Warn().Err(err).Msg("Google Drive import will be unavailable")
	}
	translationReq := consumer.NewTranslationReqConsumer(cfg.Queue)
	chunkPublisher := producer.NewChunkPublisher(cfg.Queue)
	chunker := epub.NewChunker(chunkRepo, uploader)

	msg, data, err := translationReq.Consume(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Error consuming from queue")
		return
	}

	processed, err := epubRepo.AlreadyProcessed(ctx, data.EpubID)
	if err != nil {
		log.Error().Err(err).Str("epub_id", data.EpubID).Msg("Error checking if translation request is processed")
		msg.Requeue(ctx)
		return
	}

	log.Info().Bool("processed", processed).Msg("Processed status")

	if processed {
		msg.Accept(ctx)
		return
	}

	file, err := downloadSourceFile(ctx, data, downloader, driveService)
	if err != nil {
		log.Error().Err(err).Str("key", data.Key).Str("source", data.Source).Msg("Error downloading source file")
		msg.Requeue(ctx)
		return
	}

	chunks, err := chunker.Chunk(ctx, file, data)
	log.Info().Int("total_chunks", len(chunks)).Msg("Chunking result")
	if err != nil {
		log.Error().Err(err).Str("file", file.Name()).Msg("Error chunking epub")
		msg.Requeue(ctx)
		return
	}

	if len(chunks) == 0 {
		msg.Accept(ctx)
		log.Info().Str("file", file.Name()).Msg("No chunks found")
		epubRepo.UpdateStatus(ctx, data.EpubID, "finished")
		return
	}

	if err := epubRepo.UpdateChunkCount(ctx, data.EpubID, len(chunks)); err != nil {
		log.Error().Err(err).Msg("Error updating chunk count")
		msg.Requeue(ctx)
		return
	}

	if err := chunkPublisher.PublishFileChunks(ctx, chunks); err != nil {
		log.Error().Err(err).Msg("Error publishing translation chunks")
		msg.Requeue(ctx)
		return
	}
	msg.Accept(ctx)
}

func downloadSourceFile(ctx context.Context, data queue.TranslationMsg, downloader *s3.S3Downloader, driveService *drive.Service) (*os.File, error) {
	if data.Source != "gdrive" {
		return downloader.Download(ctx, data.Key)
	}

	fileID, err := drive.ExtractFileID(data.DriveLink)
	if err != nil {
		return nil, err
	}
	file, err := driveService.Download(ctx, fileID, drive.MaxSize)
	if err != nil {
		return nil, err
	}
	return file, nil
}
