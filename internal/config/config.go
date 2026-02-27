package config

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
)

type S3 struct {
	Endpoint string
	Region string
	Key string
	Password string
	EpubBucket string
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

type Config struct {
	Port string
	S3 S3
	Queue Queue
}

func LoadConfig() Config {
	var cfg Config
	err := godotenv.Load()
	if err != nil {
		log.Fatalf("Error loading .env file: %s", err)
	}
	cfg.Port = os.Getenv("PORT")
	if cfg.Port == "" {
		cfg.Port="3000"
	}
	cfg.S3.Endpoint = os.Getenv("S3_ENDPOINT")
	cfg.S3.Key = os.Getenv("S3_KEY")
	cfg.S3.Password = os.Getenv("S3_PASSWORD")
	cfg.S3.Region = os.Getenv("S3_REGION")
	cfg.S3.EpubBucket = os.Getenv("S3_EPUB_BUCKET")

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
	return cfg
}