package domain

import (
	"time"

	"github.com/google/uuid"
)

// User represents a platform account persisted in the users table.
type User struct {
	ID uuid.UUID

	Username string
	// PasswordHash is stored in the database, but must never be returned in any API response DTOs.
	PasswordHash string

	FirstName string
	LastName  string
	Email     string
	PhotoURL  *string

	Phone     *string
	Address   *string
	City      *string
	Country   *string
	Latitude  *float64
	Longitude *float64

	VATNumber *string

	Role          UserRole
	AccountStatus AccountStatus

	CreatedAt time.Time
	UpdatedAt time.Time
}

// Event represents an event persisted in the events table.
type Event struct {
	ID uuid.UUID

	OrganizerID uuid.UUID
	Organizer   *User

	Title       string
	Description string
	Venue       string
	// EventType is the DTD's <EventType> (e.g. "concert", "conference"). It is
	// distinct from Categories, which is a many-valued taxonomy.
	EventType        string
	FeaturedImageURL *string
	Detail           EventDetail

	Address *string
	City    string
	Country *string

	Latitude  *float64
	Longitude *float64

	StartAt   time.Time
	EndAt     time.Time
	Capacity  int
	Status    EventStatus
	CreatedAt time.Time
	UpdatedAt time.Time

	TicketTypes []TicketType
	Bookings    []Booking
	Photos      []EventPhoto
}

// TicketType represents a ticket category belonging to an event.
type TicketType struct {
	ID uuid.UUID

	EventID uuid.UUID
	Event   *Event

	Name      string
	Price     float64
	Quantity  int
	Available int

	CreatedAt time.Time
	UpdatedAt time.Time
}

// Booking represents a reservation for a given ticket type.
type Booking struct {
	ID uuid.UUID

	UserID uuid.UUID
	User   *User

	EventID      uuid.UUID
	Event        *Event
	TicketTypeID uuid.UUID
	TicketType   *TicketType

	Quantity  int
	TotalCost float64
	Status    BookingStatus

	CreatedAt time.Time
	UpdatedAt time.Time
}

// Message is one entry of a user's mailbox (assignment §10): a note from one
// user to another, filed under the sender's "sent" and the recipient's
// "inbox". Each side can drop it from their own folder without affecting the
// other's copy.
type Message struct {
	ID uuid.UUID

	SenderID    uuid.UUID
	RecipientID uuid.UUID

	// EventID is the event the message is about, when there is one: a question
	// about a booking, or an organizer's notice to everyone who booked.
	EventID *uuid.UUID

	Subject string
	Body    string

	// ReadAt is set the first time the recipient opens the message.
	ReadAt *time.Time

	DeletedBySender    bool
	DeletedByRecipient bool

	CreatedAt time.Time
}

// IsUnread reports whether the recipient has not opened the message yet.
func (m Message) IsUnread() bool { return m.ReadAt == nil }

// Category represents an event category (taxonomy).
type Category struct {
	ID uuid.UUID
	// Name is unique and used for categorization.
	Name string
	// CreatedAt is the timestamp when the category was created.
	CreatedAt time.Time
}

// EventPhoto represents an uploaded event gallery item.
type EventPhoto struct {
	ID uuid.UUID

	EventID uuid.UUID
	Event   *Event

	StoragePath string
	Position    int

	CreatedAt time.Time
}

// UserEventView records that a user viewed an event's detail page. It is an
// implicit-feedback signal consumed by the recommendation engine.
type UserEventView struct {
	UserID   uuid.UUID
	EventID  uuid.UUID
	ViewedAt time.Time
}
