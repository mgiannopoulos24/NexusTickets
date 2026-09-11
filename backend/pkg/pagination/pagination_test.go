package pagination

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestFromQuery_Defaults(t *testing.T) {
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error {
		p, err := FromQuery(c, 20, 100)
		if err != nil {
			return err
		}
		if p.Page != 1 {
			t.Fatalf("expected page 1, got %d", p.Page)
		}
		if p.Limit != 20 {
			t.Fatalf("expected limit 20, got %d", p.Limit)
		}
		return nil
	})

	resp, _ := app.Test(httptest.NewRequest("GET", "/", nil))
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestFromQuery_Custom(t *testing.T) {
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error {
		p, err := FromQuery(c, 20, 100)
		if err != nil {
			return err
		}
		if p.Page != 3 {
			t.Fatalf("expected page 3, got %d", p.Page)
		}
		if p.Limit != 15 {
			t.Fatalf("expected limit 15, got %d", p.Limit)
		}
		return nil
	})

	resp, _ := app.Test(httptest.NewRequest("GET", "/?page=3&limit=15", nil))
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestFromQuery_MaxLimit(t *testing.T) {
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error {
		p, err := FromQuery(c, 20, 50)
		if err != nil {
			return err
		}
		if p.Limit != 50 {
			t.Fatalf("expected limit 50 (capped), got %d", p.Limit)
		}
		return nil
	})

	resp, _ := app.Test(httptest.NewRequest("GET", "/?limit=999", nil))
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestFromQuery_InvalidPage(t *testing.T) {
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error {
		_, err := FromQuery(c, 20, 100)
		return err
	})

	resp, _ := app.Test(httptest.NewRequest("GET", "/?page=-1", nil))
	if resp.StatusCode != fiber.StatusInternalServerError {
		t.Fatalf("expected 500 for invalid page, got %d", resp.StatusCode)
	}
}

func TestBuildMeta(t *testing.T) {
	tests := []struct {
		name      string
		page, lim int
		total     int
		wantPages int
	}{
		{"empty", 1, 20, 0, 0},
		{"one page", 1, 20, 15, 1},
		{"exact", 1, 10, 10, 1},
		{"two pages", 1, 10, 15, 2},
		{"many pages", 2, 10, 100, 10},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := Params{Page: tt.page, Limit: tt.lim}
			m := BuildMeta(p, tt.total)
			if m.Page != tt.page {
				t.Fatalf("expected page %d, got %d", tt.page, m.Page)
			}
			if m.Limit != tt.lim {
				t.Fatalf("expected limit %d, got %d", tt.lim, m.Limit)
			}
			if m.TotalItems != tt.total {
				t.Fatalf("expected total %d, got %d", tt.total, m.TotalItems)
			}
			if m.TotalPages != tt.wantPages {
				t.Fatalf("expected pages %d, got %d", tt.wantPages, m.TotalPages)
			}
		})
	}
}
