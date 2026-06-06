package config

import (
	"os"
	"testing"
	"time"
)

func TestParsePort(t *testing.T) {
	tests := []struct {
		name    string
		raw     string
		want    int
		wantErr bool
	}{
		{"valid 8080", "8080", 8080, false},
		{"valid 1", "1", 1, false},
		{"valid 65535", "65535", 65535, false},
		{"too low 0", "0", 0, true},
		{"too high 65536", "65536", 0, true},
		{"not a number", "abc", 0, true},
		{"empty string", "", 0, true},
		{"with spaces", "  8080  ", 8080, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parsePort(tt.raw)
			if (err != nil) != tt.wantErr {
				t.Fatalf("parsePort(%q) error = %v, wantErr = %v", tt.raw, err, tt.wantErr)
			}
			if got != tt.want {
				t.Fatalf("parsePort(%q) = %d, want %d", tt.raw, got, tt.want)
			}
		})
	}
}

func TestParseInt(t *testing.T) {
	tests := []struct {
		name    string
		raw     string
		min     int
		max     int
		want    int
		wantErr bool
	}{
		{"valid in range", "25", 1, 500, 25, false},
		{"valid at min", "1", 1, 500, 1, false},
		{"valid at max", "500", 1, 500, 500, false},
		{"below min", "0", 1, 500, 0, true},
		{"above max", "501", 1, 500, 0, true},
		{"not a number", "abc", 1, 500, 0, true},
		{"empty string", "", 1, 500, 0, true},
		{"with spaces", "  25  ", 1, 500, 25, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseInt(tt.raw, tt.min, tt.max)
			if (err != nil) != tt.wantErr {
				t.Fatalf("parseInt(%q, %d, %d) error = %v, wantErr = %v", tt.raw, tt.min, tt.max, err, tt.wantErr)
			}
			if got != tt.want {
				t.Fatalf("parseInt(%q, %d, %d) = %d, want %d", tt.raw, tt.min, tt.max, got, tt.want)
			}
		})
	}
}

func TestParseDuration(t *testing.T) {
	tests := []struct {
		name    string
		raw     string
		want    time.Duration
		wantErr bool
	}{
		{"30 minutes", "30m", 30 * time.Minute, false},
		{"5 minutes", "5m", 5 * time.Minute, false},
		{"1 hour", "1h", time.Hour, false},
		{"negative", "-5m", 0, true},
		{"zero", "0s", 0, true},
		{"invalid unit", "abc", 0, true},
		{"empty string", "", 0, true},
		{"with spaces", "  30m  ", 30 * time.Minute, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseDuration(tt.raw)
			if (err != nil) != tt.wantErr {
				t.Fatalf("parseDuration(%q) error = %v, wantErr = %v", tt.raw, err, tt.wantErr)
			}
			if got != tt.want {
				t.Fatalf("parseDuration(%q) = %v, want %v", tt.raw, got, tt.want)
			}
		})
	}
}

func TestGetEnv(t *testing.T) {
	const key = "TEST_GETENV_KEY"
	const fallback = "fallback_value"

	os.Unsetenv(key)

	t.Run("returns fallback when unset", func(t *testing.T) {
		got := getEnv(key, fallback)
		if got != fallback {
			t.Fatalf("getEnv(%q, %q) = %q, want %q", key, fallback, got, fallback)
		}
	})

	t.Run("returns env value when set", func(t *testing.T) {
		os.Setenv(key, "env_value")
		defer os.Unsetenv(key)
		got := getEnv(key, fallback)
		if got != "env_value" {
			t.Fatalf("getEnv(%q, %q) = %q, want %q", key, fallback, got, "env_value")
		}
	})

	t.Run("trims whitespace from env value", func(t *testing.T) {
		os.Setenv(key, "  spaced_value  ")
		defer os.Unsetenv(key)
		got := getEnv(key, fallback)
		if got != "spaced_value" {
			t.Fatalf("getEnv(%q, %q) = %q, want %q", key, fallback, got, "spaced_value")
		}
	})
}

func TestLoadDefaults(t *testing.T) {
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() unexpected error: %v", err)
	}

	if cfg.AppEnv != "development" {
		t.Fatalf("AppEnv = %q, want %q", cfg.AppEnv, "development")
	}
	if cfg.AppPort != 8080 {
		t.Fatalf("AppPort = %d, want %d", cfg.AppPort, 8080)
	}
	if cfg.DBHost != "postgres" {
		t.Fatalf("DBHost = %q, want %q", cfg.DBHost, "postgres")
	}
	if cfg.DBPort != 5432 {
		t.Fatalf("DBPort = %d, want %d", cfg.DBPort, 5432)
	}
	if cfg.RedisHost != "redis" {
		t.Fatalf("RedisHost = %q, want %q", cfg.RedisHost, "redis")
	}
	if cfg.RedisPort != 6379 {
		t.Fatalf("RedisPort = %d, want %d", cfg.RedisPort, 6379)
	}
	if cfg.RateLimitMaxReqs != 120 {
		t.Fatalf("RateLimitMaxReqs = %d, want %d", cfg.RateLimitMaxReqs, 120)
	}
	if cfg.RateLimitWindow != time.Minute {
		t.Fatalf("RateLimitWindow = %v, want %v", cfg.RateLimitWindow, time.Minute)
	}
	if cfg.DBMaxOpenConns != 25 {
		t.Fatalf("DBMaxOpenConns = %d, want %d", cfg.DBMaxOpenConns, 25)
	}
	if cfg.DBMaxIdleConns != 10 {
		t.Fatalf("DBMaxIdleConns = %d, want %d", cfg.DBMaxIdleConns, 10)
	}
	if cfg.DBConnMaxLifetime != 30*time.Minute {
		t.Fatalf("DBConnMaxLifetime = %v, want %v", cfg.DBConnMaxLifetime, 30*time.Minute)
	}
	if cfg.DBConnMaxIdleTime != 5*time.Minute {
		t.Fatalf("DBConnMaxIdleTime = %v, want %v", cfg.DBConnMaxIdleTime, 5*time.Minute)
	}
	if cfg.AppEnv != "development" && cfg.AppEnv != "" {
		t.Fatal("unexpected APP_ENV value")
	}
}

func TestLoadInvalidAppEnv(t *testing.T) {
	os.Setenv(envAppEnv, "invalid")
	defer os.Unsetenv(envAppEnv)

	_, err := Load()
	if err == nil {
		t.Fatal("expected error for invalid APP_ENV")
	}
}

func TestLoadInvalidPort(t *testing.T) {
	os.Setenv(envAppPort, "99999")
	defer os.Unsetenv(envAppPort)

	_, err := Load()
	if err == nil {
		t.Fatal("expected error for invalid APP_PORT")
	}
}

func TestLoadTLSBothRequired(t *testing.T) {
	os.Setenv(envTLSCertFile, "/tmp/cert.pem")
	defer os.Unsetenv(envTLSCertFile)

	_, err := Load()
	if err == nil {
		t.Fatal("expected error when only TLS_CERT_FILE is set")
	}
}
