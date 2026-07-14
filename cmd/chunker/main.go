package main

import (
	"context"
	"time"

	"os"

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
)

func main(){
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
	
	shutdown, err := otel.InitLogger(ctx,cfg.OpenObserve,"epub-web-tool-chunker")
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

	database,err := db.New(cfg.DB.Url)
	if err != nil {
		log.Fatal().Err(err).Msg("Error creating db connection")
	}
	chunkRepo := repository.NewChunkRepository(database)
	epubRepo := repository.NewEpubRepository(database)
	downloader := s3.NewDownloader(cfg.S3)
	uploader := s3.NewUploader(cfg.S3)
	translationReq := consumer.NewTranslationReqConsumer(cfg.Queue)
	chunkPublisher := producer.NewChunkPublisher(cfg.Queue)
	chunker := epub.NewChunker(chunkRepo,uploader)

	msg, data, err := translationReq.Consume(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Error consuming from queue")
		return
	}
	
	processed,err := epubRepo.AlreadyProcessed(ctx,data.EpubID); 
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

	file, err := downloader.Download(ctx,data.Key)
	if err != nil {
		log.Error().Err(err).Str("key", data.Key).Msg("Error downloading object")
		msg.Requeue(ctx)
		return
	}

	chunks, err := chunker.Chunk(ctx,file,data)
	log.Info().Int("total_chunks", len(chunks)).Msg("Chunking result")
	if err != nil {
		log.Error().Err(err).Str("file", file.Name()).Msg("Error chunking epub")
		msg.Requeue(ctx)
		return
	}

	if len(chunks) == 0 {
		msg.Accept(ctx)
		log.Info().Str("file", file.Name()).Msg("No chunks found")
		epubRepo.UpdateStatus(ctx,data.EpubID,"finished")
		return
	}

	if err := epubRepo.UpdateChunkCount(ctx,data.EpubID,len(chunks)); err != nil {
		log.Error().Err(err).Msg("Error updating chunk count")
		msg.Requeue(ctx)
		return
	}

	if err := chunkPublisher.PublishFileChunks(ctx,chunks); err != nil {
		log.Error().Err(err).Msg("Error publishing translation chunks")
		msg.Requeue(ctx)
		return
	}
	msg.Accept(ctx)
}