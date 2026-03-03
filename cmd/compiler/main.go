package main

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"strings"

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
	database, err := db.New(cfg.DB.Url)
	if err != nil {
		log.Println("Error creating db connection:",err)
	}
	downloder := s3.NewDownloader(cfg.S3)
	uploader := s3.NewUploader(cfg.S3)
	remover := s3.NewObjectRemover(cfg.S3)
	zipQueue:= consumer.NewRabbitMQZipReqConsumer(cfg.Queue)
	epubRepo := repository.NewEpubRepository(database)
	compiler := epub.NewCompiler(downloder)

	msg,data,err := zipQueue.Consume(ctx)
	if err != nil {
		log.Println("Error consuming from queue:",err)
		return
	}
	info, err := epubRepo.AlreadyCompiling(ctx,data.EpubID)
	if err != nil {
		if err == pgx.ErrNoRows {
			log.Println("Error checking epub compilation status no rows found:",err)
			return 
		}
		log.Println("Error checking if compiling request is proccessed for epub:",data.EpubID,"error:",err)
		msg.Requeue(ctx)
		return
	}
	log.Println("Compiling object key:",*info.ObjectKey)

	if info.ObjectKey == nil {
		msg.Accept(ctx)
		return
	}

	file, err := downloder.Download(ctx,*info.ObjectKey)
	if err != nil {
		log.Println("Error downloading object:",*info.ObjectKey,"error",err)
		msg.Requeue(ctx)
		return
	}

	stats, err := file.Stat()
	if err != nil {
		log.Println("Error getting file stats:", err)
		msg.Requeue(ctx)
		return
	}

	epubName := strings.TrimSuffix(stats.Name(), filepath.Ext(stats.Name()))
	extractPath := filepath.Join(os.TempDir(), epubName)

	keys, err := compiler.Unzip(info.Id,filepath.Join(os.TempDir(),stats.Name()), extractPath)
	if err != nil {
		log.Println("Error unzipping epub:", err)
		msg.Requeue(ctx)
		return
	}
	file.Close()
	if err := downloder.DownloadTranslatedChunks(ctx,info.Id,extractPath);err != nil {
		log.Println("Error downloading translated chunks:",err)
	}

	newEpub := filepath.Join(os.TempDir(),epubName+"_translated.epub")

	log.Println("Creating new translated epub:",newEpub)

	if err := compiler.ZipToEpub(extractPath,newEpub);err != nil {
		log.Println("Error ziping translated chunks:",err)
		msg.Requeue(ctx)
		return
	}
	newEpubFile, err := os.Open(newEpub)
	if err != nil {
		log.Println("Error opening new epub file",err)
		msg.Requeue(ctx)
		return
	}
	log.Println("Uploading new translated epub:",newEpub)
	if err := uploader.UploadFile(ctx,*info.ObjectKey,newEpubFile); err != nil {
		log.Println("Error uploading new epub:",err)
		msg.Requeue(ctx)
		return
	}
	newEpubFile.Close()
	if err := remover.RemoveChunksAndTranslatedChunks(ctx,keys); err != nil {
		log.Println("Error removing chunks and translated chunks:",err)
		msg.Requeue(ctx)
		return
	}
	log.Println("Removing translated epub:",newEpub)
	if err := os.Remove(newEpub);err != nil {
		log.Println("Error removing translated epub:",err)
		msg.Requeue(ctx)
	}
	if err := epubRepo.UpdateStatus(ctx,info.Id,"completed"); err != nil {
		log.Println("Error updating epub status:",err)
	}
	msg.Accept(ctx)
}