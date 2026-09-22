package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"go.uber.org/zap"

	"nexustickets/internal/config"
	"nexustickets/internal/db"
	"nexustickets/internal/handler"
	"nexustickets/internal/middleware"
	"nexustickets/internal/redis"
	"nexustickets/internal/service"
	"nexustickets/internal/wire"
	"nexustickets/pkg/logger"
	"nexustickets/pkg/response"
)

// completionSweepInterval is how often published events that have already
// ended are moved to the COMPLETED state (assignment §7).
const completionSweepInterval = 15 * time.Minute

// runCompletionSweeper advances finished events to COMPLETED on a ticker.
// Booking also checks the clock directly, so a stale status between sweeps
// cannot let anyone book an event that has already ended.
func runCompletionSweeper(events *service.EventService, log *zap.Logger) {
	sweep := func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		n, err := events.SweepCompleted(ctx)
		if err != nil {
			log.Error("completion sweep failed", zap.Error(err))
			return
		}
		if n > 0 {
			log.Info("events marked completed", zap.Int64("count", n))
		}
	}

	sweep()
	ticker := time.NewTicker(completionSweepInterval)
	defer ticker.Stop()
	for range ticker.C {
		sweep()
	}
}

// runHealthcheck probes the server's own /health endpoint and reports the exit
// code Docker expects. The runtime image is `scratch`: it has no shell and no
// wget, so the statically linked binary has to be its own health probe.
func runHealthcheck() int {
	port := strings.TrimSpace(os.Getenv("APP_PORT"))
	if port == "" {
		port = "8080"
	}

	// The server speaks TLS exactly when both files are configured, so the
	// probe follows the same rule.
	scheme := "http"
	if strings.TrimSpace(os.Getenv("TLS_CERT_FILE")) != "" &&
		strings.TrimSpace(os.Getenv("TLS_KEY_FILE")) != "" {
		scheme = "https"
	}

	client := &http.Client{
		Timeout: 3 * time.Second,
		Transport: &http.Transport{
			// This request never leaves the container: it loops back to the
			// server's own listener, whose certificate is self-signed and
			// issued for a different name. Verifying it would add nothing.
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, //nolint:gosec
		},
	}

	resp, err := client.Get(scheme + "://127.0.0.1:" + port + "/health")
	if err != nil {
		fmt.Fprintln(os.Stderr, "healthcheck:", err)
		return 1
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		fmt.Fprintln(os.Stderr, "healthcheck: unexpected status", resp.StatusCode)
		return 1
	}
	return 0
}

func main() {
	// `nexustickets-api healthcheck` runs the probe above instead of the server.
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		os.Exit(runHealthcheck())
	}

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

	if err := db.AutoMigrate(pg.Gorm); err != nil {
		log.Fatal("auto migrate failed", zap.Error(err))
	}

	app := fiber.New(fiber.Config{
		AppName:        "NexusTickets API",
		ErrorHandler:   middleware.ErrorHandler(log),
		ReadBufferSize: 1 << 15,
	})

	app.Use(middleware.CORS(cfg.CORSAllowedOrigins))
	app.Use(middleware.RequestID())
	app.Use(recover.New())
	app.Use(middleware.RequestLogger())
	app.Use(middleware.RateLimiter(redisClient.Raw, "global", cfg.RateLimitMaxReqs, cfg.RateLimitWindow))
	app.Static("/uploads/media", cfg.MediaStoragePath)

	deps, err := wire.InitializeApp(pg.Gorm, redisClient.Raw, cfg)
	if err != nil {
		log.Fatal("wire init failed", zap.Error(err))
	}

	// The built-in administrator (assignment §3) must exist from installation.
	{
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		created, err := service.EnsureAdmin(ctx, deps.Users, service.AdminAccount{
			Username: cfg.AdminUsername,
			Password: cfg.AdminPassword,
			Email:    cfg.AdminEmail,
		})
		cancel()
		if err != nil {
			log.Fatal("ensure admin failed", zap.Error(err))
		}
		if created {
			log.Info("built-in administrator created", zap.String("username", cfg.AdminUsername))
		}
	}

	go deps.Hub.Run()
	go deps.RecommendationService.StartPeriodicRetraining()
	go runCompletionSweeper(deps.EventService, log)

	v1 := app.Group("/api/v1")
	handler.RegisterAuthRoutes(v1, deps.AuthHandler, redisClient.Raw)
	handler.RegisterUserRoutes(v1, deps.UserHandler, cfg.JWTSecret)
	handler.RegisterEventRoutes(v1, deps.EventHandler, cfg.JWTSecret)
	handler.RegisterCategoryRoutes(v1, deps.CategoryHandler)
	handler.RegisterBookingRoutes(v1, deps.BookingHandler, cfg.JWTSecret)
	handler.RegisterMessageRoutes(v1, deps.MessageHandler, cfg.JWTSecret)
	handler.RegisterAdminExportRoutes(v1, deps.AdminExportHandler, cfg.JWTSecret)
	handler.RegisterSupportRoutes(v1, deps.SupportHandler, cfg.JWTSecret)

	app.Get("/health", func(c *fiber.Ctx) error {
		return response.OK(c, fiber.Map{"status": "ok\n"})
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
		if cfg.TLSCertFile != "" && cfg.TLSKeyFile != "" {
			errCh <- app.ListenTLS(addr, cfg.TLSCertFile, cfg.TLSKeyFile)
			return
		}
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
