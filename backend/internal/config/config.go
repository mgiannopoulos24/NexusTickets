package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
)

const (
	envAppEnv  = "APP_ENV"
	envAppPort = "APP_PORT"

	envDatabaseURL = "DATABASE_URL"
	envRedisURL    = "REDIS_URL"

	envMigrationsPath = "MIGRATIONS_PATH"

	envCORSAllowedOrigins = "CORS_ALLOWED_ORIGINS"

	envDBHost     = "DB_HOST"
	envDBPort     = "DB_PORT"
	envDBName     = "DB_NAME"
	envDBUser     = "DB_USER"
	envDBPassword = "DB_PASSWORD"

	envDBMaxOpenConns    = "DB_MAX_OPEN_CONNS"
	envDBMaxIdleConns    = "DB_MAX_IDLE_CONNS"
	envDBConnMaxLifetime = "DB_CONN_MAX_LIFETIME"
	envDBConnMaxIdleTime = "DB_CONN_MAX_IDLE_TIME"

	envRedisHost     = "REDIS_HOST"
	envRedisPort     = "REDIS_PORT"
	envRedisPassword = "REDIS_PASSWORD"
)

type Config struct {
	AppEnv  string `validate:"oneof=development staging production"`
	AppPort int    `validate:"min=1,max=65535"`

	CORSAllowedOrigins string

	MigrationsPath string

	// Preferred connection strings.
	DatabaseURL string
	RedisURL    string

	// Fallback discrete values (used if *_URL is empty).
	DBHost     string
	DBPort     int `validate:"min=1,max=65535"`
	DBName     string
	DBUser     string
	DBPassword string

	DBMaxOpenConns    int `validate:"min=1,max=500"`
	DBMaxIdleConns    int `validate:"min=0,max=500"`
	DBConnMaxLifetime time.Duration
	DBConnMaxIdleTime time.Duration

	RedisHost     string
	RedisPort     int `validate:"min=1,max=65535"`
	RedisPassword string
}

func Load() (Config, error) {
	loadDotEnv()

	cfg := Config{
		AppEnv:             getEnv(envAppEnv, "development"),
		CORSAllowedOrigins: getEnv(envCORSAllowedOrigins, "http://localhost,http://localhost:5173"),
		MigrationsPath:     strings.TrimSpace(getEnv(envMigrationsPath, "/migrations")),
		DatabaseURL:        strings.TrimSpace(os.Getenv(envDatabaseURL)),
		RedisURL:           strings.TrimSpace(os.Getenv(envRedisURL)),

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

	dbMaxOpen, err := parseInt(getEnv(envDBMaxOpenConns, "25"), 1, 500)
	if err != nil {
		return Config{}, fmt.Errorf("%s: %w", envDBMaxOpenConns, err)
	}
	cfg.DBMaxOpenConns = dbMaxOpen

	dbMaxIdle, err := parseInt(getEnv(envDBMaxIdleConns, "10"), 0, 500)
	if err != nil {
		return Config{}, fmt.Errorf("%s: %w", envDBMaxIdleConns, err)
	}
	cfg.DBMaxIdleConns = dbMaxIdle

	connMaxLifetime, err := parseDuration(getEnv(envDBConnMaxLifetime, "30m"))
	if err != nil {
		return Config{}, fmt.Errorf("%s: %w", envDBConnMaxLifetime, err)
	}
	cfg.DBConnMaxLifetime = connMaxLifetime

	connMaxIdleTime, err := parseDuration(getEnv(envDBConnMaxIdleTime, "5m"))
	if err != nil {
		return Config{}, fmt.Errorf("%s: %w", envDBConnMaxIdleTime, err)
	}
	cfg.DBConnMaxIdleTime = connMaxIdleTime

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

func parseInt(raw string, min, max int) (int, error) {
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return 0, fmt.Errorf("must be an integer")
	}
	if n < min || n > max {
		return 0, fmt.Errorf("must be between %d and %d", min, max)
	}
	return n, nil
}

func parseDuration(raw string) (time.Duration, error) {
	d, err := time.ParseDuration(strings.TrimSpace(raw))
	if err != nil {
		return 0, fmt.Errorf("must be a valid duration (e.g. 30m, 5m)")
	}
	if d <= 0 {
		return 0, fmt.Errorf("must be > 0")
	}
	return d, nil
}
