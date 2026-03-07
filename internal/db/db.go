package db

import (
	"context"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/jackc/pgx/v5/pgxpool"
)

func New(url string) (*pgxpool.Pool,error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second) 
	defer cancel()

	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to parse db config")
	}

	cfg.MinConns = 1
	cfg.MaxConnLifetime = time.Hour

	cfg.MinConns = 1
	cfg.MaxConnLifetime = time.Hour

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create pool: %w", err)
	}

	pingCtx, pingCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer pingCancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping error: %w", err)
	}

	return pool, nil

}