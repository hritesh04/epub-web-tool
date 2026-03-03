package handler

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type ChunkRepository interface {
	EpubChunkStatus(ctx context.Context,epubID string) (int,error)
}

type ChunkController struct {
	epub EpubRepository
	chunk ChunkRepository
}

func NewChunkHandler(chunk ChunkRepository,epub EpubRepository) *ChunkController {
	return &ChunkController{
		chunk: chunk,
		epub: epub,
	}
}

func (s *ChunkController) Progress(c *gin.Context) {
	epubID := c.Param("id")
	userID := c.Keys["userID"].(string)

	epub, err := s.epub.GetByID(c.Request.Context(), epubID, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false})
		return
	}

	if epub.Status == "queued" {
		c.JSON(http.StatusAccepted, gin.H{"success": true})
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.Status(http.StatusInternalServerError)
		return
	}

	ctx := c.Request.Context()

	for {
		select {
		case <-ctx.Done():
			log.Println("Client disconnected")
			return
		default:
			count, err := s.chunk.EpubChunkStatus(ctx, epubID)
			if err != nil {
				log.Println("Error checking status:", err)
				return
			}

			if count == *epub.ChunkCount {
				fmt.Fprintf(c.Writer,
					"event: progress\n"+
						"data: {\"status\":\"completed\",\"percent\": %d}\n\n",
					count,
				)
				flusher.Flush()
				return
			}

			fmt.Fprintf(c.Writer,
				"event: progress\n"+
					"data: {\"status\":\"in-progress\",\"percent\": %d}\n\n",
				count,
			)
			flusher.Flush()

			time.Sleep(5 * time.Second)
		}
	}
}