package s3

import (
	"context"
	"log"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/hritesh04/epub-web-tool/internal/config"
)

type S3Presign struct {
	s3 *s3.Client
	cfg config.S3
}

func NewPresignUploadS3Client(cfg config.S3)*S3Presign{
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
	return &S3Presign{
		s3: client,
		cfg:cfg,
	}
}

func (s *S3Presign) GeneratePostObjectLink(
    ctx context.Context,
    key string,
) (*s3.PresignedPostRequest, error) {

    presignClient := s3.NewPresignClient(s.s3)

    req, err := presignClient.PresignPostObject(ctx, &s3.PutObjectInput{
        Bucket: aws.String(s.cfg.EpubBucket),
        Key:    aws.String(key),
    }, func(opts *s3.PresignPostOptions) {

        opts.Expires = 5 * time.Minute

        opts.Conditions = []interface{}{
            map[string]string{"bucket": s.cfg.EpubBucket},
            map[string]string{"key": key},

            []interface{}{"eq", "$Content-Type", "application/epub+zip"},

            []interface{}{"content-length-range", 0, 2 * 1024 * 1024 * 1024},
        }
    })

    if err != nil {
        return nil, err
    }

    return req, nil
}

func (s *S3Presign) GenerateGetObjectLink(ctx context.Context, key string) (string,error) {
	presignClient := s3.NewPresignClient(s.s3)
	res, err := presignClient.PresignGetObject(ctx,&s3.GetObjectInput{
		Bucket: &s.cfg.EpubBucket,
		Key: &key,
	}, func(opts *s3.PresignOptions) {
        opts.Expires = 10 * time.Minute
    })
	if err != nil {
		return "",err
	}
	return res.URL,nil
}

func (s *S3Presign) Exists(ctx context.Context, key string)bool{
	_,err := s.s3.HeadObject(ctx,&s3.HeadObjectInput{
		Bucket: &s.cfg.EpubBucket,
		Key: &key,
	})
	if err != nil {
		log.Println("Error checking head of an object:",err)
		return false
	}
	return true
}