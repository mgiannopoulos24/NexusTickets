package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

func WebSocketJWTAuth(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := strings.TrimSpace(c.Query("token"))
		if token == "" {
			return fiber.NewError(fiber.StatusUnauthorized, "missing websocket token")
		}

		claims, err := parseAndValidateJWT(token, jwtSecret)
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, "invalid or expired websocket token")
		}

		c.Locals(ctxUserIDKey, claims.Subject)
		c.Locals(ctxRoleKey, claims.Role)
		return c.Next()
	}
}
