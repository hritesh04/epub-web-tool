package repository

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/hritesh04/epub-web-tool/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository{
	return &UserRepository{
		db: db,
	}
}

func (u *UserRepository) Create(ctx context.Context,data *model.User)(*model.User,error){
	user := new(model.User)
	data.ID=uuid.NewString()
	if err := u.db.QueryRow(ctx,"INSERT INTO users (id,email,password) VALUES ($1,$2,$3) RETURNING id, email, created_at;",data.ID,data.Email,data.Password).Scan(&user.ID,&user.Email,&user.CreatedAt); err != nil {
		return nil,err
	}
	return user,nil
}

func (u *UserRepository) GetByID(ctx context.Context, id string)(*model.User,error){
	user := new(model.User)
	if err := u.db.QueryRow(ctx,"SELECT id, email, created_at FROM users WHERE id=$1;",id).Scan(&user.ID,&user.Email,&user.CreatedAt); err != nil {
		return nil,err
	}
	return user,nil
}

func (u *UserRepository) GetByEmail(ctx context.Context, email string)(*model.User,error){
	user := new(model.User)
	if err := u.db.QueryRow(ctx,"SELECT id, email, password, created_at FROM users WHERE email=$1;",email).Scan(&user.ID,&user.Email,&user.Password,&user.CreatedAt); err != nil && !errors.Is(err,pgx.ErrNoRows) {
		return nil,err
	}
	return user,nil
}

func (u *UserRepository) UpdateRefreshToken(ctx context.Context, id string, token string) error {
	row, err := u.db.Exec(ctx,"UPDATE users SET refresh_token = $1 WHERE id=$2;",token,id)
	if err != nil {
		return err
	}
	if row.RowsAffected() == 0 {
		log.Println("Failed to update user refresh token no row effect for userID:",id)
		return fmt.Errorf("failed to update refresh token: user not found")
	}
	return nil
}

func (u *UserRepository) CheckRefreshToken(ctx context.Context, id string) (string,error) {
	var hashedToken string
	if err := u.db.QueryRow(ctx,"SELECT refresh_token FROM users WHERE id = $1;",id).Scan(&hashedToken);err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "",fmt.Errorf("Invalid refresh token")
		}
		return "",err
	}
	return hashedToken,nil
}