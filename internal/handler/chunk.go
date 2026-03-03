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

	// Set SSE headers
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Transfer-Encoding", "chunked")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Streaming unsupported"})
		return
	}

	ctx := c.Request.Context()
	ticker := time.NewTicker(2 * time.Second)
	heartbeat := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	defer heartbeat.Stop()

	lastCount := -1

	for {
		select {
		case <-ctx.Done():
			log.Printf("Client disconnected: %s", epubID)
			return
		case <-heartbeat.C:
			// Send heartbeat comment to keep connection alive
			fmt.Fprintf(c.Writer, ": heartbeat\n\n")
			flusher.Flush()
		case <-ticker.C:
			count, err := s.chunk.EpubChunkStatus(ctx, epubID)
			if err != nil {
				log.Printf("Error checking status for %s: %v", epubID, err)
				return
			}

			if count != lastCount {
				lastCount = count
				
				status := "in-progress"
				percent := 0
				if epub.ChunkCount != nil && *epub.ChunkCount > 0 {
					percent = (count * 100) / *epub.ChunkCount
				}

				if epub.ChunkCount != nil && count >= *epub.ChunkCount {
					status = "finished"
					percent = 100
				}

				fmt.Fprintf(c.Writer, "event: progress\ndata: {\"status\":\"%s\",\"progress\":%d}\n\n", status, percent)
				flusher.Flush()

				if status == "finished" {
					return
				}
			}
		}
	}
}
