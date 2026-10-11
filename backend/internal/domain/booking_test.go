package domain

import (
	"testing"
	"time"
)

func TestBooking_HoldExpiresAt(t *testing.T) {
	created := time.Date(2026, 10, 11, 12, 0, 0, 0, time.UTC)
	b := Booking{CreatedAt: created}
	if got, want := b.HoldExpiresAt(), created.Add(BookingHoldTTL); !got.Equal(want) {
		t.Fatalf("HoldExpiresAt = %v, want %v", got, want)
	}
	if BookingHoldTTL <= 0 {
		t.Fatal("BookingHoldTTL must be positive")
	}
}

func TestBooking_WasConfirmed(t *testing.T) {
	at := time.Now()
	cases := []struct {
		name string
		b    Booking
		want bool
	}{
		{"pending hold", Booking{Status: BookingStatusPending}, false},
		{"released hold", Booking{Status: BookingStatusCancelled}, false},
		{"confirmed", Booking{Status: BookingStatusConfirmed, ConfirmedAt: &at}, true},
		{"cancelled with its event", Booking{Status: BookingStatusCancelled, ConfirmedAt: &at}, true},
	}
	for _, c := range cases {
		if got := c.b.WasConfirmed(); got != c.want {
			t.Errorf("%s: WasConfirmed = %v, want %v", c.name, got, c.want)
		}
	}
}
