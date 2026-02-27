package s3

import (
	"context"
	"io"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/transfermanager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/hritesh04/epub-web-tool/internal/config"
)

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
	// presignClient :=s3.NewPresignClient(s.s3)
	// req, err := presignClient.PresignGetObject(ctx,&s3.GetObjectInput{
	// 	Bucket: aws.String("epubs"),
	// 	Key: aws.String(key),
	// },s3.WithPresignExpires(30*time.Minute))
	// if err != nil {
	// 	return err
	// }
	// fmt.Println(req.URL)
	return nil
}