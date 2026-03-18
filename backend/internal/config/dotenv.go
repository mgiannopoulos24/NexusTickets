package config

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/joho/godotenv"
)

func loadDotEnv() {
	// Load local .env defaults for developer convenience.
	// In Docker/CI/prod, env vars are expected to be injected externally.
	appEnv := strings.TrimSpace(os.Getenv(envAppEnv))
	if appEnv == "" || appEnv == "development" {
		// Only fill missing variables. Never override values already set by the
		// environment (e.g. Makefile overrides, Docker env injection, CI secrets).
		paths := []string{
			".env",
			filepath.Join("..", ".env"),
		}
		for _, p := range paths {
			if _, err := os.Stat(p); err == nil {
				envMap, err := godotenv.Read(p)
				if err != nil {
					continue
				}
				for k, v := range envMap {
					if _, exists := os.LookupEnv(k); exists {
						continue
					}
					_ = os.Setenv(k, v)
				}
			}
		}
	}
}
