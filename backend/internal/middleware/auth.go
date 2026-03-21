package middleware

import (
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"

	"nexustickets/internal/domain"
)

const (
	ctxUserIDKey = "user_id"
	ctxRoleKey   = "role"
)

type JWTClaims struct {
	Role      string `json:"role"`
	TokenType string `json:"token_type"`
	jwt.RegisteredClaims
}

func JWTAuth(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token, err := bearerToken(c.Get("Authorization"))
		if err != nil {
			return err
		}

		claims, err := parseAndValidateJWT(token, jwtSecret)
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, "invalid or expired token")
		}

		c.Locals(ctxUserIDKey, claims.Subject)
		c.Locals(ctxRoleKey, claims.Role)
		return c.Next()
	}
}

// OptionalJWTAuth parses a Bearer access token when present and sets auth locals; missing or invalid tokens are ignored.
func OptionalJWTAuth(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		const prefix = "Bearer "
		raw := strings.TrimSpace(c.Get("Authorization"))
		if raw == "" || !strings.HasPrefix(raw, prefix) {
			return c.Next()
		}
		token := strings.TrimSpace(strings.TrimPrefix(raw, prefix))
		if token == "" {
			return c.Next()
		}
		claims, err := parseAndValidateJWT(token, jwtSecret)
		if err != nil {
			return c.Next()
		}
		c.Locals(ctxUserIDKey, claims.Subject)
		c.Locals(ctxRoleKey, claims.Role)
		return c.Next()
	}
}

func RequireRole(roles ...domain.UserRole) fiber.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		allowed[string(role)] = struct{}{}
	}

	return func(c *fiber.Ctx) error {
		role, _ := c.Locals(ctxRoleKey).(string)
		if role == "" {
			return fiber.NewError(fiber.StatusUnauthorized, "missing role in auth context")
		}
		if _, ok := allowed[role]; !ok {
			return fiber.NewError(fiber.StatusForbidden, "insufficient role")
		}
		return c.Next()
	}
}

func parseAndValidateJWT(token, jwtSecret string) (*JWTClaims, error) {
	claims := &JWTClaims{}
	parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(jwtSecret), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithLeeway(5*time.Second))
	if err != nil {
		return nil, err
	}
	if !parsed.Valid {
		return nil, errors.New("invalid token")
	}
	if strings.TrimSpace(claims.Subject) == "" {
		return nil, errors.New("missing subject")
	}
	if strings.TrimSpace(claims.Role) == "" {
		return nil, errors.New("missing role")
	}
	if claims.TokenType != "access" {
		return nil, errors.New("invalid token type")
	}
	return claims, nil
}

func bearerToken(rawAuth string) (string, error) {
	const prefix = "Bearer "
	raw := strings.TrimSpace(rawAuth)
	if raw == "" || !strings.HasPrefix(raw, prefix) {
		return "", fiber.NewError(fiber.StatusUnauthorized, "missing bearer token")
	}
	token := strings.TrimSpace(strings.TrimPrefix(raw, prefix))
	if token == "" {
		return "", fiber.NewError(fiber.StatusUnauthorized, "missing bearer token")
	}
	return token, nil
}
