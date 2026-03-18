package redis

import (
	"context"
	"fmt"
	"time"

	redisv9 "github.com/redis/go-redis/v9"

	"nexustickets/internal/config"
)

type Client struct {
	Raw *redisv9.Client
}

func New(cfg config.Config) (*Client, error) {
	opts, err := buildOptions(cfg)
	if err != nil {
		return nil, err
	}

	c := redisv9.NewClient(opts)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := c.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping: %w", err)
	}

	return &Client{Raw: c}, nil
}

func buildOptions(cfg config.Config) (*redisv9.Options, error) {
	if cfg.RedisURL != "" {
		opts, err := redisv9.ParseURL(cfg.RedisURL)
		if err != nil {
			return nil, fmt.Errorf("parse REDIS_URL: %w", err)
		}
		return opts, nil
	}

	// Password can be empty in local dev, but in docker-compose we expect one.
	addr := fmt.Sprintf("%s:%d", cfg.RedisHost, cfg.RedisPort)
	return &redisv9.Options{
		Addr:         addr,
		Password:     cfg.RedisPassword,
		DB:           0,
		PoolSize:     20,
		MinIdleConns: 5,
	}, nil
}
