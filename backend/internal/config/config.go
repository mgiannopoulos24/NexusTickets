package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/go-playground/validator/v10"
)

const (
	envAppEnv  = "APP_ENV"
	envAppPort = "APP_PORT"

	envDatabaseURL = "DATABASE_URL"
	envRedisURL    = "REDIS_URL"

	envDBHost     = "DB_HOST"
	envDBPort     = "DB_PORT"
	envDBName     = "DB_NAME"
	envDBUser     = "DB_USER"
	envDBPassword = "DB_PASSWORD"

	envRedisHost     = "REDIS_HOST"
	envRedisPort     = "REDIS_PORT"
	envRedisPassword = "REDIS_PASSWORD"
)

type Config struct {
	AppEnv  string `validate:"oneof=development staging production"`
	AppPort int    `validate:"min=1,max=65535"`

	// Preferred connection strings.
	DatabaseURL string
	RedisURL    string

	// Fallback discrete values (used if *_URL is empty).
	DBHost     string
	DBPort     int `validate:"min=1,max=65535"`
	DBName     string
	DBUser     string
	DBPassword string

	RedisHost     string
	RedisPort     int `validate:"min=1,max=65535"`
	RedisPassword string
}

func Load() (Config, error) {
	cfg := Config{
		AppEnv:      getEnv(envAppEnv, "development"),
		DatabaseURL: strings.TrimSpace(os.Getenv(envDatabaseURL)),
		RedisURL:    strings.TrimSpace(os.Getenv(envRedisURL)),

		DBHost:        getEnv(envDBHost, "postgres"),
		DBName:        getEnv(envDBName, "nexustickets"),
		DBUser:        getEnv(envDBUser, "nexustickets_app"),
		DBPassword:    os.Getenv(envDBPassword),
		RedisHost:     getEnv(envRedisHost, "redis"),
		RedisPassword: os.Getenv(envRedisPassword),
	}

	appPort, err := parsePort(getEnv(envAppPort, "8080"))
	if err != nil {
		return Config{}, fmt.Errorf("%s: %w", envAppPort, err)
	}
	cfg.AppPort = appPort

	dbPort, err := parsePort(getEnv(envDBPort, "5432"))
	if err != nil {
		return Config{}, fmt.Errorf("%s: %w", envDBPort, err)
	}
	cfg.DBPort = dbPort

	redisPort, err := parsePort(getEnv(envRedisPort, "6379"))
	if err != nil {
		return Config{}, fmt.Errorf("%s: %w", envRedisPort, err)
	}
	cfg.RedisPort = redisPort

	validate := validator.New(validator.WithRequiredStructEnabled())
	if err := validate.Struct(cfg); err != nil {
		return Config{}, err
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func parsePort(raw string) (int, error) {
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return 0, fmt.Errorf("must be an integer")
	}
	if n < 1 || n > 65535 {
		return 0, fmt.Errorf("must be between 1 and 65535")
	}
	return n, nil
}

