package handler

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hritesh04/epub-web-tool/internal/model"
	"github.com/hritesh04/epub-web-tool/internal/queue"
)

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024

type PresignUploadService interface {
	GeneratePostObjectLink(ctx context.Context,key string) (*s3.PresignedPostRequest, error)
	Exists(ctx context.Context,key string) bool
}

type PublisherService interface {
	PublishTranslationReq(ctx context.Context,data queue.TranslationMsg) error
}

type EpubRepository interface {
	Insert(ctx context.Context,epub *model.Epub) (*model.Epub,error)
	GetAll(ctx context.Context,userID string) ([]*model.Epub,error)
	GetByID(ctx context.Context,epubID string,userID string) (*model.Epub,error)
}

type EpubController struct {
	db EpubRepository
	s3 PresignUploadService
	queue PublisherService
}

func NewEpubHandler(db EpubRepository,s3 PresignUploadService,queue PublisherService) *EpubController {
	return &EpubController{
		db:db,
		s3: s3,
		queue: queue,
	}
}

func (s *EpubController) GetPresignPostURL(c *gin.Context) {
	requestID := c.GetHeader("X-Request-Id")
	if requestID == "" {
		requestID = uuid.New().String()
	}

	key := fmt.Sprintf("%s.epub",requestID)
	presignPostUrl, err := s.s3.GeneratePostObjectLink(c.Request.Context(),key)
	if err != nil {
		log.Println("Error uplaoding epub:",err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message":"Internal Server Error"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"success": true, "data": presignPostUrl})
}

func (s *EpubController) FinishUpload(c *gin.Context) {
	data := new(model.Epub)
	key := c.Param("id")
	if key == "" {
		log.Println("Empty key for finsh upload")
		c.JSON(http.StatusBadRequest, gin.H{"success":false,"message":"Empty key in params"})
		return
	}
	data.UserID = c.Keys["userID"].(string)
	if err := c.ShouldBind(&data); err != nil {
		log.Println("Error unmarshalling request body")
		c.JSON(http.StatusBadRequest, gin.H{"success":false,"message":"Invalid request payload"})
		return
	}

	if exists := s.s3.Exists(c.Request.Context(),key); !exists {
		log.Println("Object not found in s3:",key)
		c.JSON(http.StatusNotFound, gin.H{"success":false,"message":"Object Not Found"})
		return
	}
	epub,err := s.db.Insert(c.Request.Context(),data)
	if err != nil {
		log.Println("Error inserting epub into db:",err)
		c.JSON(http.StatusInternalServerError, gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	
	body := queue.TranslationMsg{
		EpubID:epub.Id,
		Key: key,
		TranslateTo: epub.TranslateTo,
	}

	if err := s.queue.PublishTranslationReq(c.Request.Context(),body); err != nil {
		log.Println("Error publishing message:",err)
		c.JSON(http.StatusOK, gin.H{"success": false, "message":"Error publishing message"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": epub})
}

func (s *EpubController) GetUserEpub(c *gin.Context) {
	userID := c.Keys["userID"].(string)
	if userID == "" {
		log.Println("Error fetchin user epubs userID not found")
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Unauthorized user"})
		return
	}
	epubs,err := s.db.GetAll(c.Request.Context(),userID)
	if err != nil {
		log.Println("Error fetching user epubs:",err)
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Internal Server Error"})
		return
	}
	c.JSON(http.StatusOK,gin.H{"success":true,"data":epubs})	
}