package s3

import (
	"context"
	"io"
	"log"
	"sync"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/transfermanager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/hritesh04/epub-web-tool/internal/config"
)

type ChunkObject struct {
	Key string
	Reader io.Reader
}

type S3Uploader struct {
	s3      *s3.Client
	cfg config.S3
}

func NewUploader(cfg config.S3) *S3Uploader{
	client := s3.New(s3.Options{
		BaseEndpoint: &cfg.Endpoint,
		Region: cfg.Region,
		Credentials: aws.NewCredentialsCache(
			credentials.NewStaticCredentialsProvider(
				cfg.Key,
				cfg.Password,
				"",
			),
		),
		UsePathStyle: true,
	})
	return &S3Uploader{
		s3: client,
		cfg: cfg,
	}
}

func (s *S3Uploader) UploadFile(ctx context.Context,key string,body io.Reader)(error){
	uploader := transfermanager.New(s.s3, func(o *transfermanager.Options) {
		o.PartSizeBytes=10*1024*1024
		o.Concurrency=5
	})
	_, err := uploader.UploadObject(ctx,&transfermanager.UploadObjectInput{
		Bucket: &s.cfg.EpubBucket,
		Key: aws.String(key),
		Body: body,
	})
	if err != nil {
		return err
	}
	return nil
}

func (s *S3Uploader) UploadConcurently(ctx context.Context) (chan ChunkObject,*sync.WaitGroup) {
	var wg sync.WaitGroup
	channel := make(chan ChunkObject,5)
	for range 5{
		go func(){
			defer wg.Done()
			for chItem := range channel {
				item := chItem
				log.Println(item)
				_, err := s.s3.PutObject(ctx,&s3.PutObjectInput{Key: &item.Key,Bucket:&s.cfg.ChunkBucket,Body:item.Reader})
				if err != nil {
					log.Println("Error uploading chunk to s3:",err)
				}
			}
		}()
		wg.Add(1)
	}
	return channel,&wg
}