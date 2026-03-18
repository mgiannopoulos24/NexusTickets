package migrate

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"

	"nexustickets/internal/config"
	"nexustickets/internal/db"
)

func Up(cfg config.Config) error {
	dsn, err := db.BuildPostgresDSN(cfg)
	if err != nil {
		return err
	}

	sourceURL := buildSourceURL(cfg.MigrationsPath)
	m, err := migrate.New(sourceURL, dsn)
	if err != nil {
		return fmt.Errorf("init migrate: %w", err)
	}
	defer func() {
		_, _ = m.Close()
	}()

	if err := m.Up(); err != nil {
		if errors.Is(err, migrate.ErrNoChange) {
			return nil
		}
		return fmt.Errorf("migrate up: %w", err)
	}
	return nil
}

func Down(cfg config.Config) error {
	dsn, err := db.BuildPostgresDSN(cfg)
	if err != nil {
		return err
	}

	sourceURL := buildSourceURL(cfg.MigrationsPath)
	m, err := migrate.New(sourceURL, dsn)
	if err != nil {
		return fmt.Errorf("init migrate: %w", err)
	}
	defer func() {
		_, _ = m.Close()
	}()

	if err := m.Down(); err != nil {
		if errors.Is(err, migrate.ErrNoChange) {
			return nil
		}
		return fmt.Errorf("migrate down: %w", err)
	}
	return nil
}

func buildSourceURL(path string) string {
	p := strings.TrimSpace(path)
	if p == "" {
		p = "/migrations"
	}

	// In the scratch Docker image we copy migrations to `/migrations`.
	// In local dev runs (e.g. `air`), fall back to `./migrations`.
	if _, err := os.Stat(p); err != nil {
		if os.IsNotExist(err) && p == "/migrations" {
			p = "./migrations"
		}
	}

	abs := p
	if !filepath.IsAbs(p) {
		abs = filepath.Clean(p)
	}
	return "file://" + abs
}
