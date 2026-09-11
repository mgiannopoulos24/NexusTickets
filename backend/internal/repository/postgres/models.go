package postgres

import (
	"time"

	"github.com/google/uuid"
)

type UserModel struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey"`

	Username string `gorm:"not null;size:255;unique"`
	Password string `gorm:"not null;column:password_hash"`

	FirstName string `gorm:"not null;size:255"`
	LastName  string `gorm:"not null;size:255"`
	Email     string `gorm:"not null;size:255;unique"`

	Phone   *string `gorm:"size:64"`
	Address *string `gorm:"size:255"`
	City    *string `gorm:"size:128"`
	Country *string `gorm:"size:128"`

	Latitude  *float64 `gorm:"type:double precision"`
	Longitude *float64 `gorm:"type:double precision"`

	VATNumber *string `gorm:"size:64;column:vat_number"`

	Role          string `gorm:"not null;size:32"`
	AccountStatus string `gorm:"not null;size:32;index"`

	CreatedAt time.Time `gorm:"not null;default:now()"`
	UpdatedAt time.Time `gorm:"not null;default:now()"`
}

func (UserModel) TableName() string { return "users" }

type EventModel struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey"`

	OrganizerID uuid.UUID `gorm:"type:uuid;not null;index"`

	Title            string  `gorm:"not null;size:255"`
	Description      string  `gorm:"not null"`
	Venue            string  `gorm:"not null;size:255"`
	EventType        string  `gorm:"not null;size:128;default:'';column:event_type;index"`
	FeaturedImageURL *string `gorm:"column:featured_image_url"`
	EventDetail      []byte  `gorm:"column:event_detail;type:jsonb"`

	Address *string `gorm:"size:255"`
	City    string  `gorm:"not null;size:128;index"`
	Country *string `gorm:"size:128"`

	Latitude  *float64 `gorm:"type:double precision"`
	Longitude *float64 `gorm:"type:double precision"`

	StartAt  time.Time `gorm:"column:start_time;not null"`
	EndAt    time.Time `gorm:"column:end_time;not null"`
	Capacity int       `gorm:"not null"`

	Status string `gorm:"not null;size:32;index"`

	SearchVector string `gorm:"-"`

	CreatedAt time.Time `gorm:"not null;default:now()"`
	UpdatedAt time.Time `gorm:"not null;default:now()"`
}

func (EventModel) TableName() string { return "events" }

type EventCategoryModel struct {
	EventID    uuid.UUID `gorm:"type:uuid;primaryKey;column:event_id"`
	CategoryID uuid.UUID `gorm:"type:uuid;primaryKey;column:category_id"`
}

func (EventCategoryModel) TableName() string { return "event_categories" }

type TicketTypeModel struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey"`

	EventID uuid.UUID `gorm:"type:uuid;not null;index"`

	Name string `gorm:"not null;size:255"`

	Price float64 `gorm:"not null;type:numeric(12,2)"`

	Quantity  int `gorm:"not null"`
	Available int `gorm:"not null;index"`

	CreatedAt time.Time `gorm:"not null;default:now()"`
	UpdatedAt time.Time `gorm:"not null;default:now()"`
}

func (TicketTypeModel) TableName() string { return "ticket_types" }

type BookingModel struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey"`

	UserID       uuid.UUID `gorm:"type:uuid;not null;index"`
	EventID      uuid.UUID `gorm:"type:uuid;not null;index"`
	TicketTypeID uuid.UUID `gorm:"type:uuid;not null;index;column:ticket_type_id"`

	Quantity  int     `gorm:"not null"`
	TotalCost float64 `gorm:"not null;type:numeric(12,2)"`
	Status    string  `gorm:"not null;size:32;index"`

	CreatedAt time.Time `gorm:"not null;default:now()"`
	UpdatedAt time.Time `gorm:"not null;default:now()"`
}

func (BookingModel) TableName() string { return "bookings" }

type MessageModel struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey"`

	SenderID    uuid.UUID  `gorm:"type:uuid;not null;index"`
	RecipientID uuid.UUID  `gorm:"type:uuid;not null;index"`
	EventID     *uuid.UUID `gorm:"type:uuid;index"`

	Subject string `gorm:"not null"`
	Body    string `gorm:"not null"`

	ReadAt *time.Time `gorm:"column:read_at"`

	DeletedBySender    bool `gorm:"not null;default:false"`
	DeletedByRecipient bool `gorm:"not null;default:false"`

	CreatedAt time.Time `gorm:"not null;default:now()"`
}

func (MessageModel) TableName() string { return "messages" }

type CategoryModel struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey"`

	Name string `gorm:"not null;size:255;unique"`

	CreatedAt time.Time `gorm:"not null;default:now()"`
}

func (CategoryModel) TableName() string { return "categories" }

type EventPhotoModel struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey"`

	EventID uuid.UUID `gorm:"type:uuid;not null;index"`

	StoragePath string `gorm:"not null"`
	Position    int    `gorm:"not null;default:0"`

	CreatedAt time.Time `gorm:"not null;default:now()"`
}

func (EventPhotoModel) TableName() string { return "event_photos" }

type UserEventViewModel struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey"`

	UserID  uuid.UUID `gorm:"type:uuid;not null;index"`
	EventID uuid.UUID `gorm:"type:uuid;not null;index"`

	ViewedAt time.Time `gorm:"not null;default:now()"`
}

func (UserEventViewModel) TableName() string { return "user_event_views" }

type SupportTicketModel struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey"`

	UserID uuid.UUID `gorm:"type:uuid;not null;index"`

	Subject string `gorm:"not null;size:200"`
	Status  string `gorm:"not null;size:16;index"`

	CreatedAt time.Time `gorm:"not null;default:now()"`
	UpdatedAt time.Time `gorm:"not null;default:now()"`
}

func (SupportTicketModel) TableName() string { return "support_tickets" }

type SupportMessageModel struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey"`

	TicketID uuid.UUID `gorm:"type:uuid;not null;index"`
	AuthorID uuid.UUID `gorm:"type:uuid;not null"`

	Body string `gorm:"not null"`

	CreatedAt time.Time `gorm:"not null;default:now()"`
}

func (SupportMessageModel) TableName() string { return "support_ticket_messages" }
