package model

import "time"

type User struct {
	ID string `json:"ID" db:"id"`
	Email string `json:"email" db:"email"`
	Password string `json:"-" db:"password"`
	RefreshToken string `json:"-" db:"refresh_token"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}