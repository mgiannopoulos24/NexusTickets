package domain

import "testing"

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

