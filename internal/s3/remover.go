package s3

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/hritesh04/epub-web-tool/internal/config"
)

type S3Remover struct {
	s3      *s3.Client
	cfg config.S3
}

func NewObjectRemover(cfg config.S3)*S3Remover{
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
		ignoreSigningHeaders(o, []string{"Accept-Encoding"})
	})
	return &S3Remover{
		s3: client,
		cfg: cfg,
	}
}

func (s *S3Remover) RemoveChunksAndTranslatedChunks(
	ctx context.Context,
	keys []types.ObjectIdentifier,
) error {

	const batchSize = 900

	for i := 0; i < len(keys); i += batchSize {
		end := min(i + batchSize, len(keys))

		batch := keys[i:end]

		_, err := s.s3.DeleteObjects(ctx, &s3.DeleteObjectsInput{
			Bucket: &s.cfg.TranslationBucket,
			Delete: &types.Delete{
				Objects: batch,
				Quiet:   aws.Bool(false),
			},
		})

		if err != nil {
			return err
		}
	
		_, err = s.s3.DeleteObjects(ctx, &s3.DeleteObjectsInput{
			Bucket: &s.cfg.ChunkBucket,
			Delete: &types.Delete{
				Objects: batch,
				Quiet:   aws.Bool(false),
			},
		})

		if err != nil {
			return err
		}
	}

	return nil
}