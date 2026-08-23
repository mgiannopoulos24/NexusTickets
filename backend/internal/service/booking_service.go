package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"nexustickets/internal/domain"
	repo "nexustickets/internal/repository"
)

type BookingService struct {
	events      repo.EventRepository
	ticketTypes repo.TicketTypeRepository
	bookings    repo.BookingRepository
	users       repo.UserRepository
}

type CreateBookingInput struct {
	EventID      uuid.UUID
	TicketTypeID uuid.UUID
	Quantity     int
}

func NewBookingService(
	events repo.EventRepository,
	ticketTypes repo.TicketTypeRepository,
	bookings repo.BookingRepository,
	users repo.UserRepository,
) *BookingService {
	return &BookingService{
		events:      events,
		ticketTypes: ticketTypes,
		bookings:    bookings,
		users:       users,
	}
}

// CreateBooking validates the event is published, computes total_cost from ticket price, and
// creates the booking with atomic availability decrement.
func (s *BookingService) CreateBooking(ctx context.Context, userID uuid.UUID, role domain.UserRole, in CreateBookingInput) (domain.Booking, error) {
	// Guests browse only (§Εισαγωγή); every signed-in role may book. The route
	// and the event page allow the same set, so keep the three in step.
	switch role {
	case domain.UserRoleAttendee, domain.UserRoleOrganizer, domain.UserRoleAdmin:
	default:
		return domain.Booking{}, domain.ErrForbidden
	}

	if in.Quantity <= 0 {
		return domain.Booking{}, domain.ErrInvalidEventState
	}

	event, err := s.events.GetByID(ctx, in.EventID)
	if err != nil {
		return domain.Booking{}, err
	}
	if event.Status != domain.EventStatusPublished {
		return domain.Booking{}, domain.ErrEventNotBookable
	}
	// The completion sweeper runs on a ticker, so a just-finished event can
	// still read as published here. Check the clock as well as the status.
	if !event.EndAt.IsZero() && event.EndAt.Before(time.Now().UTC()) {
		return domain.Booking{}, domain.ErrEventEnded
	}

	tt, err := s.ticketTypes.GetByID(ctx, in.TicketTypeID)
	if err != nil {
		return domain.Booking{}, err
	}
	if tt.EventID != in.EventID {
		return domain.Booking{}, domain.ErrNotFound
	}

	totalCost := tt.Price * float64(in.Quantity)

	booking := domain.Booking{
		UserID:       userID,
		EventID:      in.EventID,
		TicketTypeID: in.TicketTypeID,
		Quantity:     in.Quantity,
		TotalCost:    totalCost,
		Status:       domain.BookingStatusConfirmed,
	}

	created, err := s.bookings.CreateBookingWithDecrement(ctx, booking, in.TicketTypeID, in.Quantity)
	if err != nil {
		if errors.Is(err, domain.ErrCapacityExceeded) {
			return domain.Booking{}, domain.ErrCapacityExceeded
		}
		return domain.Booking{}, err
	}
	return created, nil
}

// BookingContext carries the rows a set of bookings point at, looked up in a
// few batch queries rather than one per booking.
type BookingContext struct {
	Events      map[uuid.UUID]domain.Event
	TicketTypes map[uuid.UUID]domain.TicketType
	Attendees   map[uuid.UUID]domain.User
}

// HydrateBookings resolves the events, ticket types and attendees referenced by
// the given bookings so a list can be rendered in one round trip.
func (s *BookingService) HydrateBookings(ctx context.Context, bookings []domain.Booking) (BookingContext, error) {
	out := BookingContext{
		Events:      map[uuid.UUID]domain.Event{},
		TicketTypes: map[uuid.UUID]domain.TicketType{},
		Attendees:   map[uuid.UUID]domain.User{},
	}
	if len(bookings) == 0 {
		return out, nil
	}

	eventIDs := make(map[uuid.UUID]struct{}, len(bookings))
	ticketTypeIDs := make(map[uuid.UUID]struct{}, len(bookings))
	userIDs := make([]uuid.UUID, 0, len(bookings))
	seenUser := make(map[uuid.UUID]struct{}, len(bookings))

	for _, b := range bookings {
		eventIDs[b.EventID] = struct{}{}
		ticketTypeIDs[b.TicketTypeID] = struct{}{}
		if _, ok := seenUser[b.UserID]; !ok {
			seenUser[b.UserID] = struct{}{}
			userIDs = append(userIDs, b.UserID)
		}
	}

	for id := range eventIDs {
		ev, err := s.events.GetByID(ctx, id)
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				continue
			}
			return BookingContext{}, err
		}
		out.Events[id] = ev
	}

	for id := range ticketTypeIDs {
		tt, err := s.ticketTypes.GetByID(ctx, id)
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				continue
			}
			return BookingContext{}, err
		}
		out.TicketTypes[id] = tt
	}

	if s.users != nil {
		people, err := s.users.ListByIDs(ctx, userIDs)
		if err != nil {
			return BookingContext{}, err
		}
		out.Attendees = people
	}

	return out, nil
}

// GetBooking returns the booking if the caller is the booker or the event organizer.
func (s *BookingService) GetBooking(ctx context.Context, userID uuid.UUID, role domain.UserRole, bookingID uuid.UUID) (domain.Booking, error) {
	b, err := s.bookings.GetByID(ctx, bookingID)
	if err != nil {
		return domain.Booking{}, err
	}
	if b.UserID == userID {
		return b, nil
	}
	if role != domain.UserRoleOrganizer {
		return domain.Booking{}, domain.ErrForbidden
	}
	event, err := s.events.GetByID(ctx, b.EventID)
	if err != nil {
		return domain.Booking{}, err
	}
	if event.OrganizerID != userID {
		return domain.Booking{}, domain.ErrForbidden
	}
	return b, nil
}

func (s *BookingService) GetMyBookings(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.Booking, error) {
	return s.bookings.ListByUser(ctx, userID, limit, offset)
}

// GetEventBookings lists bookings for an event; only the organizer of that event may call this.
func (s *BookingService) GetEventBookings(ctx context.Context, organizerID uuid.UUID, eventID uuid.UUID, limit, offset int) ([]domain.Booking, error) {
	event, err := s.events.GetByID(ctx, eventID)
	if err != nil {
		return nil, err
	}
	if event.OrganizerID != organizerID {
		return nil, domain.ErrForbidden
	}
	return s.bookings.ListByEvent(ctx, eventID, limit, offset)
}
