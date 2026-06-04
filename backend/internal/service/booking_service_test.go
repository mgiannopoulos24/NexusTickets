package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"nexustickets/internal/domain"
)

type mockBookingRepo struct {
	bookings  map[uuid.UUID]domain.Booking
	byUser    map[uuid.UUID][]domain.Booking
	byEvent   map[uuid.UUID][]domain.Booking
	byTT      map[uuid.UUID]int
}

func newMockBookingRepo() *mockBookingRepo {
	return &mockBookingRepo{
		bookings: make(map[uuid.UUID]domain.Booking),
		byUser:   make(map[uuid.UUID][]domain.Booking),
		byEvent:  make(map[uuid.UUID][]domain.Booking),
		byTT:     make(map[uuid.UUID]int),
	}
}

func (m *mockBookingRepo) add(b domain.Booking) {
	b.ID = uuid.New()
	m.bookings[b.ID] = b
	m.byUser[b.UserID] = append(m.byUser[b.UserID], b)
	m.byEvent[b.EventID] = append(m.byEvent[b.EventID], b)
	m.byTT[b.TicketTypeID]++
}

func (m *mockBookingRepo) Create(_ context.Context, booking domain.Booking) (domain.Booking, error) {
	booking.ID = uuid.New()
	booking.CreatedAt = time.Now().UTC()
	m.bookings[booking.ID] = booking
	return booking, nil
}

func (m *mockBookingRepo) CreateBookingWithDecrement(_ context.Context, booking domain.Booking, ttID uuid.UUID, quantity int) (domain.Booking, error) {
	if quantity <= 0 {
		return domain.Booking{}, domain.ErrInvalidEventState
	}
	booking.ID = uuid.New()
	booking.CreatedAt = time.Now().UTC()
	booking.UpdatedAt = time.Now().UTC()
	booking.TicketTypeID = ttID
	m.bookings[booking.ID] = booking
	m.byUser[booking.UserID] = append(m.byUser[booking.UserID], booking)
	m.byEvent[booking.EventID] = append(m.byEvent[booking.EventID], booking)
	m.byTT[ttID] += quantity
	return booking, nil
}

func (m *mockBookingRepo) GetByID(_ context.Context, id uuid.UUID) (domain.Booking, error) {
	b, ok := m.bookings[id]
	if !ok {
		return domain.Booking{}, domain.ErrNotFound
	}
	return b, nil
}

func (m *mockBookingRepo) ListByUser(_ context.Context, userID uuid.UUID, limit, offset int) ([]domain.Booking, error) {
	return m.byUser[userID], nil
}

func (m *mockBookingRepo) ListByEvent(_ context.Context, eventID uuid.UUID, limit, offset int) ([]domain.Booking, error) {
	return m.byEvent[eventID], nil
}

func (m *mockBookingRepo) ListConfirmedByEvent(_ context.Context, eventID uuid.UUID, limit, offset int) ([]domain.Booking, error) {
	return m.byEvent[eventID], nil
}

func (m *mockBookingRepo) ListDistinctConfirmedUserIDsByEvent(_ context.Context, eventID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	seen := make(map[uuid.UUID]bool)
	for _, b := range m.byEvent[eventID] {
		if !seen[b.UserID] {
			ids = append(ids, b.UserID)
			seen[b.UserID] = true
		}
	}
	return ids, nil
}

func (m *mockBookingRepo) ListByEventIDs(_ context.Context, eventIDs []uuid.UUID) ([]domain.Booking, error) {
	var out []domain.Booking
	for _, b := range m.bookings {
		for _, eid := range eventIDs {
			if b.EventID == eid {
				out = append(out, b)
			}
		}
	}
	return out, nil
}

func (m *mockBookingRepo) CountByTicketType(_ context.Context, ttID uuid.UUID) (int, error) {
	return m.byTT[ttID], nil
}

func (m *mockBookingRepo) SetStatus(_ context.Context, bid uuid.UUID, status domain.BookingStatus) error {
	b, ok := m.bookings[bid]
	if !ok {
		return domain.ErrNotFound
	}
	b.Status = status
	m.bookings[bid] = b
	return nil
}

type mockTicketTypeRepo struct {
	types map[uuid.UUID]domain.TicketType
}

func newMockTicketTypeRepo() *mockTicketTypeRepo {
	return &mockTicketTypeRepo{types: make(map[uuid.UUID]domain.TicketType)}
}

func (m *mockTicketTypeRepo) add(tt domain.TicketType) {
	m.types[tt.ID] = tt
}

func (m *mockTicketTypeRepo) Create(_ context.Context, tt domain.TicketType) (domain.TicketType, error) {
	tt.ID = uuid.New()
	m.types[tt.ID] = tt
	return tt, nil
}

func (m *mockTicketTypeRepo) GetByID(_ context.Context, id uuid.UUID) (domain.TicketType, error) {
	tt, ok := m.types[id]
	if !ok {
		return domain.TicketType{}, domain.ErrNotFound
	}
	return tt, nil
}

func (m *mockTicketTypeRepo) ListByEvent(_ context.Context, eid uuid.UUID) ([]domain.TicketType, error) {
	var out []domain.TicketType
	for _, tt := range m.types {
		if tt.EventID == eid {
			out = append(out, tt)
		}
	}
	return out, nil
}

func (m *mockTicketTypeRepo) Update(_ context.Context, tt domain.TicketType) (domain.TicketType, error) {
	m.types[tt.ID] = tt
	return tt, nil
}

func (m *mockTicketTypeRepo) Delete(_ context.Context, id uuid.UUID) error {
	delete(m.types, id)
	return nil
}

func (m *mockTicketTypeRepo) DecrementAvailabilityAtomic(_ context.Context, ttID uuid.UUID, qty int) (bool, error) {
	tt, ok := m.types[ttID]
	if !ok {
		return false, domain.ErrNotFound
	}
	if tt.Available < qty {
		return false, domain.ErrCapacityExceeded
	}
	tt.Available -= qty
	m.types[ttID] = tt
	return true, nil
}

func TestBookingService_CreateBooking(t *testing.T) {
	events := newMockEventRepo()
	ttRepo := newMockTicketTypeRepo()
	bookings := newMockBookingRepo()
	svc := NewBookingService(events, ttRepo, bookings)

	orgID := uuid.New()
	eventID := uuid.New()
	ttID := uuid.New()
	userID := uuid.New()

	events.events[eventID] = domain.Event{
		ID:           eventID,
		OrganizerID:  orgID,
		Title:        "Test Event",
		Status:       domain.EventStatusPublished,
		Capacity:     100,
		StartAt:      time.Now().Add(time.Hour),
		EndAt:        time.Now().Add(2 * time.Hour),
	}

	ttRepo.types[ttID] = domain.TicketType{
		ID:        ttID,
		EventID:   eventID,
		Name:      "General",
		Price:     10.0,
		Quantity:  50,
		Available: 50,
	}

	t.Run("success", func(t *testing.T) {
		b, err := svc.CreateBooking(context.Background(), userID, domain.UserRoleAttendee, CreateBookingInput{
			EventID:      eventID,
			TicketTypeID: ttID,
			Quantity:     2,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if b.UserID != userID {
			t.Fatalf("expected user %s, got %s", userID, b.UserID)
		}
		if b.TotalCost != 20.0 {
			t.Fatalf("expected total 20.0, got %f", b.TotalCost)
		}
		if b.Status != domain.BookingStatusConfirmed {
			t.Fatalf("expected confirmed, got %s", b.Status)
		}
	})

	t.Run("guest forbidden", func(t *testing.T) {
		_, err := svc.CreateBooking(context.Background(), uuid.New(), domain.UserRoleGuest, CreateBookingInput{
			EventID:      eventID,
			TicketTypeID: ttID,
			Quantity:     1,
		})
		if !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got %v", err)
		}
	})

	t.Run("event not published", func(t *testing.T) {
		draftID := uuid.New()
		events.events[draftID] = domain.Event{
			ID:     draftID,
			Status: domain.EventStatusDraft,
		}
		_, err := svc.CreateBooking(context.Background(), userID, domain.UserRoleAttendee, CreateBookingInput{
			EventID:      draftID,
			TicketTypeID: ttID,
			Quantity:     1,
		})
		if !errors.Is(err, domain.ErrEventNotBookable) {
			t.Fatalf("expected ErrEventNotBookable, got %v", err)
		}
	})

	t.Run("zero quantity", func(t *testing.T) {
		_, err := svc.CreateBooking(context.Background(), userID, domain.UserRoleAttendee, CreateBookingInput{
			EventID:      eventID,
			TicketTypeID: ttID,
			Quantity:     0,
		})
		if !errors.Is(err, domain.ErrInvalidEventState) {
			t.Fatalf("expected ErrInvalidEventState, got %v", err)
		}
	})

	t.Run("ticket type not found", func(t *testing.T) {
		_, err := svc.CreateBooking(context.Background(), userID, domain.UserRoleAttendee, CreateBookingInput{
			EventID:      eventID,
			TicketTypeID: uuid.New(),
			Quantity:     1,
		})
		if !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("expected ErrNotFound, got %v", err)
		}
	})
}

func TestBookingService_GetBooking(t *testing.T) {
	events := newMockEventRepo()
	ttRepo := newMockTicketTypeRepo()
	bookings := newMockBookingRepo()
	svc := NewBookingService(events, ttRepo, bookings)

	userID := uuid.New()
	orgID := uuid.New()
	eventID := uuid.New()
	ttID := uuid.New()

	events.events[eventID] = domain.Event{
		ID:          eventID,
		OrganizerID: orgID,
		Status:      domain.EventStatusPublished,
	}

	b, _ := bookings.Create(context.Background(), domain.Booking{
		UserID:       userID,
		EventID:      eventID,
		TicketTypeID: ttID,
		Quantity:     1,
		TotalCost:    10,
		Status:       domain.BookingStatusConfirmed,
	})

	t.Run("owner can view", func(t *testing.T) {
		got, err := svc.GetBooking(context.Background(), userID, domain.UserRoleAttendee, b.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.ID != b.ID {
			t.Fatalf("expected booking %s, got %s", b.ID, got.ID)
		}
	})

	t.Run("organizer can view", func(t *testing.T) {
		got, err := svc.GetBooking(context.Background(), orgID, domain.UserRoleOrganizer, b.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.ID != b.ID {
			t.Fatalf("expected booking %s, got %s", b.ID, got.ID)
		}
	})

	t.Run("stranger forbidden", func(t *testing.T) {
		_, err := svc.GetBooking(context.Background(), uuid.New(), domain.UserRoleAttendee, b.ID)
		if !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got %v", err)
		}
	})
}

func TestBookingService_GetMyBookings(t *testing.T) {
	events := newMockEventRepo()
	ttRepo := newMockTicketTypeRepo()
	bookings := newMockBookingRepo()
	svc := NewBookingService(events, ttRepo, bookings)

	userID := uuid.New()
	bookings.add(domain.Booking{UserID: userID, EventID: uuid.New(), TicketTypeID: uuid.New(), Quantity: 1})
	bookings.add(domain.Booking{UserID: userID, EventID: uuid.New(), TicketTypeID: uuid.New(), Quantity: 2})

	result, err := svc.GetMyBookings(context.Background(), userID, 10, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 2 {
		t.Fatalf("expected 2 bookings, got %d", len(result))
	}
}

func TestBookingService_GetEventBookings(t *testing.T) {
	events := newMockEventRepo()
	ttRepo := newMockTicketTypeRepo()
	bookings := newMockBookingRepo()
	svc := NewBookingService(events, ttRepo, bookings)

	orgID := uuid.New()
	eventID := uuid.New()
	events.events[eventID] = domain.Event{
		ID:          eventID,
		OrganizerID: orgID,
		Status:      domain.EventStatusPublished,
	}
	bookings.add(domain.Booking{EventID: eventID, UserID: uuid.New()})

	t.Run("organizer can view", func(t *testing.T) {
		result, err := svc.GetEventBookings(context.Background(), orgID, eventID, 10, 0)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(result) != 1 {
			t.Fatalf("expected 1 booking, got %d", len(result))
		}
	})

	t.Run("stranger forbidden", func(t *testing.T) {
		_, err := svc.GetEventBookings(context.Background(), uuid.New(), eventID, 10, 0)
		if !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got %v", err)
		}
	})
}
