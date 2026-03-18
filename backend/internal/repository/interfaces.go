package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"nexustickets/internal/domain"
)

type SearchEventsParams struct {
	CategoryIDs []uuid.UUID
	Title       string
	FullText    string
	City        string

	StartAt *time.Time
	EndAt   *time.Time

	MinPrice *float64
	MaxPrice *float64

	// Status filter is typically used to restrict results to PUBLISHED events.
	Status domain.EventStatus
}

type UserRepository interface {
	GetByID(ctx context.Context, id uuid.UUID) (domain.User, error)
	GetByUsername(ctx context.Context, username string) (domain.User, error)
	GetByEmail(ctx context.Context, email string) (domain.User, error)

	Create(ctx context.Context, user domain.User) (domain.User, error)
	UpdateProfile(ctx context.Context, user domain.User) (domain.User, error)

	Approve(ctx context.Context, id uuid.UUID) (domain.User, error)
	Reject(ctx context.Context, id uuid.UUID) (domain.User, error)

	List(ctx context.Context, limit, offset int) ([]domain.User, error)
}

type EventRepository interface {
	Create(ctx context.Context, event domain.Event) (domain.Event, error)
	GetByID(ctx context.Context, id uuid.UUID) (domain.Event, error)

	ListOrganizer(ctx context.Context, organizerID uuid.UUID, limit, offset int) ([]domain.Event, error)
	ListPublic(ctx context.Context, limit, offset int) ([]domain.Event, error)

	Search(ctx context.Context, params SearchEventsParams, limit, offset int) ([]domain.Event, error)

	Update(ctx context.Context, event domain.Event) (domain.Event, error)
	Delete(ctx context.Context, id uuid.UUID) error

	SetStatus(ctx context.Context, id uuid.UUID, status domain.EventStatus) error

	SetCategories(ctx context.Context, eventID uuid.UUID, categoryIDs []uuid.UUID) error
	GetCategories(ctx context.Context, eventID uuid.UUID) ([]domain.Category, error)

	SetTicketTypes(ctx context.Context, eventID uuid.UUID, ticketTypes []domain.TicketType) error
	GetTicketTypes(ctx context.Context, eventID uuid.UUID) ([]domain.TicketType, error)

	GetPhotos(ctx context.Context, eventID uuid.UUID) ([]domain.EventPhoto, error)
}

type TicketTypeRepository interface {
	Create(ctx context.Context, ticketType domain.TicketType) (domain.TicketType, error)
	GetByID(ctx context.Context, id uuid.UUID) (domain.TicketType, error)
	ListByEvent(ctx context.Context, eventID uuid.UUID) ([]domain.TicketType, error)

	Update(ctx context.Context, ticketType domain.TicketType) (domain.TicketType, error)
	Delete(ctx context.Context, id uuid.UUID) error

	DecrementAvailabilityAtomic(ctx context.Context, ticketTypeID uuid.UUID, quantity int) (bool, error)
}

type BookingRepository interface {
	Create(ctx context.Context, booking domain.Booking) (domain.Booking, error)
	GetByID(ctx context.Context, id uuid.UUID) (domain.Booking, error)

	ListByUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.Booking, error)
	ListByEvent(ctx context.Context, eventID uuid.UUID, limit, offset int) ([]domain.Booking, error)
	ListConfirmedByEvent(ctx context.Context, eventID uuid.UUID, limit, offset int) ([]domain.Booking, error)

	SetStatus(ctx context.Context, bookingID uuid.UUID, status domain.BookingStatus) error
}

type MessageRepository interface {
	Create(ctx context.Context, message domain.Message) (domain.Message, error)

	ListInbox(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.Message, error)
	ListSent(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.Message, error)

	DeleteForUser(ctx context.Context, messageID uuid.UUID, userID uuid.UUID) error

	MarkAsRead(ctx context.Context, userID uuid.UUID) error
	GetUnreadCount(ctx context.Context, userID uuid.UUID) (int, error)
}

type CategoryRepository interface {
	Create(ctx context.Context, category domain.Category) (domain.Category, error)
	GetByID(ctx context.Context, id uuid.UUID) (domain.Category, error)
	GetByName(ctx context.Context, name string) (domain.Category, error)
	ListAll(ctx context.Context) ([]domain.Category, error)
}

type EventPhotoRepository interface {
	Add(ctx context.Context, photo domain.EventPhoto) (domain.EventPhoto, error)
	ListByEvent(ctx context.Context, eventID uuid.UUID) ([]domain.EventPhoto, error)
	Delete(ctx context.Context, photoID uuid.UUID) error
}

type UserEventViewRepository interface {
	Record(ctx context.Context, userID, eventID uuid.UUID) error
	CountByEvent(ctx context.Context, eventID uuid.UUID) (int, error)
}

