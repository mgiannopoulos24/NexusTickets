package logger

import (
	"fmt"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func New(appEnv string) (*zap.Logger, error) {
	switch appEnv {
	case "development":
		return zap.NewDevelopment()
	case "staging", "production":
		cfg := zap.NewProductionConfig()
		cfg.EncoderConfig.TimeKey = "ts"
		cfg.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
		return cfg.Build()
	default:
		return nil, fmt.Errorf("invalid APP_ENV: %q", appEnv)
	}
}

