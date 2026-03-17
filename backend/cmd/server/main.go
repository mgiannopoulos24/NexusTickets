package main

import (
	"fmt"

	"github.com/gofiber/fiber/v2"

	"nexustickets/internal/config"
	"nexustickets/pkg/logger"
	"nexustickets/pkg/response"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}

	log, err := logger.New(cfg.AppEnv)
	if err != nil {
		panic(err)
	}
	defer func() { _ = log.Sync() }()

	app := fiber.New(fiber.Config{
		AppName: "NexusTickets API",
	})

	app.Get("/health", func(c *fiber.Ctx) error {
		return response.OK(c, fiber.Map{"status": "ok"})
	})

	app.Get("/ping", func(c *fiber.Ctx) error {
		return c.SendString("pong!\n")
	})

	app.Hooks().OnListen(func(data fiber.ListenData) error {
		log.Info("server ready")
		return nil
	})

	addr := fmt.Sprintf(":%d", cfg.AppPort)
	if err := app.Listen(addr); err != nil {
		log.Fatal(err.Error())
	}
}