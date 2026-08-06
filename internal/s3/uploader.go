package s3

import (
	"context"
	"io"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/transfermanager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/hritesh04/epub-web-tool/internal/config"
	"github.com/hritesh04/epub-web-tool/internal/otel"
	"go.opentelemetry.io/contrib/instrumentation/github.com/aws/aws-sdk-go-v2/otelaws"
	"go.opentelemetry.io/otel/attribute"
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
	client := s3.NewFromConfig(aws.Config{
		BaseEndpoint: &cfg.Endpoint,
		Region: cfg.Region,
		Credentials: aws.NewCredentialsCache(
			credentials.NewStaticCredentialsProvider(
				cfg.Key,
				cfg.Password,
				"",
			),
		),
	},func(o *s3.Options) {
		o.UsePathStyle=true
		otelaws.AppendMiddlewares(&o.APIOptions)
		ignoreSigningHeaders(o, []string{"Accept-Encoding"})
	})
	return &S3Uploader{
		s3: client,
		cfg: cfg,
	}
}

func (s *S3Uploader) UploadFile(ctx context.Context,key string,body io.Reader)(error){
	start := time.Now()
	defer func() {
		otel.RecordS3Operation(ctx, "S3.UploadObject", time.Since(start).Seconds(),
			attribute.String("bucket", s.cfg.EpubBucket),
			attribute.String("s3.key", key))
	}()

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
				log.Debug().Str("key", item.Key).Msg("Uploading chunk")
				start := time.Now()
				_, err := s.s3.PutObject(ctx,&s3.PutObjectInput{Key: &item.Key,Bucket:&s.cfg.ChunkBucket,Body:item.Reader})
				otel.RecordS3Operation(ctx, "S3.PutObject", time.Since(start).Seconds(),
					attribute.String("bucket", s.cfg.ChunkBucket),
					attribute.String("s3.key", item.Key))
				if err != nil {
					log.Error().Err(err).Str("key", item.Key).Msg("Error uploading chunk to s3")
				}
			}
		}()
		wg.Add(1)
	}
	return channel,&wg
}