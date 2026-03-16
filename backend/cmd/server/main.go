package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

func main() {
	// Logger
	logger, err := zap.NewDevelopment()
	if err != nil {
		log.Fatal(err)
	}
	defer logger.Sync()

	// App
	app := fiber.New(fiber.Config{
		AppName: "NexusTickets API",
	})

	// Routes
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"status": "ok\n",
		})
	})

	app.Get("/ping", func(c *fiber.Ctx) error {
		return c.SendString("pong!\n")
	})

	// Startup message
	app.Hooks().OnListen(func(data fiber.ListenData) error {
		logger.Info("server ready to accept connections",
			zap.String("host", data.Host),
			zap.String("port", data.Port),
		)
		return nil
	})

	// Start
	port := os.Getenv("APP_PORT")
	if port == "" {
		port = "8080"
	}

	if err := app.Listen(":" + port); err != nil {
		logger.Fatal("server failed", zap.Error(err))
	}
}