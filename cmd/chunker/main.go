package main

import (
	"context"
	"log"

	"github.com/hritesh04/epub-web-tool/internal/config"
	"github.com/hritesh04/epub-web-tool/internal/db"
	"github.com/hritesh04/epub-web-tool/internal/epub"
	"github.com/hritesh04/epub-web-tool/internal/queue/consumer"
	"github.com/hritesh04/epub-web-tool/internal/queue/producer"
	"github.com/hritesh04/epub-web-tool/internal/repository"
	"github.com/hritesh04/epub-web-tool/internal/s3"
)

func main(){
	ctx := context.Background()
	cfg := config.LoadConfig()
	database,err := db.New(cfg.DB.Url)
	if err != nil {
		log.Println("Error creating db connection:",err)
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
		log.Println("Error consuming from queue:",err)
		return
	}
	
	processed,err := epubRepo.AlreadyProcessed(ctx,data.EpubID); 
	if err != nil {
		log.Println("Error checking if translation request is proccessed for epub:",data.EpubID)
		msg.Requeue(ctx)
		return
	}

	log.Println("Processed ?",processed)

	if processed {
		msg.Accept(ctx)
		return
	}

	file, err := downloader.Download(ctx,data.Key)
	if err != nil {
		log.Println("Error downloading object:",err)
	}

	chunks, err := chunker.Chunk(ctx,file,data)
	log.Println("Total chunks:",len(chunks))
	if err != nil {
		log.Println("Error chunking epub",file.Name()," error:",err)
		return
	}

	if err := epubRepo.UpdateChunkCount(ctx,data.EpubID,len(chunks)); err != nil {
		log.Println("Error updating chunk count:",err)
		return
	}

	if err := chunkPublisher.PublishFileChunks(ctx,chunks); err != nil {
		log.Println("Error publishing translation chunks:",err)
		return
	}
	msg.Accept(ctx)
}