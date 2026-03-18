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

	// EventStatusDeleted maps to the current database check constraint value.
	EventStatusDeleted EventStatus = "deleted"

	// EventStatusCompleted matches the assignment wording ("Completed").
	// Current migrations use "deleted" as the final state value, so this constant
	// is mapped accordingly until the DB constraint is aligned.
	EventStatusCompleted EventStatus = EventStatusDeleted
)

// BookingStatus represents the booking lifecycle stored in bookings.status.
type BookingStatus string

const (
	BookingStatusPending   BookingStatus = "pending"
	BookingStatusConfirmed BookingStatus = "confirmed"
	BookingStatusCancelled BookingStatus = "cancelled"
)

