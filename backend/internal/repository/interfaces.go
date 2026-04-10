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

	// AfterStartAt and AfterID enable keyset pagination (DESC by start_time, id).
	// Both must be non-nil to use keyset; offset is ignored when keyset is used.
	AfterStartAt *time.Time
	AfterID      *uuid.UUID

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
	ListByIDs(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]domain.User, error)
}

type EventRepository interface {
	Create(ctx context.Context, event domain.Event) (domain.Event, error)
	GetByID(ctx context.Context, id uuid.UUID) (domain.Event, error)

	ListOrganizer(ctx context.Context, organizerID uuid.UUID, limit, offset int) ([]domain.Event, error)
	ListPublic(ctx context.Context, limit, offset int) ([]domain.Event, error)

	Search(ctx context.Context, params SearchEventsParams, limit, offset int) (events []domain.Event, hasMore bool, err error)

	Update(ctx context.Context, event domain.Event) (domain.Event, error)
	Delete(ctx context.Context, id uuid.UUID) error

	SetStatus(ctx context.Context, id uuid.UUID, status domain.EventStatus) error

	SetCategories(ctx context.Context, eventID uuid.UUID, categoryIDs []uuid.UUID) error
	GetCategories(ctx context.Context, eventID uuid.UUID) ([]domain.Category, error)

	SetTicketTypes(ctx context.Context, eventID uuid.UUID, ticketTypes []domain.TicketType) error
	GetTicketTypes(ctx context.Context, eventID uuid.UUID) ([]domain.TicketType, error)

	GetPhotos(ctx context.Context, eventID uuid.UUID) ([]domain.EventPhoto, error)

	// ListForExport returns all events ordered by start_time, id (admin catalogue export).
	ListForExport(ctx context.Context, limit, offset int) ([]domain.Event, error)
	ListTicketTypesByEventIDs(ctx context.Context, eventIDs []uuid.UUID) (map[uuid.UUID][]domain.TicketType, error)
	ListCategoriesByEventIDs(ctx context.Context, eventIDs []uuid.UUID) (map[uuid.UUID][]domain.Category, error)
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
	CreateBookingWithDecrement(ctx context.Context, booking domain.Booking, ticketTypeID uuid.UUID, quantity int) (domain.Booking, error)
	GetByID(ctx context.Context, id uuid.UUID) (domain.Booking, error)

	ListByUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.Booking, error)
	ListByEvent(ctx context.Context, eventID uuid.UUID, limit, offset int) ([]domain.Booking, error)
	ListConfirmedByEvent(ctx context.Context, eventID uuid.UUID, limit, offset int) ([]domain.Booking, error)
	ListDistinctConfirmedUserIDsByEvent(ctx context.Context, eventID uuid.UUID) ([]uuid.UUID, error)
	ListByEventIDs(ctx context.Context, eventIDs []uuid.UUID) ([]domain.Booking, error)
	CountByTicketType(ctx context.Context, ticketTypeID uuid.UUID) (int, error)

	SetStatus(ctx context.Context, bookingID uuid.UUID, status domain.BookingStatus) error
}

type MessageRepository interface {
	Create(ctx context.Context, message domain.Message) (domain.Message, error)
	CreateBatch(ctx context.Context, messages []domain.Message) ([]domain.Message, error)

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

type ChatRoomRepository interface {
	CreateRoom(ctx context.Context, room domain.ChatRoom) (domain.ChatRoom, error)
	GetRoomByID(ctx context.Context, id uuid.UUID) (domain.ChatRoom, error)
	GetOrCreateDirectRoom(ctx context.Context, user1ID, user2ID uuid.UUID) (domain.ChatRoom, error)
	GetRoomByEvent(ctx context.Context, eventID uuid.UUID) (domain.ChatRoom, error)
	ListUserRooms(ctx context.Context, userID uuid.UUID) ([]domain.Conversation, error)

	AddParticipant(ctx context.Context, p domain.ChatRoomParticipant) error
	RemoveParticipant(ctx context.Context, roomID, userID uuid.UUID) error
	GetParticipants(ctx context.Context, roomID uuid.UUID) ([]domain.ChatRoomParticipant, error)

	CreateMessage(ctx context.Context, msg domain.ChatMessage) (domain.ChatMessage, error)
	GetMessages(ctx context.Context, roomID uuid.UUID, limit, offset int) ([]domain.ChatMessage, error)
	GetMessageByID(ctx context.Context, id uuid.UUID) (domain.ChatMessage, error)

	AddReaction(ctx context.Context, r domain.MessageReaction) (domain.MessageReaction, error)
	RemoveReaction(ctx context.Context, messageID, userID uuid.UUID, reactionType string) error
	GetReactions(ctx context.Context, messageID uuid.UUID) ([]domain.MessageReaction, error)
}
