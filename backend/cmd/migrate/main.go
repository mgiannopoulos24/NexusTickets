package main

import (
	"fmt"
	"os"

	"go.uber.org/zap"

	"nexustickets/internal/config"
	"nexustickets/internal/migrate"
	"nexustickets/pkg/logger"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: migrate <up|down>")
		os.Exit(2)
	}
	cmd := os.Args[1]

	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(1)
	}

	log, err := logger.New(cfg.AppEnv)
	if err != nil {
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(1)
	}
	defer func() { _ = log.Sync() }()

	switch cmd {
	case "up":
		if err := migrate.Up(cfg); err != nil {
			log.Fatal("migrate up failed", zap.Error(err))
		}
	case "down":
		if err := migrate.Down(cfg); err != nil {
			log.Fatal("migrate down failed", zap.Error(err))
		}
	default:
		fmt.Fprintln(os.Stderr, "usage: migrate <up|down>")
		os.Exit(2)
	}
}
