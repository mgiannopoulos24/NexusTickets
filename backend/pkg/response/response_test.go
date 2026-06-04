package response

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestOK(t *testing.T) {
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error {
		return OK(c, map[string]string{"hello": "world"})
	})

	resp, err := app.Test(httptest.NewRequest("GET", "/", nil))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var env Envelope[map[string]string]
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		t.Fatal(err)
	}
	if env.Data["hello"] != "world" {
		t.Fatalf("expected 'world', got %s", env.Data["hello"])
	}
	if env.Error != nil {
		t.Fatalf("expected nil error, got %v", env.Error)
	}
}

func TestCreated(t *testing.T) {
	app := fiber.New()
	app.Post("/", func(c *fiber.Ctx) error {
		return Created(c, map[string]int{"id": 42})
	})

	resp, err := app.Test(httptest.NewRequest("POST", "/", nil))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}
}

func TestError(t *testing.T) {
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error {
		return Error(c, fiber.StatusNotFound, "not_found", "resource not found")
	})

	resp, err := app.Test(httptest.NewRequest("GET", "/", nil))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.StatusCode)
	}

	var env Envelope[any]
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		t.Fatal(err)
	}
	if env.Data != nil {
		t.Fatalf("expected nil data, got %v", env.Data)
	}
	if env.Error == nil {
		t.Fatal("expected non-nil error")
	}
	if env.Error.Code != "not_found" {
		t.Fatalf("expected code 'not_found', got %s", env.Error.Code)
	}
	if env.Error.Message != "resource not found" {
		t.Fatalf("expected message 'resource not found', got %s", env.Error.Message)
	}
}

func TestPaginated(t *testing.T) {
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error {
		return Paginated(c, []string{"a"}, map[string]int{"page": 1, "total": 1})
	})

	resp, err := app.Test(httptest.NewRequest("GET", "/", nil))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var env Envelope[[]string]
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		t.Fatal(err)
	}
	if len(env.Data) != 1 || env.Data[0] != "a" {
		t.Fatalf("expected [a], got %v", env.Data)
	}
	meta, ok := env.Meta.(map[string]interface{})
	if !ok || meta["page"].(float64) != 1 {
		t.Fatalf("expected page 1 in meta")
	}
}

func TestAPIError_JSON(t *testing.T) {
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error {
		return Error(c, fiber.StatusBadRequest, "validation_error", "invalid input")
	})

	resp, err := app.Test(httptest.NewRequest("GET", "/", nil))
	if err != nil {
		t.Fatal(err)
	}

	var env Envelope[any]
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		t.Fatal(err)
	}
	if env.Error == nil || env.Error.Code != "validation_error" {
		t.Fatalf("expected validation_error, got %v", env.Error)
	}
}
