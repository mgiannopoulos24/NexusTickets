package domain

// UserRole represents the role stored in the users table (and embedded into JWT claims).
type UserRole string

const (
	UserRoleAdmin     UserRole = "admin"
	UserRoleOrganizer UserRole = "organizer"
	UserRoleAttendee  UserRole = "attendee"
	UserRoleGuest     UserRole = "guest"
)

// AccountStatus represents the registration approval status stored in users.account_status.
type AccountStatus string

const (
	AccountStatusPending  AccountStatus = "pending"
	AccountStatusApproved AccountStatus = "approved"
	AccountStatusRejected AccountStatus = "rejected"
)

// EventStatus represents the event lifecycle state stored in events.status.
type EventStatus string

const (
	EventStatusDraft     EventStatus = "draft"
	EventStatusPublished EventStatus = "published"
	EventStatusCancelled EventStatus = "cancelled"

	// EventStatusCompleted is the terminal state of a published event whose
	// EndAt has passed. Set by the completion sweeper, never by a client.
	EventStatusCompleted EventStatus = "completed"

	// EventStatusDeleted is retained for rows written before soft-deletion was
	// replaced by hard deletion; nothing writes it any more.
	EventStatusDeleted EventStatus = "deleted"
)

// ValidEventStatus reports whether s is one of the four lifecycle states from
// the assignment (DRAFT, PUBLISHED, COMPLETED, CANCELLED).
func ValidEventStatus(s EventStatus) bool {
	switch s {
	case EventStatusDraft, EventStatusPublished, EventStatusCompleted, EventStatusCancelled:
		return true
	default:
		return false
	}
}

// ValidAssignableRole reports whether r is a role an account may hold or be
// switched to at registration / by an admin. The guest role is never persisted.
func ValidAssignableRole(r UserRole) bool {
	switch r {
	case UserRoleAttendee, UserRoleOrganizer:
		return true
	default:
		return false
	}
}

// BookingStatus represents the booking lifecycle stored in bookings.status.
type BookingStatus string

const (
	BookingStatusPending   BookingStatus = "pending"
	BookingStatusConfirmed BookingStatus = "confirmed"
	BookingStatusCancelled BookingStatus = "cancelled"
)
