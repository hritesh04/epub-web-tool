package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/rs/zerolog/log"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hritesh04/epub-web-tool/internal/drive"
	"github.com/hritesh04/epub-web-tool/internal/model"
	"github.com/hritesh04/epub-web-tool/internal/otel"
	"github.com/hritesh04/epub-web-tool/internal/queue"
)

const MAX_FILE_SIZE = 50 * 1024 * 1024

type PresignUploadService interface {
	GeneratePostObjectLink(ctx context.Context, key string) (*s3.PresignedPostRequest, error)
	GenerateGetObjectLink(ctx context.Context, key string) (string, error)
	Exists(ctx context.Context, key string) bool
}

type PublisherService interface {
	PublishTranslationReq(ctx context.Context, data queue.TranslationMsg) error
}

type EpubRepository interface {
	Insert(ctx context.Context, epub *model.Epub) (*model.Epub, error)
	GetAll(ctx context.Context, userID string) ([]*model.Epub, error)
	GetByID(ctx context.Context, epubID string, userID string) (*model.Epub, error)
	DeleteEpub(ctx context.Context, epubID string, userID string) error
}

type EpubController struct {
	db    EpubRepository
	s3    PresignUploadService
	queue PublisherService
	drive *drive.Service
}

func NewEpubHandler(db EpubRepository, s3 PresignUploadService, queue PublisherService, driveService *drive.Service) *EpubController {
	return &EpubController{
		db:    db,
		s3:    s3,
		queue: queue,
		drive: driveService,
	}
}

func (s *EpubController) GetPresignPostURL(c *gin.Context) {
	requestID := c.GetString("requestID")
	if requestID == "" {
		requestID = uuid.New().String()
	}
	userID := c.GetString("userID")
	if userID == "" {
		log.Warn().Msg("Error fetching user epubs: userID not found")
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized user"})
		return
	}
	key := fmt.Sprintf("%s/%s.epub", userID, requestID)
	presignPostUrl, err := s.s3.GeneratePostObjectLink(c.Request.Context(), key)
	if err != nil {
		log.Error().Err(err).Str("request_id", requestID).Msg("Error generating presign post URL")
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Internal Server Error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": presignPostUrl})
}

func (s *EpubController) FinishUpload(c *gin.Context) {
	defer otel.RecordUpload(c.Request.Context())
	data := new(model.Epub)
	uid := c.Param("uid")
	key := c.Param("id")
	if key == "" || uid == "" {
		log.Warn().Msg("Empty key for finish upload")
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Empty key in params"})
		return
	}
	data.UserID = c.GetString("userID")
	if err := c.ShouldBind(&data); err != nil {
		log.Warn().Err(err).Msg("Error unmarshalling request body")
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid request payload"})
		return
	}
	data.Source = "upload"

	if exists := s.s3.Exists(c.Request.Context(), fmt.Sprintf("%s/%s", uid, key)); !exists {
		log.Warn().Str("key", key).Msg("Object not found in s3")
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Object Not Found"})
		return
	}
	epub, err := s.db.Insert(c.Request.Context(), data)
	if err != nil {
		log.Error().Err(err).Msg("Error inserting epub into db")
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Internal Server Error"})
		return
	}

	body := queue.TranslationMsg{
		EpubID:      epub.Id,
		Key:         fmt.Sprintf("%s/%s", uid, key),
		TranslateTo: epub.TranslateTo,
		Source:      "upload",
	}

	if err := s.queue.PublishTranslationReq(c.Request.Context(), body); err != nil {
		log.Error().Err(err).Msg("Error publishing message")
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "Error publishing message"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": epub})
}

func (s *EpubController) ImportFromDrive(c *gin.Context) {
	defer otel.RecordUpload(c.Request.Context())
	userID := c.GetString("userID")
	if userID == "" {
		log.Warn().Msg("Import from drive: userID not found")
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized user"})
		return
	}

	var req struct {
		DriveLink   string `json:"driveLink"`
		Title       string `json:"title"`
		TranslateTo string `json:"translateTo"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn().Err(err).Msg("Error unmarshalling import request body")
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid request payload"})
		return
	}

	fileID, err := drive.ExtractFileID(req.DriveLink)
	if err != nil {
		log.Warn().Str("link", req.DriveLink).Err(err).Msg("Invalid google drive link")
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Please provide a valid Google Drive share link to a single file"})
		return
	}

	info, err := s.drive.CheckFile(c.Request.Context(), fileID, drive.MaxSize)
	if err != nil {
		switch {
		case errors.Is(err, drive.ErrTooLarge):
			log.Warn().Str("file_id", fileID).Msg("File exceeds drive import limit")
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"success": false, "message": "File exceeds the 500MB link import limit"})
		case errors.Is(err, drive.ErrNotEpub):
			log.Warn().Str("file_id", fileID).Msg("Linked file is not an epub")
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "The linked file is not a valid EPUB"})
		case errors.Is(err, drive.ErrNotShared):
			log.Warn().Str("file_id", fileID).Msg("Linked file is not publicly shared")
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Could not access the file. Make sure the file is shared publicly on Google Drive."})
		default:
			log.Error().Err(err).Str("file_id", fileID).Msg("Error checking google drive file")
			c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "Failed to validate the file. Please try again later."})
		}
		return
	}

	title := strings.TrimSpace(req.Title)
	if info.Filename != "" {
		title = info.Filename
	}
	if title == "" || title == "/" {
		title = "Imported Book"
	}
	if strings.TrimSpace(req.TranslateTo) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Target language is required"})
		return
	}

	requestID := c.GetString("requestID")
	if requestID == "" {
		requestID = uuid.New().String()
	}
	key := fmt.Sprintf("%s/%s.epub", userID, requestID)

	data := &model.Epub{
		Title:       title,
		Size:        int(info.Size),
		TranslateTo: req.TranslateTo,
		UserID:      userID,
		ObjectKey:   key,
		Source:      "gdrive",
		DriveLink:   req.DriveLink,
	}
	epub, err := s.db.Insert(c.Request.Context(), data)
	if err != nil {
		log.Error().Err(err).Msg("Error inserting epub into db")
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Internal Server Error"})
		return
	}

	body := queue.TranslationMsg{
		EpubID:      epub.Id,
		Key:         key,
		TranslateTo: epub.TranslateTo,
		Source:      "gdrive",
		DriveLink:   req.DriveLink,
	}
	if err := s.queue.PublishTranslationReq(c.Request.Context(), body); err != nil {
		log.Error().Err(err).Msg("Error publishing message")
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "Error publishing message"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": epub})
}

func (s *EpubController) GetUserEpub(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		log.Warn().Msg("Error fetching user epubs: userID not found")
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Unauthorized user"})
		return
	}
	epubs, err := s.db.GetAll(c.Request.Context(), userID)
	if err != nil {
		log.Error().Err(err).Msg("Error fetching user epubs")
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Internal Server Error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": epubs})
}

func (s *EpubController) DeleteEpub(c *gin.Context) {
	epubID := c.Param("id")
	userID := c.GetString("userID")
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
	if err := s.db.DeleteEpub(c.Request.Context(), epubID, userID); err != nil {
		log.Error().Err(err).Str("epub_id", epubID).Str("user_id", userID).Msg("Error deleting user epub")
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Internal Server Error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (s *EpubController) GetPresignTranslatedEpubLink(c *gin.Context) {
	userID := c.GetString("userID")
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
	epubs, err := s.db.GetByID(c.Request.Context(), epubID, userID)
	if err != nil {
		log.Error().Err(err).Msg("Error fetching user epubs")
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Internal Server Error"})
		return
	}
	url, err := s.s3.GenerateGetObjectLink(c.Request.Context(), epubs.ObjectKey)
	if err != nil {
		log.Error().Err(err).Msg("Error generating presign get object link")
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Internal Server Error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "url": url})
}
