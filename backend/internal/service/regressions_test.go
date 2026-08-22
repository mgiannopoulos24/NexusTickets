package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"nexustickets/internal/domain"
	wshub "nexustickets/internal/handler/ws"
)

// This file covers the behaviours fixed after the assignment audit. Each test
// names the rule it protects.

func mustUser(t *testing.T, users *mockUserRepo, role domain.UserRole) domain.User {
	t.Helper()
	u := domain.User{
		ID:            uuid.New(),
		Username:      uuid.NewString(),
		Email:         uuid.NewString() + "@example.test",
		Role:          role,
		AccountStatus: domain.AccountStatusApproved,
	}
	users.add(u)
	return u
}

// ---------------------------------------------------------------------------
// Ticket types: sold seats survive an edit (assignment §7δ)
// ---------------------------------------------------------------------------

func newEventServiceForTest(t *testing.T) (*EventService, *mockEventRepo, *mockBookingRepo) {
	t.Helper()
	events := newMockEventRepo()
	bookings := newMockBookingRepo()
	svc := NewEventService(events, bookings, newMockCategoryRepo(), newMockEventPhotoRepo(), newMockViewsRepo(), "", nil)
	return svc, events, bookings
}

func seedEvent(t *testing.T, svc *EventService, orgID uuid.UUID, tts []TicketTypeInput) domain.Event {
	t.Helper()
	ev, _, err := svc.Create(context.Background(), orgID, CreateEventInput{
		Title:       "Event",
		Description: "D",
		Venue:       "V",
		City:        "C",
		EventType:   "concert",
		StartAt:     time.Now().Add(time.Hour),
		EndAt:       time.Now().Add(2 * time.Hour),
		Capacity:    100,
		Categories:  []string{"Music"},
		TicketTypes: tts,
	})
	if err != nil {
		t.Fatalf("seed event: %v", err)
	}
	return ev
}

func TestEventService_UpdatePreservesSoldSeats(t *testing.T) {
	svc, events, _ := newEventServiceForTest(t)
	orgID := uuid.New()
	ev := seedEvent(t, svc, orgID, []TicketTypeInput{{Name: "General", Price: 10, Quantity: 50}})

	// Simulate 20 seats sold.
	stored := events.ticketTypes[ev.ID]
	ttID := stored[0].ID
	stored[0].Available = 30
	events.ticketTypes[ev.ID] = stored

	// The organizer renames the type and raises the quantity to 60.
	updated, _, err := svc.Update(context.Background(), orgID, ev.ID, UpdateEventInput{
		TicketTypes: &[]TicketTypeInput{{ID: &ttID, Name: "General Admission", Price: 12, Quantity: 60}},
	})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if len(updated.TicketTypes) != 1 {
		t.Fatalf("expected 1 ticket type, got %d", len(updated.TicketTypes))
	}

	got := updated.TicketTypes[0]
	if got.ID != ttID {
		t.Fatalf("ticket type identity changed: %s -> %s (bookings would dangle)", ttID, got.ID)
	}
	// 60 total - 20 already sold = 40 still available. The old code reset this
	// to the full quantity, re-selling seats that were already taken.
	if got.Available != 40 {
		t.Fatalf("Available = %d, want 40", got.Available)
	}
	if got.Name != "General Admission" || got.Price != 12 {
		t.Fatalf("edit not applied: %+v", got)
	}
}

func TestEventService_UpdateRejectsQuantityBelowSold(t *testing.T) {
	svc, events, _ := newEventServiceForTest(t)
	orgID := uuid.New()
	ev := seedEvent(t, svc, orgID, []TicketTypeInput{{Name: "General", Price: 10, Quantity: 50}})

	stored := events.ticketTypes[ev.ID]
	ttID := stored[0].ID
	stored[0].Available = 10 // 40 sold
	events.ticketTypes[ev.ID] = stored

	_, _, err := svc.Update(context.Background(), orgID, ev.ID, UpdateEventInput{
		TicketTypes: &[]TicketTypeInput{{ID: &ttID, Name: "General", Price: 10, Quantity: 30}},
	})
	if !errors.Is(err, domain.ErrCapacityExceeded) {
		t.Fatalf("expected ErrCapacityExceeded when shrinking below sold, got %v", err)
	}
}

func TestEventService_UpdateRefusesDroppingBookedTicketType(t *testing.T) {
	svc, events, bookings := newEventServiceForTest(t)
	orgID := uuid.New()
	ev := seedEvent(t, svc, orgID, []TicketTypeInput{
		{Name: "General", Price: 10, Quantity: 40},
		{Name: "VIP", Price: 50, Quantity: 10},
	})

	stored := events.ticketTypes[ev.ID]
	keepID, dropID := stored[0].ID, stored[1].ID
	bookings.byTT[dropID] = 3 // VIP has bookings

	// Omitting VIP would delete a row that bookings reference. The FK is
	// ON DELETE RESTRICT, so without this guard the database would abort.
	_, _, err := svc.Update(context.Background(), orgID, ev.ID, UpdateEventInput{
		TicketTypes: &[]TicketTypeInput{{ID: &keepID, Name: "General", Price: 10, Quantity: 40}},
	})
	if !errors.Is(err, domain.ErrTicketTypeLocked) {
		t.Fatalf("expected ErrTicketTypeLocked, got %v", err)
	}
}

func TestEventService_AddTicketTypeKeepsExistingIdentities(t *testing.T) {
	svc, events, _ := newEventServiceForTest(t)
	orgID := uuid.New()
	ev := seedEvent(t, svc, orgID, []TicketTypeInput{{Name: "General", Price: 10, Quantity: 40}})
	originalID := events.ticketTypes[ev.ID][0].ID

	updated, _, err := svc.AddTicketType(context.Background(), orgID, ev.ID, TicketTypeInput{
		Name: "VIP", Price: 50, Quantity: 10,
	})
	if err != nil {
		t.Fatalf("add ticket type: %v", err)
	}
	if len(updated.TicketTypes) != 2 {
		t.Fatalf("expected 2 ticket types, got %d", len(updated.TicketTypes))
	}

	// The pre-existing row must keep its id: recreating it would break every
	// booking pointing at it.
	var found bool
	for _, tt := range updated.TicketTypes {
		if tt.ID == originalID {
			found = true
		}
	}
	if !found {
		t.Fatal("existing ticket type was recreated with a new id")
	}
}

func TestEventService_UpdateRefusesCancelledEvent(t *testing.T) {
	svc, _, _ := newEventServiceForTest(t)
	orgID := uuid.New()
	ev := seedEvent(t, svc, orgID, []TicketTypeInput{{Name: "General", Price: 10, Quantity: 40}})

	if _, _, err := svc.Publish(context.Background(), orgID, ev.ID); err != nil {
		t.Fatalf("publish: %v", err)
	}
	if _, _, err := svc.Cancel(context.Background(), orgID, ev.ID); err != nil {
		t.Fatalf("cancel: %v", err)
	}

	title := "Renamed"
	_, _, err := svc.Update(context.Background(), orgID, ev.ID, UpdateEventInput{Title: &title})
	if !errors.Is(err, domain.ErrEventLocked) {
		t.Fatalf("expected ErrEventLocked on a cancelled event, got %v", err)
	}
}

// ---------------------------------------------------------------------------
// Event lifecycle
// ---------------------------------------------------------------------------

func TestEventService_PublishRequiresCategoryAndTicketType(t *testing.T) {
	svc, events, _ := newEventServiceForTest(t)
	orgID := uuid.New()
	ev := seedEvent(t, svc, orgID, []TicketTypeInput{{Name: "General", Price: 10, Quantity: 40}})

	// Strip the ticket types behind the service's back to mimic a legacy row.
	events.ticketTypes[ev.ID] = nil
	if _, _, err := svc.Publish(context.Background(), orgID, ev.ID); !errors.Is(err, domain.ErrEventNeedsTicketType) {
		t.Fatalf("expected ErrEventNeedsTicketType, got %v", err)
	}
}

func TestEventService_CreateRequiresCategory(t *testing.T) {
	svc, _, _ := newEventServiceForTest(t)
	_, _, err := svc.Create(context.Background(), uuid.New(), CreateEventInput{
		Title: "E", Description: "D", Venue: "V", City: "C",
		StartAt: time.Now().Add(time.Hour), EndAt: time.Now().Add(2 * time.Hour),
		Capacity:    10,
		TicketTypes: []TicketTypeInput{{Name: "General", Price: 1, Quantity: 5}},
	})
	if !errors.Is(err, domain.ErrEventNeedsCategory) {
		t.Fatalf("expected ErrEventNeedsCategory, got %v", err)
	}
}

func TestEventService_SweepCompleted(t *testing.T) {
	svc, events, _ := newEventServiceForTest(t)
	orgID := uuid.New()
	ev := seedEvent(t, svc, orgID, []TicketTypeInput{{Name: "General", Price: 10, Quantity: 40}})
	if _, _, err := svc.Publish(context.Background(), orgID, ev.ID); err != nil {
		t.Fatalf("publish: %v", err)
	}

	// Move the event into the past.
	stored := events.events[ev.ID]
	stored.StartAt = time.Now().Add(-3 * time.Hour)
	stored.EndAt = time.Now().Add(-time.Hour)
	events.events[ev.ID] = stored

	n, err := svc.SweepCompleted(context.Background())
	if err != nil {
		t.Fatalf("sweep: %v", err)
	}
	if n != 1 {
		t.Fatalf("swept %d events, want 1", n)
	}
	if got := events.events[ev.ID].Status; got != domain.EventStatusCompleted {
		t.Fatalf("status = %q, want %q", got, domain.EventStatusCompleted)
	}
}

func TestEventService_GetForViewerHidesDrafts(t *testing.T) {
	svc, _, _ := newEventServiceForTest(t)
	orgID := uuid.New()
	ev := seedEvent(t, svc, orgID, []TicketTypeInput{{Name: "General", Price: 10, Quantity: 40}})
	ctx := context.Background()

	// A stranger (and a guest) must not see an unpublished event.
	if _, _, err := svc.GetForViewer(ctx, ev.ID, uuid.Nil, domain.UserRoleGuest); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("guest saw a draft: %v", err)
	}
	if _, _, err := svc.GetForViewer(ctx, ev.ID, uuid.New(), domain.UserRoleAttendee); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("stranger saw a draft: %v", err)
	}

	// The organizer and an admin may.
	if _, _, err := svc.GetForViewer(ctx, ev.ID, orgID, domain.UserRoleOrganizer); err != nil {
		t.Fatalf("organizer denied their own draft: %v", err)
	}
	if _, _, err := svc.GetForViewer(ctx, ev.ID, uuid.New(), domain.UserRoleAdmin); err != nil {
		t.Fatalf("admin denied a draft: %v", err)
	}

	// Once published, anyone may.
	if _, _, err := svc.Publish(ctx, orgID, ev.ID); err != nil {
		t.Fatalf("publish: %v", err)
	}
	if _, _, err := svc.GetForViewer(ctx, ev.ID, uuid.Nil, domain.UserRoleGuest); err != nil {
		t.Fatalf("guest denied a published event: %v", err)
	}
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

func TestBookingService_RejectsEndedEvent(t *testing.T) {
	events := newMockEventRepo()
	ticketTypes := newMockTicketTypeRepo()
	bookings := newMockBookingRepo()

	eventID, ttID := uuid.New(), uuid.New()
	events.events[eventID] = domain.Event{
		ID:      eventID,
		Status:  domain.EventStatusPublished,
		StartAt: time.Now().Add(-3 * time.Hour),
		EndAt:   time.Now().Add(-time.Hour), // already over
	}
	ticketTypes.add(domain.TicketType{ID: ttID, EventID: eventID, Price: 10, Quantity: 10, Available: 10})

	svc := NewBookingService(events, ticketTypes, bookings, newMockUserRepo())
	_, err := svc.CreateBooking(context.Background(), uuid.New(), domain.UserRoleAttendee, CreateBookingInput{
		EventID: eventID, TicketTypeID: ttID, Quantity: 1,
	})
	if !errors.Is(err, domain.ErrEventEnded) {
		t.Fatalf("expected ErrEventEnded, got %v", err)
	}
}

// ---------------------------------------------------------------------------
// Messaging gate (assignment §10)
// ---------------------------------------------------------------------------

func newMessagingForTest(users *mockUserRepo, bookings *mockBookingRepo) *MessagingService {
	return NewMessagingService(
		newMockMessageRepo(), users, bookings, newMockEventRepo(), newTestRedis(), wshub.NewHub(),
	)
}

func TestMessagingService_RequiresBookingRelationship(t *testing.T) {
	users := newMockUserRepo()
	bookings := newMockBookingRepo()
	svc := newMessagingForTest(users, bookings)

	attendee := mustUser(t, users, domain.UserRoleAttendee)
	organizer := mustUser(t, users, domain.UserRoleOrganizer)

	_, err := svc.SendMessage(context.Background(), SendMessageInput{
		SenderID: attendee.ID, RecipientID: organizer.ID, Subject: "Hi", Body: "Question",
	})
	if !errors.Is(err, domain.ErrMessagingNotAllowed) {
		t.Fatalf("expected ErrMessagingNotAllowed with no booking, got %v", err)
	}

	// Once the attendee has booked one of the organizer's events, both
	// directions open up.
	bookings.correspondents[[2]uuid.UUID{attendee.ID, organizer.ID}] = true

	if _, err := svc.SendMessage(context.Background(), SendMessageInput{
		SenderID: attendee.ID, RecipientID: organizer.ID, Subject: "Hi", Body: "Question",
	}); err != nil {
		t.Fatalf("attendee -> organizer after booking: %v", err)
	}
	if _, err := svc.SendMessage(context.Background(), SendMessageInput{
		SenderID: organizer.ID, RecipientID: attendee.ID, Subject: "Re", Body: "Answer",
	}); err != nil {
		t.Fatalf("organizer -> attendee reply: %v", err)
	}
}

func TestMessagingService_AdminAlwaysReachable(t *testing.T) {
	users := newMockUserRepo()
	bookings := newMockBookingRepo()
	svc := newMessagingForTest(users, bookings)

	attendee := mustUser(t, users, domain.UserRoleAttendee)
	admin := mustUser(t, users, domain.UserRoleAdmin)

	// Support requests must not depend on having booked something.
	if _, err := svc.SendMessage(context.Background(), SendMessageInput{
		SenderID: attendee.ID, RecipientID: admin.ID, Subject: "Help", Body: "Please",
	}); err != nil {
		t.Fatalf("attendee -> admin: %v", err)
	}
	if _, err := svc.SendMessage(context.Background(), SendMessageInput{
		SenderID: admin.ID, RecipientID: attendee.ID, Subject: "Re", Body: "Sure",
	}); err != nil {
		t.Fatalf("admin -> attendee: %v", err)
	}
}

// ---------------------------------------------------------------------------
// Roles and token rotation
// ---------------------------------------------------------------------------

func TestUserService_ChangeRole(t *testing.T) {
	users := newMockUserRepo()
	svc := NewUserService(users)
	ctx := context.Background()

	attendee := mustUser(t, users, domain.UserRoleAttendee)
	updated, err := svc.ChangeRole(ctx, attendee.ID, domain.UserRoleOrganizer)
	if err != nil {
		t.Fatalf("promote to organizer: %v", err)
	}
	if updated.Role != domain.UserRoleOrganizer {
		t.Fatalf("role = %q, want organizer", updated.Role)
	}

	if _, err := svc.ChangeRole(ctx, attendee.ID, domain.UserRoleAdmin); !errors.Is(err, domain.ErrInvalidRole) {
		t.Fatalf("admin must not be assignable, got %v", err)
	}

	admin := mustUser(t, users, domain.UserRoleAdmin)
	if _, err := svc.ChangeRole(ctx, admin.ID, domain.UserRoleAttendee); !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("admin accounts must not be demoted, got %v", err)
	}
}

func TestAuthService_RegisterHonoursRole(t *testing.T) {
	users := newMockUserRepo()
	svc := NewAuthService(users, newTestRedis(), "test-secret")

	organizer, err := svc.Register(context.Background(), RegisterInput{
		Username: "neworg", Password: "sup3rsecret", ConfirmPassword: "sup3rsecret",
		FirstName: "A", LastName: "B", Email: "org@example.test",
		Role: domain.UserRoleOrganizer,
	})
	if err != nil {
		t.Fatalf("register organizer: %v", err)
	}
	if organizer.Role != domain.UserRoleOrganizer {
		t.Fatalf("role = %q, want organizer", organizer.Role)
	}
	if organizer.AccountStatus != domain.AccountStatusPending {
		t.Fatalf("status = %q, want pending", organizer.AccountStatus)
	}

	// An empty role still defaults to attendee.
	attendee, err := svc.Register(context.Background(), RegisterInput{
		Username: "newatt", Password: "sup3rsecret", ConfirmPassword: "sup3rsecret",
		FirstName: "A", LastName: "B", Email: "att@example.test",
	})
	if err != nil {
		t.Fatalf("register attendee: %v", err)
	}
	if attendee.Role != domain.UserRoleAttendee {
		t.Fatalf("role = %q, want attendee", attendee.Role)
	}

	// Anything else is refused.
	if _, err := svc.Register(context.Background(), RegisterInput{
		Username: "sneaky", Password: "sup3rsecret", ConfirmPassword: "sup3rsecret",
		FirstName: "A", LastName: "B", Email: "sneaky@example.test",
		Role: domain.UserRoleAdmin,
	}); !errors.Is(err, domain.ErrInvalidRole) {
		t.Fatalf("expected ErrInvalidRole, got %v", err)
	}
}

func TestAuthService_RefreshRejectsRejectedAccount(t *testing.T) {
	users := newMockUserRepo()
	svc := NewAuthService(users, newTestRedis(), "test-secret")
	ctx := context.Background()

	if _, err := svc.Register(ctx, RegisterInput{
		Username: "pending", Password: "sup3rsecret", ConfirmPassword: "sup3rsecret",
		FirstName: "A", LastName: "B", Email: "pending@example.test",
	}); err != nil {
		t.Fatalf("register: %v", err)
	}
	user, err := users.GetByUsername(ctx, "pending")
	if err != nil {
		t.Fatalf("lookup: %v", err)
	}
	if _, err := users.Approve(ctx, user.ID); err != nil {
		t.Fatalf("approve: %v", err)
	}

	tokens, err := svc.Login(ctx, "pending", "sup3rsecret")
	if err != nil {
		t.Fatalf("login: %v", err)
	}

	// The admin rejects the account after the token was minted.
	if _, err := users.Reject(ctx, user.ID); err != nil {
		t.Fatalf("reject: %v", err)
	}

	if _, err := svc.RefreshToken(ctx, tokens.RefreshToken); !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("a rejected account must not be able to refresh, got %v", err)
	}
}

func TestAuthService_RefreshPicksUpRoleChange(t *testing.T) {
	users := newMockUserRepo()
	svc := NewAuthService(users, newTestRedis(), "test-secret")
	ctx := context.Background()

	if _, err := svc.Register(ctx, RegisterInput{
		Username: "promoted", Password: "sup3rsecret", ConfirmPassword: "sup3rsecret",
		FirstName: "A", LastName: "B", Email: "promoted@example.test",
	}); err != nil {
		t.Fatalf("register: %v", err)
	}
	user, _ := users.GetByUsername(ctx, "promoted")
	if _, err := users.Approve(ctx, user.ID); err != nil {
		t.Fatalf("approve: %v", err)
	}

	tokens, err := svc.Login(ctx, "promoted", "sup3rsecret")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if _, err := users.SetRole(ctx, user.ID, domain.UserRoleOrganizer); err != nil {
		t.Fatalf("set role: %v", err)
	}

	refreshed, err := svc.RefreshToken(ctx, tokens.RefreshToken)
	if err != nil {
		t.Fatalf("refresh: %v", err)
	}
	claims, err := svc.parseToken(refreshed.AccessToken, tokenTypeAccess)
	if err != nil {
		t.Fatalf("parse new access token: %v", err)
	}
	if claims.Role != string(domain.UserRoleOrganizer) {
		t.Fatalf("refreshed role = %q, want organizer", claims.Role)
	}
}

// ---------------------------------------------------------------------------
// Registration field validation (assignment §2)
// ---------------------------------------------------------------------------

func TestRegistrationValidators(t *testing.T) {
	t.Run("email", func(t *testing.T) {
		for _, ok := range []string{"a@b.gr", "first.last@sub.example.com"} {
			if !ValidEmail(ok) {
				t.Errorf("ValidEmail(%q) = false", ok)
			}
		}
		for _, bad := range []string{"", "plain", "a@b", "a b@c.gr", "@b.gr", "a@@b.gr"} {
			if ValidEmail(bad) {
				t.Errorf("ValidEmail(%q) = true", bad)
			}
		}
	})

	t.Run("phone", func(t *testing.T) {
		for _, ok := range []string{"2101234567", "+30 210 123 4567", "(210) 123-4567"} {
			if !ValidPhone(ok) {
				t.Errorf("ValidPhone(%q) = false", ok)
			}
		}
		for _, bad := range []string{"", "123", "abcdefghij", "+30" + "1234567890123456"} {
			if ValidPhone(bad) {
				t.Errorf("ValidPhone(%q) = true", bad)
			}
		}
	})

	t.Run("vat", func(t *testing.T) {
		if !ValidVATNumber("123456789") {
			t.Error("9 digits must be valid")
		}
		for _, bad := range []string{"", "12345678", "1234567890", "12345678a"} {
			if ValidVATNumber(bad) {
				t.Errorf("ValidVATNumber(%q) = true", bad)
			}
		}
	})

	t.Run("password", func(t *testing.T) {
		if err := ValidatePassword("sup3rsecret"); err != nil {
			t.Errorf("valid password rejected: %v", err)
		}
		for _, bad := range []string{"short1", "alllettersonly", "12345678"} {
			if err := ValidatePassword(bad); err == nil {
				t.Errorf("ValidatePassword(%q) = nil, want error", bad)
			}
		}
	})
}
