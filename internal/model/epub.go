package model

import (
	"time"
)

type Epub struct {
	Id string `json:"id" db:"id"`
	Title string `json:"title" db:"title"`
	Size int `json:"size" db:"size"`
	TranslateTo string `json:"translateTo" db:"translate_to"`
	Status string `json:"status" db:"status"`
	UserID string `json:"userID" db:"user_id"`
	ChunkCount *int `json:"chunkCount" db:"chunk_count"`
	CreatedAt *time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt *time.Time `json:"updatedAt" db:"updated_at"`
}

type Chunk struct {
	Id string `json:"id" db:"id"`
	EpubID string `json:"epubID" db:"epub_id"`
	ChapterPath string `json:"chapterPath" db:"chapter_path"`
	ObjectKey string `json:"objectKey" db:"object_key"`
	ChunkID int `json:"chunkID" db:"chunk_id"`
	Status string `json:"status" db:"status"`
	RetryCount int `json:"retryCount" db:"retry_count"`
	ErrorMsg string `json:"errorMsg" db:"error_msg"`
	CreatedAt *time.Time `json:"createdAt" db:"created_at"`
}