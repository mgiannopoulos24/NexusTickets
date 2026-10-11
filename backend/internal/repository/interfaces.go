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
	SetRole(ctx context.Context, id uuid.UUID, role domain.UserRole) (domain.User, error)
	ListByRole(ctx context.Context, role domain.UserRole) ([]domain.User, error)

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
	// MarkCompleted transitions published events that ended before `before`
	// into the COMPLETED state. Returns the number of rows updated.
	MarkCompleted(ctx context.Context, before time.Time) (int64, error)

	SetCategories(ctx context.Context, eventID uuid.UUID, categoryIDs []uuid.UUID) error
	GetCategories(ctx context.Context, eventID uuid.UUID) ([]domain.Category, error)

	SetTicketTypes(ctx context.Context, eventID uuid.UUID, ticketTypes []domain.TicketType) error
	GetTicketTypes(ctx context.Context, eventID uuid.UUID) ([]domain.TicketType, error)

	GetPhotos(ctx context.Context, eventID uuid.UUID) ([]domain.EventPhoto, error)

	// ListForExport returns all events ordered by start_time, id (admin catalogue export).
	ListForExport(ctx context.Context, limit, offset int) ([]domain.Event, error)
	// ListAdmin pages every event for the administration, optionally narrowed
	// by a free-text query (title, venue, city) and a status, most recently
	// created first. Returns the total matching rows for pagination.
	ListAdmin(ctx context.Context, q string, status *domain.EventStatus, limit, offset int) ([]domain.Event, int, error)
	ListTicketTypesByEventIDs(ctx context.Context, eventIDs []uuid.UUID) (map[uuid.UUID][]domain.TicketType, error)
	ListCategoriesByEventIDs(ctx context.Context, eventIDs []uuid.UUID) (map[uuid.UUID][]domain.Category, error)
	ListPhotosByEventIDs(ctx context.Context, eventIDs []uuid.UUID) (map[uuid.UUID][]domain.EventPhoto, error)

	// ListBookableOrganizerIDs returns the organizers of every published event
	// that has not ended by `now`: the events anyone can still attend.
	ListBookableOrganizerIDs(ctx context.Context, now time.Time) ([]uuid.UUID, error)
	// OrganizesBookableEvent reports whether the user runs at least one such
	// event.
	OrganizesBookableEvent(ctx context.Context, organizerID uuid.UUID, now time.Time) (bool, error)
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
	// ListDistinctConfirmedUserIDsByEvent returns everyone holding a confirmed
	// booking for the event, including bookings cancelled with the event.
	ListDistinctConfirmedUserIDsByEvent(ctx context.Context, eventID uuid.UUID) ([]uuid.UUID, error)
	ListByEventIDs(ctx context.Context, eventIDs []uuid.UUID) ([]domain.Booking, error)
	// ListAllConfirmed returns every booking that was confirmed. Used to build
	// the recommendation training matrix (a strong implicit-feedback signal).
	ListAllConfirmed(ctx context.Context) ([]domain.Booking, error)
	// CountByTicketType counts the pending and confirmed bookings on a ticket
	// type; lapsed holds do not lock it.
	CountByTicketType(ctx context.Context, ticketTypeID uuid.UUID) (int, error)
	// CountActiveByEvent counts the pending and confirmed bookings on an event.
	CountActiveByEvent(ctx context.Context, eventID uuid.UUID) (int, error)
	// ExistsBetweenAttendeeAndOrganizer reports whether the attendee has a
	// confirmed booking on any event run by the organizer. Gates direct
	// messaging.
	ExistsBetweenAttendeeAndOrganizer(ctx context.Context, attendeeID, organizerID uuid.UUID) (bool, error)
	// ListCorrespondentIDs returns every user the given user shares a
	// confirmed booking with, in either direction.
	ListCorrespondentIDs(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error)

	// Confirm moves a PENDING booking created after holdCutoff to CONFIRMED.
	// It returns ErrBookingNotPending if the booking is not such a hold.
	Confirm(ctx context.Context, bookingID uuid.UUID, holdCutoff time.Time) (domain.Booking, error)
	// Release moves a PENDING booking to CANCELLED and puts its seats back on
	// sale. It returns ErrBookingNotPending if the booking is not pending.
	Release(ctx context.Context, bookingID uuid.UUID) error
	// ReleaseExpired releases every PENDING booking created at or before
	// holdCutoff and returns how many it released.
	ReleaseExpired(ctx context.Context, holdCutoff time.Time) (int64, error)
	// CancelByEvent cancels every pending or confirmed booking on the event,
	// returning the seats of the pending ones.
	CancelByEvent(ctx context.Context, eventID uuid.UUID) error
}

type MessageRepository interface {
	Create(ctx context.Context, message domain.Message) (domain.Message, error)
	CreateBatch(ctx context.Context, messages []domain.Message) ([]domain.Message, error)
	GetByID(ctx context.Context, messageID uuid.UUID) (domain.Message, error)

	// ListInbox and ListSent page one folder newest first, skipping what the
	// user deleted from it, and report the folder's total for pagination.
	ListInbox(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.Message, int, error)
	ListSent(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.Message, int, error)

	// MarkAsRead stamps read_at on a message the user received. It reports
	// whether the row changed, so an already-read message is a no-op.
	MarkAsRead(ctx context.Context, messageID, userID uuid.UUID) (bool, error)
	// DeleteForUser hides the message from the caller's own folder only.
	DeleteForUser(ctx context.Context, messageID, userID uuid.UUID) error
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
	// ListAll returns every recorded view. Used as a weak implicit-feedback
	// signal for the recommendation training matrix.
	ListAll(ctx context.Context) ([]domain.UserEventView, error)
}

type SupportRepository interface {
	// CreateTicket stores the ticket and its opening message atomically.
	CreateTicket(ctx context.Context, ticket domain.SupportTicket, opening domain.SupportMessage) (domain.SupportTicket, error)
	GetTicket(ctx context.Context, ticketID uuid.UUID) (domain.SupportTicket, error)
	// ListTicketsByUser pages one user's tickets, most recently active first.
	ListTicketsByUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.SupportTicket, int, error)
	// ListTickets pages every ticket (admin view), optionally by status.
	ListTickets(ctx context.Context, status *domain.SupportTicketStatus, limit, offset int) ([]domain.SupportTicket, int, error)
	CountTicketsByStatus(ctx context.Context) (map[domain.SupportTicketStatus]int, error)

	// AddMessage appends to the thread and moves the ticket to `status`,
	// bumping its updated_at.
	AddMessage(ctx context.Context, message domain.SupportMessage, status domain.SupportTicketStatus) (domain.SupportMessage, error)
	ListMessages(ctx context.Context, ticketID uuid.UUID) ([]domain.SupportMessage, error)
	SetTicketStatus(ctx context.Context, ticketID uuid.UUID, status domain.SupportTicketStatus) error
}
