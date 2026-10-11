package domain

import (
	"errors"
	"fmt"
)

// Sentinel errors used across the domain, mapped to HTTP/WebSocket responses by the handler layer.
var (
	// Generic.
	ErrNotFound     = errors.New("not found")
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")

	// Booking / capacity.
	ErrEventNotBookable  = errors.New("event is not open for booking")
	ErrCapacityExceeded  = errors.New("requested tickets exceed available capacity")
	ErrBookingNotPending = errors.New("booking is no longer awaiting confirmation")
	ErrBookingExpired    = errors.New("booking hold has expired")

	// Registration / uniqueness.
	ErrUsernameTaken = errors.New("username already taken")
	ErrEmailTaken    = errors.New("email already taken")

	// Event lifecycle rules.
	ErrEventNotDeletable    = errors.New("event cannot be deleted after first booking")
	ErrEventNotCancellable  = errors.New("event cannot be cancelled in current state")
	ErrInvalidEventState    = errors.New("event state is invalid for this operation")
	ErrTicketTypeLocked     = errors.New("ticket type cannot be modified because bookings exist")
	ErrEventEnded           = errors.New("event has already ended")
	ErrEventNeedsCategory   = errors.New("event must have at least one category")
	ErrEventNeedsTicketType = errors.New("event must have at least one ticket type")
	ErrEventLocked          = errors.New("event can no longer be modified in its current state")

	// Roles.
	ErrInvalidRole = errors.New("role must be attendee or organizer")

	// Messaging.
	ErrMessagingNotAllowed = errors.New("messaging requires a booking between the two users")
)

// ValidationError is a user-correctable problem with submitted input. The HTTP
// layer maps it to 400 with the message shown to the user, so field-level
// feedback does not fall through to a generic 500.
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string { return e.Message }

// Invalid builds a ValidationError.
func Invalid(format string, args ...any) error {
	return &ValidationError{Message: fmt.Sprintf(format, args...)}
}
