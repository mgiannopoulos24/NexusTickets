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

	envCORSAllowedOrigins = "CORS_ALLOWED_ORIGINS"
	envJWTSecret          = "JWT_SECRET"
	envRateLimitMaxReqs   = "RATE_LIMIT_MAX_REQUESTS"
	envRateLimitWindow    = "RATE_LIMIT_WINDOW"
	envMediaStoragePath   = "MEDIA_STORAGE_PATH"

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

	envTLSCertFile = "TLS_CERT_FILE"
	envTLSKeyFile  = "TLS_KEY_FILE"

	envRecDataDir = "RECOMMENDATION_DATA_DIR"
)

type Config struct {
	AppEnv  string `validate:"oneof=development staging production"`
	AppPort int    `validate:"min=1,max=65535"`

	CORSAllowedOrigins string
	JWTSecret          string
	RateLimitMaxReqs   int           `validate:"min=1,max=10000"`
	RateLimitWindow    time.Duration `validate:"min=1000000000"`
	MediaStoragePath   string

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

	// Recommendation data directory (CSV files for training).
	RecDataDir string

	// When both are non-empty, the HTTP server uses TLS (paths to PEM files).
	TLSCertFile string
	TLSKeyFile  string
}

func Load() (Config, error) {
	loadDotEnv()

	cfg := Config{
		AppEnv:             getEnv(envAppEnv, "development"),
		CORSAllowedOrigins: getEnv(envCORSAllowedOrigins, "http://localhost,http://localhost:5173,https://localhost,https://localhost:5173"),
		JWTSecret:          getEnv(envJWTSecret, "dev-insecure-jwt-secret-change-me"),
		MediaStoragePath:   strings.TrimSpace(getEnv(envMediaStoragePath, "uploads/media")),
		DatabaseURL:        strings.TrimSpace(os.Getenv(envDatabaseURL)),
		RedisURL:           strings.TrimSpace(os.Getenv(envRedisURL)),

		DBHost:        getEnv(envDBHost, "postgres"),
		DBName:        getEnv(envDBName, "nexustickets"),
		DBUser:        getEnv(envDBUser, "nexustickets_app"),
		DBPassword:    os.Getenv(envDBPassword),
		RedisHost:     getEnv(envRedisHost, "redis"),
		RedisPassword: os.Getenv(envRedisPassword),
		RecDataDir:    strings.TrimSpace(getEnv(envRecDataDir, "../data")),
		TLSCertFile:   strings.TrimSpace(os.Getenv(envTLSCertFile)),
		TLSKeyFile:    strings.TrimSpace(os.Getenv(envTLSKeyFile)),
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

	rateLimitMaxReqs, err := parseInt(getEnv(envRateLimitMaxReqs, "120"), 1, 10000)
	if err != nil {
		return Config{}, fmt.Errorf("%s: %w", envRateLimitMaxReqs, err)
	}
	cfg.RateLimitMaxReqs = rateLimitMaxReqs

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

	rateLimitWindow, err := parseDuration(getEnv(envRateLimitWindow, "1m"))
	if err != nil {
		return Config{}, fmt.Errorf("%s: %w", envRateLimitWindow, err)
	}
	cfg.RateLimitWindow = rateLimitWindow

	validate := validator.New(validator.WithRequiredStructEnabled())
	if err := validate.Struct(cfg); err != nil {
		return Config{}, err
	}

	if (cfg.TLSCertFile != "") != (cfg.TLSKeyFile != "") {
		return Config{}, fmt.Errorf("%s and %s must both be set or both empty", envTLSCertFile, envTLSKeyFile)
	}
	if cfg.TLSCertFile != "" {
		if _, err := os.Stat(cfg.TLSCertFile); err != nil {
			return Config{}, fmt.Errorf("%s: %w", envTLSCertFile, err)
		}
		if _, err := os.Stat(cfg.TLSKeyFile); err != nil {
			return Config{}, fmt.Errorf("%s: %w", envTLSKeyFile, err)
		}
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
