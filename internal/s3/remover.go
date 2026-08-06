package s3

import (
	"context"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/hritesh04/epub-web-tool/internal/config"
	"github.com/hritesh04/epub-web-tool/internal/otel"
	"go.opentelemetry.io/contrib/instrumentation/github.com/aws/aws-sdk-go-v2/otelaws"
	"go.opentelemetry.io/otel/attribute"
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
		otelaws.AppendMiddlewares(&o.APIOptions)
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

	start := time.Now()
	defer func() {
		otel.RecordS3Operation(ctx, "S3.DeleteObjects", time.Since(start).Seconds(),
			attribute.Int("s3.objects", len(keys)))
	}()

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