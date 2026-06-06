package redis

import (
	"testing"

	"nexustickets/internal/config"
)

func TestBuildOptions_WithURL(t *testing.T) {
	cfg := config.Config{
		RedisURL: "redis://:password@localhost:6379/0",
	}

	opts, err := buildOptions(cfg)
	if err != nil {
		t.Fatalf("buildOptions error: %v", err)
	}
	if opts.Addr != "localhost:6379" {
		t.Fatalf("Addr = %q, want %q", opts.Addr, "localhost:6379")
	}
	if opts.Password != "password" {
		t.Fatalf("Password = %q, want %q", opts.Password, "password")
	}
	if opts.DB != 0 {
		t.Fatalf("DB = %d, want %d", opts.DB, 0)
	}
}

func TestBuildOptions_WithFallbackFields(t *testing.T) {
	cfg := config.Config{
		RedisHost:     "redis.example.com",
		RedisPort:     6380,
		RedisPassword: "securepass",
	}

	opts, err := buildOptions(cfg)
	if err != nil {
		t.Fatalf("buildOptions error: %v", err)
	}
	if opts.Addr != "redis.example.com:6380" {
		t.Fatalf("Addr = %q, want %q", opts.Addr, "redis.example.com:6380")
	}
	if opts.Password != "securepass" {
		t.Fatalf("Password = %q, want %q", opts.Password, "securepass")
	}
	if opts.PoolSize != 20 {
		t.Fatalf("PoolSize = %d, want %d", opts.PoolSize, 20)
	}
	if opts.MinIdleConns != 5 {
		t.Fatalf("MinIdleConns = %d, want %d", opts.MinIdleConns, 5)
	}
}

func TestBuildOptions_URLTakesPriority(t *testing.T) {
	cfg := config.Config{
		RedisURL:      "redis://url_user@url_host:6379/0",
		RedisHost:     "fallback_host",
		RedisPort:     9999,
		RedisPassword: "fallback_pass",
	}

	opts, err := buildOptions(cfg)
	if err != nil {
		t.Fatalf("buildOptions error: %v", err)
	}
	if opts.Addr != "url_host:6379" {
		t.Fatalf("Addr = %q, want %q", opts.Addr, "url_host:6379")
	}
}

func TestBuildOptions_InvalidURL(t *testing.T) {
	cfg := config.Config{
		RedisURL: "not-a-valid-url",
	}

	_, err := buildOptions(cfg)
	if err == nil {
		t.Fatal("expected error for invalid Redis URL")
	}
}

func TestBuildOptions_EmptyPasswordFallback(t *testing.T) {
	cfg := config.Config{
		RedisHost: "localhost",
		RedisPort: 6379,
	}

	opts, err := buildOptions(cfg)
	if err != nil {
		t.Fatalf("buildOptions error: %v", err)
	}
	if opts.Password != "" {
		t.Fatalf("Password = %q, want empty string", opts.Password)
	}
}
