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

// Message represents an inbox/sent message between users.
type Message struct {
	ID uuid.UUID

	SenderID    uuid.UUID
	RecipientID uuid.UUID

	Subject string
	Body    string

	// Attachments. A message carries at most one of these; the body is then
	// optional and acts as a caption.
	ImageURL string
	FileURL  string
	FileName string
	GifURL   string

	// ReplyToID quotes an earlier message in the same thread.
	ReplyToID *uuid.UUID
	// ReplyTo is the quoted message, filled in when a thread is rendered.
	ReplyTo *MessagePreview

	Reactions []MailboxReaction

	ReadAt *time.Time

	DeletedBySender    bool
	DeletedByRecipient bool
	// DeletedForEveryone leaves a tombstone both sides can see, instead of the
	// message quietly vanishing from one mailbox.
	DeletedForEveryone bool

	CreatedAt time.Time
}

// MessagePreview is the one-line quote shown above a reply.
type MessagePreview struct {
	ID       string
	SenderID uuid.UUID
	Body     string
	Deleted  bool
}

// MailboxReaction is one emoji a user put on a mailbox message. (The chat
// subsystem has its own MessageReaction; these are separate tables.)
type MailboxReaction struct {
	ID        uuid.UUID
	MessageID uuid.UUID
	UserID    uuid.UUID
	Emoji     string
	CreatedAt time.Time
}

// HasAttachment reports whether the message carries media instead of, or
// alongside, a text body.
func (m Message) HasAttachment() bool {
	return m.ImageURL != "" || m.FileURL != "" || m.GifURL != ""
}

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
