package handler

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"nexustickets/internal/domain"
)

// ---------------------------------------------------------------------------
// Helper unit tests (no DB/mock needed)
// ---------------------------------------------------------------------------

func TestParsePage(t *testing.T) {
	tests := []struct {
		limit, offset      string
		wantLimit, wantOff int
		wantErr            bool
	}{
		{"", "", 20, 0, false},
		{"10", "", 10, 0, false},
		{"", "5", 20, 5, false},
		{"10", "5", 10, 5, false},
		{"-1", "", 0, 0, true},
		{"abc", "", 0, 0, true},
		{"", "-1", 0, 0, true},
	}
	for _, tt := range tests {
		l, o, err := parsePage(tt.limit, tt.offset)
		if tt.wantErr {
			if err == nil {
				t.Fatalf("expected error for limit=%q offset=%q", tt.limit, tt.offset)
			}
			continue
		}
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if l != tt.wantLimit || o != tt.wantOff {
			t.Fatalf("parsePage(%q,%q) = (%d,%d), want (%d,%d)", tt.limit, tt.offset, l, o, tt.wantLimit, tt.wantOff)
		}
	}
}

func TestParseUUIDList(t *testing.T) {
	id1 := uuid.New().String()
	id2 := uuid.New().String()
	for _, tt := range []struct {
		in   string
		want int
	}{
		{"", 0}, {id1, 1}, {id1 + "," + id2, 2}, {id1 + ",bad," + id2, 2},
	} {
		got := parseUUIDList(tt.in)
		if len(got) != tt.want {
			t.Fatalf("parseUUIDList(%q) = %d, want %d", tt.in, len(got), tt.want)
		}
	}
}

func TestOptionalRFC3339(t *testing.T) {
	if ts, err := optionalRFC3339(""); ts != nil || err != nil {
		t.Fatal("expected nil,nil")
	}
	if ts, err := optionalRFC3339("2026-06-01T10:00:00Z"); ts == nil || err != nil {
		t.Fatal("expected valid time")
	}
	if _, err := optionalRFC3339("bad"); err == nil {
		t.Fatal("expected error")
	}
}

func TestOptionalFloat(t *testing.T) {
	if f, err := optionalFloat(""); f != nil || err != nil {
		t.Fatal("expected nil,nil")
	}
	if f, err := optionalFloat("42.5"); err != nil || *f != 42.5 {
		t.Fatal("expected 42.5")
	}
	if _, err := optionalFloat("abc"); err == nil {
		t.Fatal("expected error")
	}
}

func TestOptionalAuthUserID(t *testing.T) {
	app := fiber.New()
	app.Get("/no-auth", func(c *fiber.Ctx) error {
		if _, ok := optionalAuthUserID(c); ok {
			t.Fatal("expected !ok")
		}
		return nil
	})
	resp, _ := app.Test(httptest.NewRequest("GET", "/no-auth", nil))
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	app.Get("/auth", func(c *fiber.Ctx) error {
		c.Locals("user_id", uuid.New().String())
		if _, ok := optionalAuthUserID(c); !ok {
			t.Fatal("expected ok")
		}
		return nil
	})
	resp, _ = app.Test(httptest.NewRequest("GET", "/auth", nil))
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestAuthUserID_Missing(t *testing.T) {
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error {
		_, err := authUserID(c)
		return err
	})
	resp, _ := app.Test(httptest.NewRequest("GET", "/", nil))
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestAuthUserID_Invalid(t *testing.T) {
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error {
		c.Locals("user_id", "not-a-uuid")
		_, err := authUserID(c)
		return err
	})
	resp2, _ := app.Test(httptest.NewRequest("GET", "/", nil))
	if resp2.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp2.StatusCode)
	}
}

func TestAuthUserRole_Missing(t *testing.T) {
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error {
		_, err := authUserRole(c)
		return err
	})
	resp, _ := app.Test(httptest.NewRequest("GET", "/", nil))
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestToMessageResponse_ReadAt(t *testing.T) {
	now := time.Now()
	msg := domain.Message{
		ID:          uuid.New(),
		SenderID:    uuid.New(),
		RecipientID: uuid.New(),
		Subject:     "test",
		Body:        "body",
		ReadAt:      &now,
		CreatedAt:   now,
	}
	resp := toMessageResponse(msg)
	if resp.ReadAt == nil {
		t.Fatal("expected non-nil ReadAt")
	}
	if resp.Subject != "test" {
		t.Fatalf("expected 'test', got %s", resp.Subject)
	}
}

func TestToMessageResponse_NilReadAt(t *testing.T) {
	msg := domain.Message{
		ID:          uuid.New(),
		SenderID:    uuid.New(),
		RecipientID: uuid.New(),
		Subject:     "test",
		Body:        "body",
		ReadAt:      nil,
		CreatedAt:   time.Now(),
	}
	resp := toMessageResponse(msg)
	if resp.ReadAt != nil {
		t.Fatal("expected nil ReadAt")
	}
}

func TestToBookingResponse_Lifecycle(t *testing.T) {
	created := time.Date(2026, 10, 11, 12, 0, 0, 0, time.UTC)
	base := domain.Booking{ID: uuid.New(), CreatedAt: created, UpdatedAt: created}

	pending := base
	pending.Status = domain.BookingStatusPending
	r := toBookingResponse(pending)
	if r.HoldExpiresAt == nil || *r.HoldExpiresAt != created.Add(domain.BookingHoldTTL).Format(time.RFC3339) {
		t.Fatalf("pending: hold_expires_at = %v", r.HoldExpiresAt)
	}
	if r.ConfirmedAt != nil {
		t.Fatalf("pending: confirmed_at = %v", *r.ConfirmedAt)
	}

	at := created.Add(time.Minute)
	confirmed := base
	confirmed.Status = domain.BookingStatusConfirmed
	confirmed.ConfirmedAt = &at
	r = toBookingResponse(confirmed)
	if r.HoldExpiresAt != nil {
		t.Fatalf("confirmed: hold_expires_at = %v", *r.HoldExpiresAt)
	}
	if r.ConfirmedAt == nil || *r.ConfirmedAt != at.Format(time.RFC3339) {
		t.Fatalf("confirmed: confirmed_at = %v", r.ConfirmedAt)
	}

	// Cancelled with its event: still shows when it was confirmed, no hold.
	cancelled := confirmed
	cancelled.Status = domain.BookingStatusCancelled
	r = toBookingResponse(cancelled)
	if r.Status != "cancelled" || r.ConfirmedAt == nil || r.HoldExpiresAt != nil {
		t.Fatalf("cancelled: %+v", r)
	}
}
