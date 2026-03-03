package db

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func New(url string) (*pgxpool.Pool,error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second) 
	defer cancel()

	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		log.Fatalf("failed to parse db config: %v", err)
	}

	cfg.MinConns = 1
	cfg.MaxConnLifetime = time.Hour

	cfg.MinConns = 1
	cfg.MaxConnLifetime = time.Hour

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create pool: %w", err)
	}

	pingCtx, pingCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer pingCancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping error: %w", err)
	}

	return pool, nil

}