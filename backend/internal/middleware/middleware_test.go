package middleware

import (
	"errors"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"

	"nexustickets/internal/domain"
)

func TestJWTAuth_MissingBearer(t *testing.T) {
	app := fiber.New()
	app.Get("/", JWTAuth("secret"), func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	resp, _ := app.Test(httptest.NewRequest("GET", "/", nil))
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestJWTAuth_ValidToken(t *testing.T) {
	token := signTestToken(t, "test-user", "attendee", "access", "secret")

	app := fiber.New()
	app.Get("/", JWTAuth("secret"), func(c *fiber.Ctx) error {
		uid := c.Locals(ctxUserIDKey)
		if uid != "test-user" {
			t.Fatalf("expected 'test-user', got %v", uid)
		}
		role := c.Locals(ctxRoleKey)
		if role != "attendee" {
			t.Fatalf("expected 'attendee', got %v", role)
		}
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, _ := app.Test(req)
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestJWTAuth_WrongSigningMethod(t *testing.T) {
	token := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{
		"sub": "user",
	})
	tokenStr, _ := token.SignedString(jwt.UnsafeAllowNoneSignatureType)

	app := fiber.New()
	app.Get("/", JWTAuth("secret"), func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	resp, _ := app.Test(req)
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestJWTAuth_ExpiredToken(t *testing.T) {
	claims := JWTClaims{
		Role:      "attendee",
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "user",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, _ := token.SignedString([]byte("secret"))

	app := fiber.New()
	app.Get("/", JWTAuth("secret"), func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	resp, _ := app.Test(req)
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestJWTAuth_RefreshTokenRejected(t *testing.T) {
	token := signTestToken(t, "user", "attendee", "refresh", "secret")

	app := fiber.New()
	app.Get("/", JWTAuth("secret"), func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, _ := app.Test(req)
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected 401 for refresh token on access endpoint, got %d", resp.StatusCode)
	}
}

func TestOptionalJWTAuth(t *testing.T) {
	app := fiber.New()
	app.Get("/", OptionalJWTAuth("secret"), func(c *fiber.Ctx) error {
		uid := c.Locals(ctxUserIDKey)
		if uid != nil {
			t.Fatalf("expected nil user_id for missing token, got %v", uid)
		}
		return c.SendString("ok")
	})

	resp, _ := app.Test(httptest.NewRequest("GET", "/", nil))
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestOptionalJWTAuth_WithValidToken(t *testing.T) {
	token := signTestToken(t, "test-user", "attendee", "access", "secret")

	app := fiber.New()
	app.Get("/", OptionalJWTAuth("secret"), func(c *fiber.Ctx) error {
		uid := c.Locals(ctxUserIDKey)
		if uid != "test-user" {
			t.Fatalf("expected 'test-user', got %v", uid)
		}
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, _ := app.Test(req)
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestRequireRole(t *testing.T) {
	t.Run("allowed", func(t *testing.T) {
		app := fiber.New()
		app.Get("/", func(c *fiber.Ctx) error {
			c.Locals(ctxRoleKey, "admin")
			return c.Next()
		}, RequireRole(domain.UserRoleAdmin), func(c *fiber.Ctx) error {
			return c.SendString("ok")
		})

		resp, _ := app.Test(httptest.NewRequest("GET", "/", nil))
		if resp.StatusCode != fiber.StatusOK {
			t.Fatalf("expected 200, got %d", resp.StatusCode)
		}
	})

	t.Run("forbidden", func(t *testing.T) {
		app := fiber.New()
		app.Get("/", func(c *fiber.Ctx) error {
			c.Locals(ctxRoleKey, "attendee")
			return c.Next()
		}, RequireRole(domain.UserRoleAdmin), func(c *fiber.Ctx) error {
			return c.SendString("ok")
		})

		resp, _ := app.Test(httptest.NewRequest("GET", "/", nil))
		if resp.StatusCode != fiber.StatusForbidden {
			t.Fatalf("expected 403, got %d", resp.StatusCode)
		}
	})

	t.Run("missing role", func(t *testing.T) {
		app := fiber.New()
		app.Get("/", RequireRole(domain.UserRoleAdmin), func(c *fiber.Ctx) error {
			return c.SendString("ok")
		})

		resp, _ := app.Test(httptest.NewRequest("GET", "/", nil))
		if resp.StatusCode != fiber.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", resp.StatusCode)
		}
	})

	t.Run("multiple roles", func(t *testing.T) {
		app := fiber.New()
		app.Get("/", func(c *fiber.Ctx) error {
			c.Locals(ctxRoleKey, "organizer")
			return c.Next()
		}, RequireRole(domain.UserRoleAdmin, domain.UserRoleOrganizer), func(c *fiber.Ctx) error {
			return c.SendString("ok")
		})

		resp, _ := app.Test(httptest.NewRequest("GET", "/", nil))
		if resp.StatusCode != fiber.StatusOK {
			t.Fatalf("expected 200, got %d", resp.StatusCode)
		}
	})
}

func TestWebSocketJWTAuth_MissingToken(t *testing.T) {
	app := fiber.New()
	app.Get("/ws", WebSocketJWTAuth("secret"), func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	resp, _ := app.Test(httptest.NewRequest("GET", "/ws", nil))
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestWebSocketJWTAuth_ValidToken(t *testing.T) {
	token := signTestToken(t, "user1", "attendee", "access", "secret")

	app := fiber.New()
	app.Get("/ws", WebSocketJWTAuth("secret"), func(c *fiber.Ctx) error {
		uid := c.Locals(ctxUserIDKey)
		if uid != "user1" {
			t.Fatalf("expected 'user1', got %v", uid)
		}
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/ws?token="+token, nil)
	resp, _ := app.Test(req)
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestWebSocketJWTAuth_InvalidToken(t *testing.T) {
	app := fiber.New()
	app.Get("/ws", WebSocketJWTAuth("secret"), func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/ws?token=invalid", nil)
	resp, _ := app.Test(req)
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestErrorHandler(t *testing.T) {
	log, _ := zap.NewDevelopment()

	app := fiber.New(fiber.Config{
		ErrorHandler: ErrorHandler(log),
	})

	app.Get("/not-found", func(c *fiber.Ctx) error {
		return domain.ErrNotFound
	})
	app.Get("/unauthorized", func(c *fiber.Ctx) error {
		return domain.ErrUnauthorized
	})
	app.Get("/forbidden", func(c *fiber.Ctx) error {
		return domain.ErrForbidden
	})
	app.Get("/capacity", func(c *fiber.Ctx) error {
		return domain.ErrCapacityExceeded
	})
	app.Get("/booking-not-pending", func(c *fiber.Ctx) error {
		return domain.ErrBookingNotPending
	})
	app.Get("/booking-expired", func(c *fiber.Ctx) error {
		return domain.ErrBookingExpired
	})
	app.Get("/conflict", func(c *fiber.Ctx) error {
		return domain.ErrUsernameTaken
	})
	app.Get("/business", func(c *fiber.Ctx) error {
		return domain.ErrInvalidEventState
	})
	app.Get("/fiber-error", func(c *fiber.Ctx) error {
		return fiber.NewError(fiber.StatusBadRequest, "bad request")
	})
	app.Get("/internal", func(c *fiber.Ctx) error {
		return errors.New("unexpected")
	})

	tests := []struct {
		path       string
		wantStatus int
	}{
		{"/not-found", 404},
		{"/unauthorized", 401},
		{"/forbidden", 403},
		{"/capacity", 409},
		{"/booking-not-pending", 409},
		{"/booking-expired", 422},
		{"/conflict", 409},
		{"/business", 422},
		{"/fiber-error", 400},
		{"/internal", 500},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			resp, _ := app.Test(httptest.NewRequest("GET", tt.path, nil))
			if resp.StatusCode != tt.wantStatus {
				t.Fatalf("expected %d, got %d", tt.wantStatus, resp.StatusCode)
			}
		})
	}
}

func TestCORS(t *testing.T) {
	app := fiber.New()
	app.Use(CORS("https://example.com"))
	app.Get("/", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("OPTIONS", "/", nil)
	req.Header.Set("Origin", "https://example.com")
	req.Header.Set("Access-Control-Request-Method", "GET")
	resp, _ := app.Test(req)
	if resp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected 204 for preflight, got %d", resp.StatusCode)
	}
	if resp.Header.Get("Access-Control-Allow-Origin") != "https://example.com" {
		t.Fatalf("expected CORS origin header")
	}
}

func TestRequestID(t *testing.T) {
	app := fiber.New()
	app.Use(RequestID())
	app.Get("/", func(c *fiber.Ctx) error {
		rid := c.Locals("requestid")
		if rid == nil || rid == "" {
			t.Fatal("expected non-empty request ID")
		}
		return c.SendString("ok")
	})

	resp, _ := app.Test(httptest.NewRequest("GET", "/", nil))
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if resp.Header.Get("X-Request-ID") == "" {
		t.Fatal("expected X-Request-ID header")
	}
}

func signTestToken(t *testing.T, subject, role, tokenType, secret string) string {
	t.Helper()
	claims := JWTClaims{
		Role:      role,
		TokenType: tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   subject,
			ID:        "test-jti",
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	return signed
}
