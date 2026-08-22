package domain

import (
	"errors"
	"testing"
)

func TestSentinelErrorMessages(t *testing.T) {
	tests := []struct {
		name string
		got  error
		want string
	}{
		{"ErrNotFound", ErrNotFound, "not found"},
		{"ErrUnauthorized", ErrUnauthorized, "unauthorized"},
		{"ErrForbidden", ErrForbidden, "forbidden"},
		{"ErrEventNotBookable", ErrEventNotBookable, "event is not open for booking"},
		{"ErrCapacityExceeded", ErrCapacityExceeded, "requested tickets exceed available capacity"},
		{"ErrUsernameTaken", ErrUsernameTaken, "username already taken"},
		{"ErrEmailTaken", ErrEmailTaken, "email already taken"},
		{"ErrEventNotDeletable", ErrEventNotDeletable, "event cannot be deleted after first booking"},
		{"ErrEventNotCancellable", ErrEventNotCancellable, "event cannot be cancelled in current state"},
		{"ErrInvalidEventState", ErrInvalidEventState, "event state is invalid for this operation"},
		{"ErrTicketTypeLocked", ErrTicketTypeLocked, "ticket type cannot be modified because bookings exist"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.got == nil {
				t.Fatalf("expected non-nil error")
			}
			if tt.got.Error() != tt.want {
				t.Fatalf("expected %q, got %q", tt.want, tt.got.Error())
			}
		})
	}
}

func TestSentinelErrorsAreDistinct(t *testing.T) {
	seen := make(map[string]string)
	for _, tt := range []struct {
		name string
		err  error
	}{
		{"ErrNotFound", ErrNotFound},
		{"ErrUnauthorized", ErrUnauthorized},
		{"ErrForbidden", ErrForbidden},
		{"ErrEventNotBookable", ErrEventNotBookable},
		{"ErrCapacityExceeded", ErrCapacityExceeded},
		{"ErrUsernameTaken", ErrUsernameTaken},
		{"ErrEmailTaken", ErrEmailTaken},
		{"ErrEventNotDeletable", ErrEventNotDeletable},
		{"ErrEventNotCancellable", ErrEventNotCancellable},
		{"ErrInvalidEventState", ErrInvalidEventState},
		{"ErrTicketTypeLocked", ErrTicketTypeLocked},
	} {
		if prev, ok := seen[tt.err.Error()]; ok {
			t.Fatalf("%s has duplicate message with %s: %q", tt.name, prev, tt.err.Error())
		}
		seen[tt.err.Error()] = tt.name
	}
}

func TestSentinelErrorWrapping(t *testing.T) {
	err := ErrNotFound
	if !errors.Is(err, ErrNotFound) {
		t.Fatal("expected errors.Is(ErrNotFound, ErrNotFound)")
	}
	if errors.Is(err, ErrCapacityExceeded) {
		t.Fatal("expected errors.Is(ErrNotFound, ErrCapacityExceeded) to be false")
	}
}
