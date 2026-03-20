package service

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"nexustickets/internal/domain"
	repo "nexustickets/internal/repository"
)

type BookingService struct {
	events      repo.EventRepository
	ticketTypes repo.TicketTypeRepository
	bookings    repo.BookingRepository
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
) *BookingService {
	return &BookingService{
		events:      events,
		ticketTypes: ticketTypes,
		bookings:    bookings,
	}
}

// CreateBooking validates the event is published, computes total_cost from ticket price, and
// creates the booking with atomic availability decrement.
func (s *BookingService) CreateBooking(ctx context.Context, userID uuid.UUID, role domain.UserRole, in CreateBookingInput) (domain.Booking, error) {
	if role == domain.UserRoleGuest {
		return domain.Booking{}, domain.ErrForbidden
	}
	if role != domain.UserRoleAttendee && role != domain.UserRoleOrganizer {
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
