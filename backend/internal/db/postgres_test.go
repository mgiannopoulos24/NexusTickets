package db

import (
	"testing"

	"nexustickets/internal/config"
)

func TestBuildPostgresDSN_WithURL(t *testing.T) {
	cfg := config.Config{
		DatabaseURL: "postgres://user:pass@localhost:5432/mydb?sslmode=disable",
	}
	dsn, err := BuildPostgresDSN(cfg)
	if err != nil {
		t.Fatalf("BuildPostgresDSN error: %v", err)
	}
	if dsn != cfg.DatabaseURL {
		t.Fatalf("BuildPostgresDSN = %q, want %q", dsn, cfg.DatabaseURL)
	}
}

func TestBuildPostgresDSN_WithFallbackFields(t *testing.T) {
	cfg := config.Config{
		DBHost:     "db.example.com",
		DBPort:     5432,
		DBName:     "nexustickets",
		DBUser:     "app_user",
		DBPassword: "secret123",
	}

	dsn, err := BuildPostgresDSN(cfg)
	if err != nil {
		t.Fatalf("BuildPostgresDSN error: %v", err)
	}

	expected := "postgres://app_user:secret123@db.example.com:5432/nexustickets?TimeZone=UTC&sslmode=disable"
	if dsn != expected {
		t.Fatalf("BuildPostgresDSN = %q, want %q", dsn, expected)
	}
}

func TestBuildPostgresDSN_MissingPassword(t *testing.T) {
	cfg := config.Config{
		DBHost: "localhost",
		DBPort: 5432,
		DBName: "test",
		DBUser: "user",
	}

	_, err := BuildPostgresDSN(cfg)
	if err == nil {
		t.Fatal("expected error when DB_PASSWORD is empty")
	}
}

func TestBuildPostgresDSN_URLTakesPriority(t *testing.T) {
	cfg := config.Config{
		DatabaseURL: "postgres://url_user:url_pass@url_host:5432/url_db?sslmode=disable",
		DBHost:      "fallback_host",
		DBPort:      9999,
		DBName:      "fallback_db",
		DBUser:      "fallback_user",
		DBPassword:  "fallback_pass",
	}

	dsn, err := BuildPostgresDSN(cfg)
	if err != nil {
		t.Fatalf("BuildPostgresDSN error: %v", err)
	}
	if dsn != cfg.DatabaseURL {
		t.Fatalf("BuildPostgresDSN = %q, want %q (URL should take priority)", dsn, cfg.DatabaseURL)
	}
}

func TestBuildPostgresDSN_PasswordWithSpecialChars(t *testing.T) {
	cfg := config.Config{
		DBHost:     "localhost",
		DBPort:     5432,
		DBName:     "testdb",
		DBUser:     "admin",
		DBPassword: "p@ss:w%rd+&",
	}

	dsn, err := BuildPostgresDSN(cfg)
	if err != nil {
		t.Fatalf("BuildPostgresDSN error: %v", err)
	}

	expected := "postgres://admin:p%40ss%3Aw%25rd+&@localhost:5432/testdb?TimeZone=UTC&sslmode=disable"
	if dsn != expected {
		t.Fatalf("BuildPostgresDSN = %q, want %q", dsn, expected)
	}
}
