package handler

import (
	"time"

	"github.com/gofiber/fiber/v2"
	redisv9 "github.com/redis/go-redis/v9"

	"nexustickets/internal/middleware"
)

func RegisterAuthRoutes(router fiber.Router, authHandler *AuthHandler, redisClient *redisv9.Client) {
	auth := router.Group("/auth")
	auth.Use(middleware.RateLimiter(redisClient, 5, time.Minute))
	auth.Get("/username-available", authHandler.UsernameAvailable)
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", authHandler.Login)
	auth.Post("/refresh", authHandler.Refresh)
	auth.Post("/logout", authHandler.Logout)
}
