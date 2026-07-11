package db

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"nexustickets/internal/config"
)

type Postgres struct {
	Gorm *gorm.DB
	SQL  *sql.DB
}

func NewPostgres(cfg config.Config) (*Postgres, error) {
	dsn, err := BuildPostgresDSN(cfg)
	if err != nil {
		return nil, err
	}

	gormDB, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		// We use zap in the app; keep GORM logging minimal to avoid double-logging.
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}

	sqlDB, err := gormDB.DB()
	if err != nil {
		return nil, fmt.Errorf("gorm db(): %w", err)
	}

	applyPoolSettings(sqlDB, cfg)

	ctxTimeout := 3 * time.Second
	if err := pingWithTimeout(sqlDB, ctxTimeout); err != nil {
		return nil, fmt.Errorf("postgres ping: %w", err)
	}

	return &Postgres{Gorm: gormDB, SQL: sqlDB}, nil
}

func BuildPostgresDSN(cfg config.Config) (string, error) {
	if cfg.DatabaseURL != "" {
		return cfg.DatabaseURL, nil
	}
	if cfg.DBPassword == "" {
		return "", fmt.Errorf("DB_PASSWORD is required when DATABASE_URL is empty")
	}

	// URL format accepted by GORM's postgres driver.
	u := &url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(cfg.DBUser, cfg.DBPassword),
		Host:   fmt.Sprintf("%s:%d", cfg.DBHost, cfg.DBPort),
		Path:   cfg.DBName,
	}
	q := u.Query()
	// sslmode=disable is expected in local docker-compose dev.
	q.Set("sslmode", "disable")
	q.Set("TimeZone", "UTC")
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func applyPoolSettings(sqlDB *sql.DB, cfg config.Config) {
	sqlDB.SetMaxOpenConns(cfg.DBMaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.DBMaxIdleConns)
	sqlDB.SetConnMaxLifetime(cfg.DBConnMaxLifetime)
	sqlDB.SetConnMaxIdleTime(cfg.DBConnMaxIdleTime)
}

func pingWithTimeout(sqlDB *sql.DB, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	return sqlDB.PingContext(ctx)
}
