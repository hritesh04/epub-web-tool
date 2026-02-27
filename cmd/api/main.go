package main

import (
	"os"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hritesh04/epub-web-tool/internal/config"
	"github.com/hritesh04/epub-web-tool/internal/handler"
	"github.com/hritesh04/epub-web-tool/internal/queue/producer"
	"github.com/hritesh04/epub-web-tool/internal/s3"
)

func requestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		uuid := uuid.New()
		c.Writer.Header().Set("X-Request-Id", uuid.String())
		c.Next()
	}
}

func main() {
	cfg := config.LoadConfig()
	r := gin.Default()
	r.Use(requestIDMiddleware())

	store := s3.NewPresignUploadS3Client(cfg.S3)
	publisher := producer.NewTranslationRequestPublisher(cfg.Queue)
	epub := handler.NewEpubHandler(store,publisher)

	r.GET("/upload", epub.Upload)
	// r.GET("/status/:job_id", getWorkerStatus)
	port := os.Getenv("PORT")
	r.Run(":"+port)
}
