package main

import (
	"context"

	"os"

	"github.com/hritesh04/epub-web-tool/internal/config"
	"github.com/hritesh04/epub-web-tool/internal/db"
	"github.com/hritesh04/epub-web-tool/internal/epub"
	"github.com/hritesh04/epub-web-tool/internal/queue/consumer"
	"github.com/hritesh04/epub-web-tool/internal/queue/producer"
	"github.com/hritesh04/epub-web-tool/internal/repository"
	"github.com/hritesh04/epub-web-tool/internal/s3"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main(){
	ctx := context.Background()
	cfg := config.LoadConfig()

	// Configure zerolog
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	if cfg.Env == "development" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	}

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