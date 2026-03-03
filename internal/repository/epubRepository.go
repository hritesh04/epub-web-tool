package repository

import (
	"context"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/hritesh04/epub-web-tool/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type EpubRepository struct {
	db *pgxpool.Pool
}

func NewEpubRepository(db *pgxpool.Pool) *EpubRepository{
	return &EpubRepository{
		db: db,
	}
}

func (u *EpubRepository) Insert(ctx context.Context, data *model.Epub)(*model.Epub,error){
	epub := new(model.Epub)
	data.Id = uuid.NewString()
	row := u.db.QueryRow(ctx,"INSERT INTO epubs (id,title,size,translate_to,user_id,object_key) VALUES($1,$2,$3,$4,$5,$6) returning id,title,size,translate_to,status,created_at;",data.Id,data.Title,data.Size,data.TranslateTo,data.UserID,data.ObjectKey)

	if err := row.Scan(&epub.Id,&epub.Title,&epub.Size,&epub.TranslateTo,&epub.Status,&epub.CreatedAt);err != nil {
		log.Println("Error scanning db rows to struct")
		return nil,err
	}
	return epub,nil
}

func (u *EpubRepository) GetAll(ctx context.Context, userID string)([]*model.Epub,error){
	var epubs []*model.Epub
	rows,err := u.db.Query(ctx,"SELECT * FROM epubs WHERE user_id=$1",userID)
	if err != nil {
		return epubs,err		
	}
	for rows.Next(){
		epub,err :=pgx.RowToAddrOfStructByName[model.Epub](rows)
		if err !=  nil {
			return nil,err
		}
		epubs = append(epubs, epub)
	}
	return epubs,nil
}

func (u *EpubRepository) GetByID(ctx context.Context,epubID string, userID string)(*model.Epub,error){
	epub := new(model.Epub)
	if err := u.db.QueryRow(ctx,"SELECT status, chunk_count, object_key FROM epubs WHERE id=$1 AND user_id=$2",epubID,userID).Scan(&epub.Status,&epub.ChunkCount,&epub.ObjectKey);err != nil {
		return epub,err
	}
	return epub,nil
}

func (u *EpubRepository) DeleteEpub(ctx context.Context,epubID string, userID string)(error){
	row, err := u.db.Exec(ctx,"DELETE FROM epubs WHERE id=$1 AND user_id=$2",epubID,userID)
	if err != nil {
		return err
	}
	if row.RowsAffected() == 0 {
		return fmt.Errorf("Failed to deleted epub not found")
	}
	return nil
}


func (u *EpubRepository) UpdateStatus(ctx context.Context, id string, status string)(error){
	row, err :=u.db.Exec(ctx,"UPDATE epubs SET status=$1 WHERE id=$2",status,id)
	if err != nil {
		return  err
	}
	if row.RowsAffected() == 0 {
		log.Println("Failed to update epub status no row effect for epubID:",id)
		return nil
	}
	return nil
}

func (u *EpubRepository) UpdateChunkCount(ctx context.Context, id string, count int)(error){
	row, err :=u.db.Exec(ctx,"UPDATE epubs SET chunk_count=$1 WHERE id=$2",count,id)
	if err != nil {
		return  err
	}
	if row.RowsAffected() == 0 {
		log.Println("Failed to update epub status chunk count no row effect for epubID:",id)
		return nil
	}
	return nil
}

func (r *EpubRepository) AlreadyProcessed(ctx context.Context, id string) (bool, error) {
	var claimed string

	err := r.db.QueryRow(ctx, `
		UPDATE epubs
		SET status='in-progress',
		    updated_at=now()
		WHERE id=$1
		  AND (
		        status='queued'
		        OR
		        (status='in-progress' AND updated_at < now() - interval '5 minutes')
		      )
		RETURNING id;
	`, id).Scan(&claimed)
	
	if err == pgx.ErrNoRows {
		return true, nil
	}

	if err != nil {
		return false, err
	}

	return false, nil
}

func (r *EpubRepository) AlreadyCompiling(ctx context.Context, id string) (*model.Epub, error) {
	epub := new(model.Epub) 

	err := r.db.QueryRow(ctx, `
		UPDATE epubs
		SET status='compiling',
		    updated_at=now()
		WHERE id=$1
		  AND (
		        status='in-progress'
		        OR
		        (status='compiling' AND updated_at < now() - interval '5 minutes')
		      )
		RETURNING id,object_key;
	`, id).Scan(&epub.Id,&epub.ObjectKey)

	if err != nil {
		return epub, err
	}

	return epub, nil
}