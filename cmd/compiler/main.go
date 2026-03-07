package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/hritesh04/epub-web-tool/internal/config"
	"github.com/hritesh04/epub-web-tool/internal/db"
	"github.com/hritesh04/epub-web-tool/internal/epub"
	"github.com/hritesh04/epub-web-tool/internal/queue/consumer"
	"github.com/hritesh04/epub-web-tool/internal/repository"
	"github.com/hritesh04/epub-web-tool/internal/s3"
	"github.com/jackc/pgx/v5"
)

func main(){
	ctx := context.Background()
	cfg := config.LoadConfig()

	// Configure zerolog
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	if cfg.Env == "development" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	}

	database, err := db.New(cfg.DB.Url)
	if err != nil {
		log.Fatal().Err(err).Msg("Error creating db connection")
	}
	downloder := s3.NewDownloader(cfg.S3)
	uploader := s3.NewUploader(cfg.S3)
	remover := s3.NewObjectRemover(cfg.S3)
	zipQueue:= consumer.NewRabbitMQZipReqConsumer(cfg.Queue)
	epubRepo := repository.NewEpubRepository(database)
	compiler := epub.NewCompiler(downloder)

	msg,data,err := zipQueue.Consume(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Error consuming from queue")
		return
	}
	info, err := epubRepo.AlreadyCompiling(ctx,data.EpubID)
	if err != nil {
		if err == pgx.ErrNoRows {
			log.Warn().Err(err).Msg("Error checking epub compilation status: no rows found")
			return 
		}
		log.Error().Err(err).Str("epub_id", data.EpubID).Msg("Error checking if compiling request is processed")
		msg.Requeue(ctx)
		return
	}
	log.Info().Str("object_key", info.ObjectKey).Msg("Compiling object")

	if info.ObjectKey == "" {
		msg.Accept(ctx)
		return
	}

	file, err := downloder.Download(ctx,info.ObjectKey)
	if err != nil {
		log.Error().Err(err).Str("object_key", info.ObjectKey).Msg("Error downloading object")
		msg.Requeue(ctx)
		return
	}

	stats, err := file.Stat()
	if err != nil {
		log.Error().Err(err).Msg("Error getting file stats")
		msg.Requeue(ctx)
		return
	}

	epubName := strings.TrimSuffix(stats.Name(), filepath.Ext(stats.Name()))
	extractPath := filepath.Join(os.TempDir(), epubName)

	keys, err := compiler.Unzip(info.Id,filepath.Join(os.TempDir(),stats.Name()), extractPath)
	if err != nil {
		log.Error().Err(err).Msg("Error unzipping epub")
		msg.Requeue(ctx)
		return
	}
	file.Close()
	if err := downloder.DownloadTranslatedChunks(ctx,info.Id,extractPath);err != nil {
		log.Error().Err(err).Msg("Error downloading translated chunks")
	}

	newEpub := filepath.Join(os.TempDir(),epubName+"_translated.epub")

	log.Info().Str("path", newEpub).Msg("Creating new translated epub")

	if err := compiler.ZipToEpub(extractPath,newEpub);err != nil {
		log.Error().Err(err).Msg("Error zipping translated chunks")
		msg.Requeue(ctx)
		return
	}
	newEpubFile, err := os.Open(newEpub)
	if err != nil {
		log.Error().Err(err).Msg("Error opening new epub file")
		msg.Requeue(ctx)
		return
	}
	log.Info().Str("path", newEpub).Msg("Uploading new translated epub")
	if err := uploader.UploadFile(ctx,info.ObjectKey,newEpubFile); err != nil {
		log.Error().Err(err).Msg("Error uploading new epub")
		msg.Requeue(ctx)
		return
	}
	newEpubFile.Close()
	if err := remover.RemoveChunksAndTranslatedChunks(ctx,keys); err != nil {
		log.Error().Err(err).Msg("Error removing chunks and translated chunks")
		msg.Requeue(ctx)
		return
	}
	log.Info().Str("path", newEpub).Msg("Removing translated epub")
	if err := os.Remove(newEpub);err != nil {
		log.Error().Err(err).Msg("Error removing translated epub")
		msg.Requeue(ctx)
	}
	if err := epubRepo.UpdateStatus(ctx,info.Id,"completed"); err != nil {
		log.Error().Err(err).Msg("Error updating epub status")
	}
	msg.Accept(ctx)
}