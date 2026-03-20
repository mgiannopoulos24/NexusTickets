package handler

import (
	"time"

	"github.com/gofiber/fiber/v2"
	redisv9 "github.com/redis/go-redis/v9"

	"nexustickets/internal/middleware"
)

func RegisterAuthRoutes(app *fiber.App, authHandler *AuthHandler, redisClient *redisv9.Client) {
	auth := app.Group("/auth")
	auth.Use(middleware.RateLimiter(redisClient, 5, time.Minute))
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", authHandler.Login)
	auth.Post("/refresh", authHandler.Refresh)
	auth.Post("/logout", authHandler.Logout)
}
