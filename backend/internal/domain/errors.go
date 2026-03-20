package domain

import "errors"

// Sentinel errors used across the domain, mapped to HTTP/WebSocket responses by the handler layer.
var (
	// Generic.
	ErrNotFound     = errors.New("not found")
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")

	// Booking / capacity.
	ErrEventNotBookable = errors.New("event is not open for booking")
	ErrCapacityExceeded = errors.New("requested tickets exceed available capacity")

	// Registration / uniqueness.
	ErrUsernameTaken = errors.New("username already taken")
	ErrEmailTaken    = errors.New("email already taken")

	// Event lifecycle rules.
	ErrEventNotDeletable   = errors.New("event cannot be deleted after first booking")
	ErrEventNotCancellable = errors.New("event cannot be cancelled in current state")
	ErrInvalidEventState   = errors.New("event state is invalid for this operation")
	ErrTicketTypeLocked    = errors.New("ticket type cannot be modified because bookings exist")
)
