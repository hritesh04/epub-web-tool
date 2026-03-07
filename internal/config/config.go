package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
	"github.com/rs/zerolog/log"
)

type S3 struct {
	Endpoint string
	Region string
	Key string
	Password string
	EpubBucket string
	ChunkBucket string
	TranslationBucket string
}

type Queue struct {
	Endpoint string
	User string
	Password string
	ChunkerQueue string
	TranslationQueue string
	ZipQueue string
}

func (q *Queue) URI() string {
	return fmt.Sprintf("amqp://%s:%s@%s",q.User,q.Password,q.Endpoint)
}

type OpenObserve struct {
	Endpoint string
	User string
	Password string
	Organization string
}

type DB struct {
	Url string
}

type Config struct {
	Env  string
	Port string
	DB DB
	S3 S3
	Queue Queue
	OpenObserve OpenObserve
}

func LoadConfig() Config {
	var cfg Config
	err := godotenv.Load()
	if err != nil {
		log.Warn().Err(err).Msg("Error loading .env file")
	}
	cfg.Env = os.Getenv("GO_ENV")
	if cfg.Env == "" {
		cfg.Env = "development"
	}
	cfg.Port = os.Getenv("PORT")
	if cfg.Port == "" {
		cfg.Port="3000"
	}

	cfg.DB.Url = os.Getenv("DATABASE_URL")
	if cfg.DB.Url == ""{
		cfg.DB.Url="postgresql://postgres:postgres@localhost:5432/postgres"
	}

	cfg.S3.Endpoint = os.Getenv("S3_ENDPOINT")
	cfg.S3.Key = os.Getenv("S3_KEY")
	cfg.S3.Password = os.Getenv("S3_PASSWORD")
	cfg.S3.Region = os.Getenv("S3_REGION")
	cfg.S3.EpubBucket = os.Getenv("S3_EPUB_BUCKET")
	cfg.S3.ChunkBucket = os.Getenv("S3_CHUNK_BUCKET")
	cfg.S3.TranslationBucket = os.Getenv("S3_TRANSLATION_BUCKET")

	if cfg.S3.Endpoint == "" {
		cfg.S3.Endpoint="http://localhost:9000"
	}
	if cfg.S3.Key == "" {
		cfg.S3.Key="minioadmin"
	}
	if cfg.S3.Password == "" {
		cfg.S3.Password="minioadmin"
	}
	if cfg.S3.Region == "" {
		cfg.S3.Region="us-west-2"
	}
	if cfg.S3.EpubBucket == "" {
		cfg.S3.EpubBucket="epubs"
	}
	if cfg.S3.ChunkBucket == "" {
		cfg.S3.ChunkBucket="chunks"
	}
	if cfg.S3.TranslationBucket == "" {
		cfg.S3.TranslationBucket="translations"
	}
	
	cfg.Queue.Endpoint = os.Getenv("QUEUE_HOST")
	cfg.Queue.User = os.Getenv("QUEUE_USER")
	cfg.Queue.Password = os.Getenv("QUEUE_PASSWORD")
	cfg.Queue.ChunkerQueue = os.Getenv("QUEUE_CHUNKER")
	cfg.Queue.TranslationQueue = os.Getenv("QUEUE_TRANSLATION")
	cfg.Queue.ZipQueue = os.Getenv("QUEUE_ZIP")


	if cfg.Queue.Endpoint == "" {
		cfg.Queue.Endpoint="localhost:5672"
	}
	if cfg.Queue.User == "" {
		cfg.Queue.User="user"
	}
	if cfg.Queue.Password == "" {
		cfg.Queue.Password="password"
	}
	if cfg.Queue.ChunkerQueue == "" {
		cfg.Queue.ChunkerQueue="chunker"
	}
	if cfg.Queue.TranslationQueue == "" {
		cfg.Queue.TranslationQueue="translation"
	}
	if cfg.Queue.ZipQueue == "" {
		cfg.Queue.ZipQueue="zip"
	}

	cfg.OpenObserve.Endpoint = os.Getenv("OPENOBSERVE_ENDPOINT")
	cfg.OpenObserve.User = os.Getenv("OPENOBSERVE_USER")
	cfg.OpenObserve.Password = os.Getenv("OPENOBSERVE_PASSWORD")
	cfg.OpenObserve.Organization = os.Getenv("OPENOBSERVE_ORGANIZATION")

	if cfg.OpenObserve.Endpoint == "" {
		cfg.OpenObserve.Endpoint = "localhost:5080"
	}
	if cfg.OpenObserve.User == "" {
		cfg.OpenObserve.User = "root@example.com"
	}
	if cfg.OpenObserve.Password == "" {
		cfg.OpenObserve.Password = "password"
	}
	if cfg.OpenObserve.Organization == "" {
		cfg.OpenObserve.Organization = "default"
	}

	return cfg
}