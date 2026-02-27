package handler

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hritesh04/epub-web-tool/internal/queue"
)

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024

type PresignUploadService interface {
	GeneratePostObjectLink(ctx context.Context,key string) (*s3.PresignedPostRequest, error)
}

type PublisherService interface {
	PublishTranslationReq(ctx context.Context,data queue.TranslationMsg) error
}

type EpubController struct {
	s3 PresignUploadService
	queue PublisherService
}

func NewEpubHandler(s3 PresignUploadService,queue PublisherService) *EpubController {
	return &EpubController{
		s3: s3,
		queue: queue,
	}
}

func (s *EpubController) Upload(c *gin.Context) {
	requestID := c.GetHeader("X-Request-Id")
	if requestID == "" {
		requestID = uuid.New().String()
	}

	key := fmt.Sprintf("%s.epub",requestID)
	presignPostUrl, err := s.s3.GeneratePostObjectLink(c.Request.Context(),key)
	if err != nil {
		log.Println("Error uplaoding epub:",err)
		c.JSON(http.StatusOK, gin.H{"success": false, "message":"Internal Server Error"})
		return
	}
	
	body := queue.TranslationMsg{
		RequestID: requestID,
		Key: key,
	}

	if err := s.queue.PublishTranslationReq(c.Request.Context(),body); err != nil {
		log.Println("Error publishing message:",err)
		c.JSON(http.StatusOK, gin.H{"success": false, "message":"Error publishing message"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": presignPostUrl})
}
