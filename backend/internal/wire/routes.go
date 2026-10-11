package wire

import (
	"github.com/gofiber/fiber/v2"
	redisv9 "github.com/redis/go-redis/v9"

	"nexustickets/internal/config"
	"nexustickets/internal/handler"
)

// RegisterRoutes mounts every REST handler under router (the /api/v1 group).
// main and the integration tests share it, so the tests exercise the same
// routes, guards and middleware as the running server.
func (d *AppDependencies) RegisterRoutes(router fiber.Router, cfg config.Config, rdb *redisv9.Client) {
	handler.RegisterAuthRoutes(router, d.AuthHandler, rdb)
	handler.RegisterUserRoutes(router, d.UserHandler, cfg.JWTSecret)
	handler.RegisterEventRoutes(router, d.EventHandler, cfg.JWTSecret)
	handler.RegisterCategoryRoutes(router, d.CategoryHandler)
	handler.RegisterBookingRoutes(router, d.BookingHandler, cfg.JWTSecret)
	handler.RegisterMessageRoutes(router, d.MessageHandler, cfg.JWTSecret)
	handler.RegisterAdminExportRoutes(router, d.AdminExportHandler, cfg.JWTSecret)
	handler.RegisterSupportRoutes(router, d.SupportHandler, cfg.JWTSecret)
}
