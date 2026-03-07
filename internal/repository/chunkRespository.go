package repository

import (
	"context"
	"fmt"

	"github.com/hritesh04/epub-web-tool/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ChunkRepository struct {
	db *pgxpool.Pool
}

func NewChunkRepository(db *pgxpool.Pool) *ChunkRepository{
	return &ChunkRepository{
		db: db,
	}
}

func (u *ChunkRepository) EpubChunkStatus(ctx context.Context, epubID string)(int,error){
	var count int
	err := u.db.QueryRow(ctx,"SELECT COUNT(DISTINCT chunk_id) FROM chunks WHERE epub_id = $1 AND status = $2;",epubID,"completed").Scan(&count)
	if err == pgx.ErrNoRows {
		return 0, nil
	}
	if err != nil {
		return 0,err
	}
	return count, nil
}

func (u *ChunkRepository) InsertChunk(ctx context.Context,chunks []model.Chunk)(error){
	rows, err := u.db.CopyFrom(ctx,pgx.Identifier{"chunks"},[]string{"id","epub_id","chunk_id","object_key","chapter_path"},pgx.CopyFromSlice(len(chunks),func(i int) ([]any, error) {
		return []any{chunks[i].Id,chunks[i].EpubID,chunks[i].ChunkID,chunks[i].ObjectKey,chunks[i].ChapterPath},nil
	}))
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("Error inserting chunks to db")
	}
	return nil
}