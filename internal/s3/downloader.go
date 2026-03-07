package s3

import (
	"context"
	"io"
	"os"

	"github.com/rs/zerolog/log"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/transfermanager"
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
	log.Info().Str("key", key).Msg("Downloading object")
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

func (s *S3Downloader) DownloadTranslatedChunks(ctx context.Context,key string, dst string)(error) {
	log.Info().Str("prefix", key).Str("dst", dst).Msg("Downloading translated chunks")
	input := &transfermanager.DownloadDirectoryInput{
		Bucket:&s.cfg.TranslationBucket,
		KeyPrefix: &key,
		Destination: &dst,
	}

	downloader := transfermanager.New(s.s3)
	output, err := downloader.DownloadDirectory(ctx,input)
	if err != nil {
		return err
	}
	if output.ObjectsFailed != 0 {
		log.Warn().Int64("failed_count", output.ObjectsFailed).Msg("Failed to download some files")
	}
	log.Info().Int64("count", output.ObjectsDownloaded).Msg("Downloaded files")
	return nil
}