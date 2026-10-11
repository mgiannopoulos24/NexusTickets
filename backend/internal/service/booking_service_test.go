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
	bookings map[uuid.UUID]domain.Booking
	// order keeps insertion order, so lists come back the way they were made.
	order []uuid.UUID
	// byTT adds bookings to a ticket type's count without creating them.
	byTT map[uuid.UUID]int
	// tickets, when set, has its availability taken and given back as holds
	// are made and released, like the ticket_types table.
	tickets *mockTicketTypeRepo
	// correspondents[{attendee, organizer}] marks an existing booking link,
	// which is what gates direct messaging.
	correspondents map[[2]uuid.UUID]bool
}

func newMockBookingRepo() *mockBookingRepo {
	return &mockBookingRepo{
		bookings: make(map[uuid.UUID]domain.Booking),
		byTT:     make(map[uuid.UUID]int),

		correspondents: make(map[[2]uuid.UUID]bool),
	}
}

// add stores a booking as-is. A confirmed one gets a confirmation time, as the
// real repository would have given it.
func (m *mockBookingRepo) add(b domain.Booking) domain.Booking {
	b.ID = uuid.New()
	if b.CreatedAt.IsZero() {
		b.CreatedAt = time.Now().UTC()
	}
	if b.Status == domain.BookingStatusConfirmed && b.ConfirmedAt == nil {
		at := b.CreatedAt
		b.ConfirmedAt = &at
	}
	m.bookings[b.ID] = b
	m.order = append(m.order, b.ID)
	return b
}

func (m *mockBookingRepo) filter(keep func(domain.Booking) bool) []domain.Booking {
	var out []domain.Booking
	for _, id := range m.order {
		if b := m.bookings[id]; keep(b) {
			out = append(out, b)
		}
	}
	return out
}

func (m *mockBookingRepo) Create(_ context.Context, booking domain.Booking) (domain.Booking, error) {
	return m.add(booking), nil
}

func (m *mockBookingRepo) CreateBookingWithDecrement(_ context.Context, booking domain.Booking, ttID uuid.UUID, quantity int) (domain.Booking, error) {
	if quantity <= 0 {
		return domain.Booking{}, domain.ErrInvalidEventState
	}
	if m.tickets != nil {
		if _, err := m.tickets.DecrementAvailabilityAtomic(context.Background(), ttID, quantity); err != nil {
			return domain.Booking{}, err
		}
	}
	booking.TicketTypeID = ttID
	booking.UpdatedAt = time.Now().UTC()
	return m.add(booking), nil
}

func (m *mockBookingRepo) GetByID(_ context.Context, id uuid.UUID) (domain.Booking, error) {
	b, ok := m.bookings[id]
	if !ok {
		return domain.Booking{}, domain.ErrNotFound
	}
	return b, nil
}

func (m *mockBookingRepo) ListByUser(_ context.Context, userID uuid.UUID, limit, offset int) ([]domain.Booking, error) {
	return m.filter(func(b domain.Booking) bool { return b.UserID == userID }), nil
}

func (m *mockBookingRepo) ListByEvent(_ context.Context, eventID uuid.UUID, limit, offset int) ([]domain.Booking, error) {
	return m.filter(func(b domain.Booking) bool { return b.EventID == eventID }), nil
}

func (m *mockBookingRepo) ListConfirmedByEvent(_ context.Context, eventID uuid.UUID, limit, offset int) ([]domain.Booking, error) {
	return m.filter(func(b domain.Booking) bool {
		return b.EventID == eventID && b.Status == domain.BookingStatusConfirmed
	}), nil
}

func (m *mockBookingRepo) ListDistinctConfirmedUserIDsByEvent(_ context.Context, eventID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	seen := make(map[uuid.UUID]bool)
	for _, b := range m.filter(func(b domain.Booking) bool { return b.EventID == eventID && b.WasConfirmed() }) {
		if !seen[b.UserID] {
			ids = append(ids, b.UserID)
			seen[b.UserID] = true
		}
	}
	return ids, nil
}

func (m *mockBookingRepo) ListByEventIDs(_ context.Context, eventIDs []uuid.UUID) ([]domain.Booking, error) {
	want := make(map[uuid.UUID]bool, len(eventIDs))
	for _, id := range eventIDs {
		want[id] = true
	}
	return m.filter(func(b domain.Booking) bool { return want[b.EventID] }), nil
}

func (m *mockBookingRepo) ExistsBetweenAttendeeAndOrganizer(_ context.Context, attendeeID, organizerID uuid.UUID) (bool, error) {
	return m.correspondents[[2]uuid.UUID{attendeeID, organizerID}], nil
}

func (m *mockBookingRepo) ListCorrespondentIDs(_ context.Context, userID uuid.UUID) ([]uuid.UUID, error) {
	var out []uuid.UUID
	for pair, ok := range m.correspondents {
		if !ok {
			continue
		}
		switch userID {
		case pair[0]:
			out = append(out, pair[1])
		case pair[1]:
			out = append(out, pair[0])
		}
	}
	return out, nil
}

func (m *mockBookingRepo) CountByTicketType(_ context.Context, ttID uuid.UUID) (int, error) {
	n := len(m.filter(func(b domain.Booking) bool {
		return b.TicketTypeID == ttID && b.Status != domain.BookingStatusCancelled
	}))
	return n + m.byTT[ttID], nil
}

func (m *mockBookingRepo) CountActiveByEvent(_ context.Context, eventID uuid.UUID) (int, error) {
	return len(m.filter(func(b domain.Booking) bool {
		return b.EventID == eventID && b.Status != domain.BookingStatusCancelled
	})), nil
}

func (m *mockBookingRepo) ListAllConfirmed(_ context.Context) ([]domain.Booking, error) {
	return m.filter(domain.Booking.WasConfirmed), nil
}

func (m *mockBookingRepo) Confirm(_ context.Context, id uuid.UUID, holdCutoff time.Time) (domain.Booking, error) {
	b, ok := m.bookings[id]
	if !ok || b.Status != domain.BookingStatusPending || !b.CreatedAt.After(holdCutoff) {
		return domain.Booking{}, domain.ErrBookingNotPending
	}
	now := time.Now().UTC()
	b.Status = domain.BookingStatusConfirmed
	b.ConfirmedAt = &now
	m.bookings[id] = b
	return b, nil
}

func (m *mockBookingRepo) Release(_ context.Context, id uuid.UUID) error {
	if m.releaseWhere(func(b domain.Booking) bool { return b.ID == id }) == 0 {
		return domain.ErrBookingNotPending
	}
	return nil
}

func (m *mockBookingRepo) ReleaseExpired(_ context.Context, holdCutoff time.Time) (int64, error) {
	return m.releaseWhere(func(b domain.Booking) bool { return !b.CreatedAt.After(holdCutoff) }), nil
}

func (m *mockBookingRepo) CancelByEvent(_ context.Context, eventID uuid.UUID) error {
	m.releaseWhere(func(b domain.Booking) bool { return b.EventID == eventID })
	for _, b := range m.filter(func(b domain.Booking) bool {
		return b.EventID == eventID && b.Status == domain.BookingStatusConfirmed
	}) {
		b.Status = domain.BookingStatusCancelled
		m.bookings[b.ID] = b
	}
	return nil
}

func (m *mockBookingRepo) releaseWhere(match func(domain.Booking) bool) int64 {
	var n int64
	for _, b := range m.filter(func(b domain.Booking) bool {
		return b.Status == domain.BookingStatusPending && match(b)
	}) {
		b.Status = domain.BookingStatusCancelled
		m.bookings[b.ID] = b
		if m.tickets != nil {
			tt := m.tickets.types[b.TicketTypeID]
			tt.Available += b.Quantity
			m.tickets.types[b.TicketTypeID] = tt
		}
		n++
	}
	return n
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
	svc := NewBookingService(events, ttRepo, bookings, newMockUserRepo())

	orgID := uuid.New()
	eventID := uuid.New()
	ttID := uuid.New()
	userID := uuid.New()

	events.events[eventID] = domain.Event{
		ID:          eventID,
		OrganizerID: orgID,
		Title:       "Test Event",
		Status:      domain.EventStatusPublished,
		Capacity:    100,
		StartAt:     time.Now().Add(time.Hour),
		EndAt:       time.Now().Add(2 * time.Hour),
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
		if b.Status != domain.BookingStatusPending {
			t.Fatalf("expected pending, got %s", b.Status)
		}
	})

	t.Run("admin may book", func(t *testing.T) {
		b, err := svc.CreateBooking(context.Background(), uuid.New(), domain.UserRoleAdmin, CreateBookingInput{
			EventID:      eventID,
			TicketTypeID: ttID,
			Quantity:     1,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if b.TotalCost != 10.0 {
			t.Fatalf("expected total 10.0, got %f", b.TotalCost)
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
	svc := NewBookingService(events, ttRepo, bookings, newMockUserRepo())

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
	svc := NewBookingService(events, ttRepo, bookings, newMockUserRepo())

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
	svc := NewBookingService(events, ttRepo, bookings, newMockUserRepo())

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

// bookingFixture is a published event with one ticket type, booked through a
// repository that tracks seats the way the database does.
type bookingFixture struct {
	svc      *BookingService
	events   *mockEventRepo
	tickets  *mockTicketTypeRepo
	bookings *mockBookingRepo
	eventID  uuid.UUID
	ttID     uuid.UUID
	userID   uuid.UUID
}

func newBookingFixture(t *testing.T) bookingFixture {
	t.Helper()
	f := bookingFixture{
		events:   newMockEventRepo(),
		tickets:  newMockTicketTypeRepo(),
		bookings: newMockBookingRepo(),
		eventID:  uuid.New(),
		ttID:     uuid.New(),
		userID:   uuid.New(),
	}
	f.bookings.tickets = f.tickets
	f.svc = NewBookingService(f.events, f.tickets, f.bookings, newMockUserRepo())
	f.events.events[f.eventID] = domain.Event{
		ID:          f.eventID,
		OrganizerID: uuid.New(),
		Status:      domain.EventStatusPublished,
		Capacity:    10,
		StartAt:     time.Now().Add(24 * time.Hour),
		EndAt:       time.Now().Add(26 * time.Hour),
	}
	f.tickets.add(domain.TicketType{ID: f.ttID, EventID: f.eventID, Name: "General", Price: 5, Quantity: 10, Available: 10})
	return f
}

// hold books qty seats and returns the pending booking.
func (f bookingFixture) hold(t *testing.T, qty int) domain.Booking {
	t.Helper()
	b, err := f.svc.CreateBooking(context.Background(), f.userID, domain.UserRoleAttendee, CreateBookingInput{
		EventID: f.eventID, TicketTypeID: f.ttID, Quantity: qty,
	})
	if err != nil {
		t.Fatalf("create booking: %v", err)
	}
	return b
}

func (f bookingFixture) available() int { return f.tickets.types[f.ttID].Available }

// age moves a booking's creation time into the past.
func (f bookingFixture) age(id uuid.UUID, by time.Duration) {
	b := f.bookings.bookings[id]
	b.CreatedAt = b.CreatedAt.Add(-by)
	f.bookings.bookings[id] = b
}

func TestBookingService_HoldTakesSeats(t *testing.T) {
	f := newBookingFixture(t)
	b := f.hold(t, 3)

	if b.Status != domain.BookingStatusPending {
		t.Fatalf("status = %s, want pending", b.Status)
	}
	if b.WasConfirmed() {
		t.Fatal("a fresh hold must not carry a confirmation time")
	}
	if got := f.available(); got != 7 {
		t.Fatalf("available = %d, want 7 while held", got)
	}
	if want := b.CreatedAt.Add(domain.BookingHoldTTL); !b.HoldExpiresAt().Equal(want) {
		t.Fatalf("hold expires at %v, want %v", b.HoldExpiresAt(), want)
	}
}

func TestBookingService_ConfirmBooking(t *testing.T) {
	ctx := context.Background()

	t.Run("confirms a live hold and keeps the seats", func(t *testing.T) {
		f := newBookingFixture(t)
		b := f.hold(t, 2)

		got, err := f.svc.ConfirmBooking(ctx, f.userID, b.ID)
		if err != nil {
			t.Fatalf("confirm: %v", err)
		}
		if got.Status != domain.BookingStatusConfirmed || !got.WasConfirmed() {
			t.Fatalf("got status %s, confirmed_at %v", got.Status, got.ConfirmedAt)
		}
		if f.available() != 8 {
			t.Fatalf("available = %d, want 8", f.available())
		}
	})

	t.Run("a confirmed booking cannot be confirmed or cancelled again", func(t *testing.T) {
		f := newBookingFixture(t)
		b := f.hold(t, 1)
		if _, err := f.svc.ConfirmBooking(ctx, f.userID, b.ID); err != nil {
			t.Fatalf("confirm: %v", err)
		}
		if _, err := f.svc.ConfirmBooking(ctx, f.userID, b.ID); !errors.Is(err, domain.ErrBookingNotPending) {
			t.Fatalf("second confirm: got %v, want ErrBookingNotPending", err)
		}
		if _, err := f.svc.CancelBooking(ctx, f.userID, b.ID); !errors.Is(err, domain.ErrBookingNotPending) {
			t.Fatalf("cancel after confirm: got %v, want ErrBookingNotPending", err)
		}
		if f.available() != 9 {
			t.Fatalf("available = %d, want 9: a confirmed seat stays sold", f.available())
		}
	})

	t.Run("only the booker may confirm", func(t *testing.T) {
		f := newBookingFixture(t)
		b := f.hold(t, 1)
		if _, err := f.svc.ConfirmBooking(ctx, uuid.New(), b.ID); !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("got %v, want ErrForbidden", err)
		}
	})

	t.Run("unknown booking", func(t *testing.T) {
		f := newBookingFixture(t)
		if _, err := f.svc.ConfirmBooking(ctx, f.userID, uuid.New()); !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("got %v, want ErrNotFound", err)
		}
	})

	t.Run("an expired hold is released instead", func(t *testing.T) {
		f := newBookingFixture(t)
		b := f.hold(t, 4)
		f.age(b.ID, domain.BookingHoldTTL+time.Second)

		if _, err := f.svc.ConfirmBooking(ctx, f.userID, b.ID); !errors.Is(err, domain.ErrBookingExpired) {
			t.Fatalf("got %v, want ErrBookingExpired", err)
		}
		if got := f.bookings.bookings[b.ID].Status; got != domain.BookingStatusCancelled {
			t.Fatalf("status = %s, want cancelled", got)
		}
		if f.available() != 10 {
			t.Fatalf("available = %d, want the 4 seats back", f.available())
		}
	})

	t.Run("a hold on an event cancelled meanwhile is released", func(t *testing.T) {
		f := newBookingFixture(t)
		b := f.hold(t, 1)
		ev := f.events.events[f.eventID]
		ev.Status = domain.EventStatusCancelled
		f.events.events[f.eventID] = ev

		if _, err := f.svc.ConfirmBooking(ctx, f.userID, b.ID); !errors.Is(err, domain.ErrEventNotBookable) {
			t.Fatalf("got %v, want ErrEventNotBookable", err)
		}
		if got := f.bookings.bookings[b.ID].Status; got != domain.BookingStatusCancelled {
			t.Fatalf("status = %s, want cancelled", got)
		}
	})

	t.Run("a hold on an event that has ended is released", func(t *testing.T) {
		f := newBookingFixture(t)
		b := f.hold(t, 1)
		ev := f.events.events[f.eventID]
		ev.EndAt = time.Now().Add(-time.Minute)
		f.events.events[f.eventID] = ev

		if _, err := f.svc.ConfirmBooking(ctx, f.userID, b.ID); !errors.Is(err, domain.ErrEventEnded) {
			t.Fatalf("got %v, want ErrEventEnded", err)
		}
		if f.available() != 10 {
			t.Fatalf("available = %d, want 10", f.available())
		}
	})
}

func TestBookingService_CancelBooking(t *testing.T) {
	ctx := context.Background()

	t.Run("returns the seats", func(t *testing.T) {
		f := newBookingFixture(t)
		b := f.hold(t, 5)

		got, err := f.svc.CancelBooking(ctx, f.userID, b.ID)
		if err != nil {
			t.Fatalf("cancel: %v", err)
		}
		if got.Status != domain.BookingStatusCancelled || got.WasConfirmed() {
			t.Fatalf("got status %s, confirmed_at %v", got.Status, got.ConfirmedAt)
		}
		if f.available() != 10 {
			t.Fatalf("available = %d, want 10", f.available())
		}
	})

	t.Run("twice is refused and returns nothing more", func(t *testing.T) {
		f := newBookingFixture(t)
		b := f.hold(t, 2)
		if _, err := f.svc.CancelBooking(ctx, f.userID, b.ID); err != nil {
			t.Fatalf("cancel: %v", err)
		}
		if _, err := f.svc.CancelBooking(ctx, f.userID, b.ID); !errors.Is(err, domain.ErrBookingNotPending) {
			t.Fatalf("got %v, want ErrBookingNotPending", err)
		}
		if f.available() != 10 {
			t.Fatalf("available = %d, want 10", f.available())
		}
	})

	t.Run("only the booker may cancel", func(t *testing.T) {
		f := newBookingFixture(t)
		b := f.hold(t, 1)
		if _, err := f.svc.CancelBooking(ctx, uuid.New(), b.ID); !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("got %v, want ErrForbidden", err)
		}
		if f.available() != 9 {
			t.Fatalf("available = %d, want 9", f.available())
		}
	})
}

func TestBookingService_ReleaseExpiredHolds(t *testing.T) {
	f := newBookingFixture(t)
	stale := f.hold(t, 2)
	fresh := f.hold(t, 3)
	confirmed := f.hold(t, 1)
	if _, err := f.svc.ConfirmBooking(context.Background(), f.userID, confirmed.ID); err != nil {
		t.Fatalf("confirm: %v", err)
	}
	f.age(stale.ID, domain.BookingHoldTTL+time.Minute)
	f.age(confirmed.ID, domain.BookingHoldTTL+time.Minute)

	n, err := f.svc.ReleaseExpiredHolds(context.Background())
	if err != nil {
		t.Fatalf("release: %v", err)
	}
	if n != 1 {
		t.Fatalf("released %d holds, want 1", n)
	}
	want := map[uuid.UUID]domain.BookingStatus{
		stale.ID:     domain.BookingStatusCancelled,
		fresh.ID:     domain.BookingStatusPending,
		confirmed.ID: domain.BookingStatusConfirmed,
	}
	for id, status := range want {
		if got := f.bookings.bookings[id].Status; got != status {
			t.Errorf("booking %s: status %s, want %s", id, got, status)
		}
	}
	if f.available() != 6 {
		t.Fatalf("available = %d, want 6 (3 held + 1 sold)", f.available())
	}
}
