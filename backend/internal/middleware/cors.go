package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func CORS(allowedOrigins string) fiber.Handler {
	origins := strings.TrimSpace(allowedOrigins)
	if origins == "" {
		origins = "http://localhost,http://localhost:5173"
	}

	return cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Content-Type,Authorization",
		AllowCredentials: true,
		MaxAge:           86400,
	})
}

