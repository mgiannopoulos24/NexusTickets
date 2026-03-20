package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"go.uber.org/zap"

	"nexustickets/internal/config"
	"nexustickets/internal/db"
	"nexustickets/internal/handler"
	"nexustickets/internal/middleware"
	"nexustickets/internal/migrate"
	"nexustickets/internal/redis"
	"nexustickets/internal/repository/postgres"
	"nexustickets/internal/service"
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

	pg, err := db.NewPostgres(cfg)
	if err != nil {
		log.Fatal("postgres init failed", zap.Error(err))
	}
	defer func() { _ = pg.SQL.Close() }()

	redisClient, err := redis.New(cfg)
	if err != nil {
		log.Fatal("redis init failed", zap.Error(err))
	}
	defer func() { _ = redisClient.Raw.Close() }()

	if err := migrate.Up(cfg); err != nil {
		log.Fatal("migrations failed", zap.Error(err))
	}

	app := fiber.New(fiber.Config{
		AppName:      "NexusTickets API",
		ErrorHandler: middleware.ErrorHandler(log),
	})

	app.Use(middleware.CORS(cfg.CORSAllowedOrigins))
	app.Use(middleware.RequestID())
	app.Use(recover.New())
	app.Use(middleware.RequestLogger())
	app.Use(middleware.RateLimiter(redisClient.Raw, cfg.RateLimitMaxReqs, cfg.RateLimitWindow))

	userRepo := postgres.NewUserRepositoryPostgres(pg.Gorm)
	authService := service.NewAuthService(userRepo, redisClient.Raw, cfg.JWTSecret)
	authHandler := handler.NewAuthHandler(authService)
	userService := service.NewUserService(userRepo)
	userHandler := handler.NewUserHandler(userService)
	handler.RegisterAuthRoutes(app, authHandler, redisClient.Raw)
	handler.RegisterUserRoutes(app, userHandler, cfg.JWTSecret)

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
	errCh := make(chan error, 1)
	go func() {
		errCh <- app.Listen(addr)
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-sigCh:
		log.Info("shutdown requested", zap.String("signal", sig.String()))
	case err := <-errCh:
		if err != nil {
			log.Fatal(err.Error())
		}
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := app.ShutdownWithContext(ctx); err != nil {
		log.Error("graceful shutdown failed", zap.Error(err))
	}
}
