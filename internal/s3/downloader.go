package s3

import (
	"context"
	"io"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/hritesh04/epub-web-tool/internal/config"
)

type S3Downloader struct {
	s3      *s3.Client
	cfg config.S3
}

func NewDownloader(cfg config.S3) *S3Downloader{
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
	return &S3Downloader{
		s3: client,
		cfg: cfg,
	}
}

func (s *S3Downloader) Download(ctx context.Context,key string)(*os.File,error) {
	input := &s3.GetObjectInput{
		Bucket:&s.cfg.EpubBucket,
		Key:    aws.String(key),
	}

	res,err := s.s3.GetObject(ctx,input)
	if err != nil {
		return nil,err
	}
	defer res.Body.Close()

	tmpDir := os.TempDir()
	file,err := os.CreateTemp(tmpDir,"*.epub")
	if err != nil {
		return nil,err
	}

	_,err = io.Copy(file,res.Body)
	if err != nil {
		return nil,err
	}

	if _, err = file.Seek(0, io.SeekStart); err != nil {
		return nil,err
	}

	return file,nil
}