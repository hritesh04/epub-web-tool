package main

import (
	"context"
	"log"

	"github.com/hritesh04/epub-web-tool/internal/config"
	"github.com/hritesh04/epub-web-tool/internal/epub"
	"github.com/hritesh04/epub-web-tool/internal/queue/consumer"
	"github.com/hritesh04/epub-web-tool/internal/queue/producer"
	"github.com/hritesh04/epub-web-tool/internal/s3"
)

func main(){
	ctx := context.Background()
	cfg := config.LoadConfig()
	store := s3.NewDownloader(cfg.S3)
	translationReq := consumer.NewTranslationReqConsumer(cfg.Queue)
	chunkPublisher := producer.NewChunkPublisher(cfg.Queue)
	chunker := epub.NewChunker()

	msg, err := translationReq.Consume(ctx)
	if err != nil {
		log.Println("Error consuming from queue:",err)
		return
	}
	
	// check if the msg is already proccessed
	// check db for idenpotency key
	// if already there then ack and return

	file, err := store.Download(ctx,msg.Key)
	if err != nil {
		log.Println("Error downloading object:",err)
	}

	chunks, err := chunker.Chunk(msg.RequestID,file)
	log.Println("Total chunks:",len(chunks))
	if err != nil {
		log.Println("Error chunking epub",file.Name()," error:",err)
		return
	}
	if err := chunkPublisher.PublishFileChunks(ctx,chunks); err != nil {
		log.Println("Error publishing translation chunks:",err)
		return
	}

	// set idenpotency key to db and ack to queue
}