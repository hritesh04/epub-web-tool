package handler

import (
	"context"
	"fmt"
	"net/http"

	"github.com/rs/zerolog/log"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hritesh04/epub-web-tool/internal/model"
	"github.com/hritesh04/epub-web-tool/internal/queue"
)

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024

type PresignUploadService interface {
	GeneratePostObjectLink(ctx context.Context,key string) (*s3.PresignedPostRequest, error)
	GenerateGetObjectLink(ctx context.Context, key string) (string,error)
	Exists(ctx context.Context,key string) bool
}

type PublisherService interface {
	PublishTranslationReq(ctx context.Context,data queue.TranslationMsg) error
}

type EpubRepository interface {
	Insert(ctx context.Context,epub *model.Epub) (*model.Epub,error)
	GetAll(ctx context.Context,userID string) ([]*model.Epub,error)
	GetByID(ctx context.Context,epubID string,userID string) (*model.Epub,error)
	DeleteEpub(ctx context.Context, epubID string, userID string)(error)
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
	requestID := c.GetString("requestID")
	if requestID == "" {
		requestID = uuid.New().String()
	}

	key := fmt.Sprintf("%s.epub",requestID)
	presignPostUrl, err := s.s3.GeneratePostObjectLink(c.Request.Context(),key)
	if err != nil {
		log.Error().Err(err).Str("request_id", requestID).Msg("Error generating presign post URL")
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message":"Internal Server Error"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"success": true, "data": presignPostUrl})
}

func (s *EpubController) FinishUpload(c *gin.Context) {
	data := new(model.Epub)
	key := c.Param("id")
	if key == "" {
		log.Warn().Msg("Empty key for finish upload")
		c.JSON(http.StatusBadRequest, gin.H{"success":false,"message":"Empty key in params"})
		return
	}
	data.UserID = c.Keys["userID"].(string)
	if err := c.ShouldBind(&data); err != nil {
		log.Warn().Err(err).Msg("Error unmarshalling request body")
		c.JSON(http.StatusBadRequest, gin.H{"success":false,"message":"Invalid request payload"})
		return
	}

	if exists := s.s3.Exists(c.Request.Context(),key); !exists {
		log.Warn().Str("key", key).Msg("Object not found in s3")
		c.JSON(http.StatusNotFound, gin.H{"success":false,"message":"Object Not Found"})
		return
	}
	epub,err := s.db.Insert(c.Request.Context(),data)
	if err != nil {
		log.Error().Err(err).Msg("Error inserting epub into db")
		c.JSON(http.StatusInternalServerError, gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	
	body := queue.TranslationMsg{
		EpubID:epub.Id,
		Key: key,
		TranslateTo: epub.TranslateTo,
	}

	if err := s.queue.PublishTranslationReq(c.Request.Context(),body); err != nil {
		log.Error().Err(err).Msg("Error publishing message")
		c.JSON(http.StatusOK, gin.H{"success": false, "message":"Error publishing message"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": epub})
}

func (s *EpubController) GetUserEpub(c *gin.Context) {
	userID := c.Keys["userID"].(string)
	if userID == "" {
		log.Warn().Msg("Error fetching user epubs: userID not found")
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Unauthorized user"})
		return
	}
	epubs,err := s.db.GetAll(c.Request.Context(),userID)
	if err != nil {
		log.Error().Err(err).Msg("Error fetching user epubs")
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Internal Server Error"})
		return
	}
	c.JSON(http.StatusOK,gin.H{"success":true,"data":epubs})	
}

func (s *EpubController) DeleteEpub(c *gin.Context) {
	epubID := c.Param("id")
	userID := c.Keys["userID"].(string)
	if userID == "" {
		log.Warn().Msg("Error fetching user epubs: userID not found")
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Unauthorized user"})
		return
	}
	if epubID == "" {
		log.Warn().Msg("epubID not found in url param")
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Epub ID not found"})
		return
	}
	if err := s.db.DeleteEpub(c.Request.Context(),epubID,userID);err != nil {
		log.Error().Err(err).Str("epub_id", epubID).Str("user_id", userID).Msg("Error deleting user epub")
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Internal Server Error"})
		return
	}
	c.JSON(http.StatusOK,gin.H{"success":true})	
}

func (s *EpubController) GetPresignTranslatedEpubLink(c *gin.Context) {
	userID := c.Keys["userID"].(string)
	if userID == "" {
		log.Warn().Msg("Error fetching user epubs: userID not found")
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Unauthorized user"})
		return
	}
	epubID := c.Param("id")
	if epubID == "" {
		log.Warn().Msg("epubID not found in url param")
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Epub ID not found"})
		return
	}
	epubs,err := s.db.GetByID(c.Request.Context(),epubID,userID)
	if err != nil {
		log.Error().Err(err).Msg("Error fetching user epubs")
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Internal Server Error"})
		return
	}
	url,err := s.s3.GenerateGetObjectLink(c.Request.Context(),epubs.ObjectKey)
	if err != nil {
		log.Error().Err(err).Msg("Error generating presign get object link")
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Internal Server Error"})
		return
	}
	c.JSON(http.StatusOK,gin.H{"success":true,"url":url})	
}