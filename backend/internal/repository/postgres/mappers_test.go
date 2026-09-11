package postgres

import (
	"reflect"
	"testing"
	"time"

	"github.com/google/uuid"
	"nexustickets/internal/domain"
)

func strPtr(s string) *string     { return &s }
func floatPtr(f float64) *float64 { return &f }

func TestUserMapping_RoundTrip(t *testing.T) {
	userID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	createdAt := time.Date(2026, 3, 18, 10, 0, 0, 0, time.UTC)
	updatedAt := time.Date(2026, 3, 18, 10, 5, 0, 0, time.UTC)

	u := domain.User{
		ID:            userID,
		Username:      "user1",
		PasswordHash:  "hashed_pw",
		FirstName:     "First",
		LastName:      "Last",
		Email:         "user1@example.com",
		Phone:         strPtr("+30 210 1234567"),
		Address:       strPtr("Some street 123"),
		City:          strPtr("Athens"),
		Country:       strPtr("Greece"),
		Latitude:      floatPtr(37.9838),
		Longitude:     floatPtr(23.7275),
		VATNumber:     strPtr("VAT-123"),
		Role:          domain.UserRoleOrganizer,
		AccountStatus: domain.AccountStatusApproved,
		CreatedAt:     createdAt,
		UpdatedAt:     updatedAt,
	}

	m := userDomainToModel(u)
	got := userModelToDomain(m)

	// Organizer is stored as string in the DB; mappers convert between types.
	if !reflect.DeepEqual(got, u) {
		t.Fatalf("round-trip mismatch:\nexpected: %#v\ngot:      %#v", u, got)
	}
}

func TestEventMapping_RoundTrip(t *testing.T) {
	eventID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	orgID := uuid.MustParse("33333333-3333-3333-3333-333333333333")

	startAt := time.Date(2026, 4, 1, 18, 0, 0, 0, time.UTC)
	endAt := time.Date(2026, 4, 1, 20, 0, 0, 0, time.UTC)
	createdAt := time.Date(2026, 3, 18, 10, 10, 0, 0, time.UTC)
	updatedAt := time.Date(2026, 3, 18, 11, 10, 0, 0, time.UTC)

	e := domain.Event{
		ID:          eventID,
		OrganizerID: orgID,
		Organizer:   nil,
		Title:       "Event title",
		Description: "Event description",
		Venue:       "Venue name",
		Detail:      domain.EventDetail{},
		Address:     strPtr("Address line"),
		City:        "Thessaloniki",
		Country:     strPtr("Greece"),
		Latitude:    floatPtr(40.6401),
		Longitude:   floatPtr(22.9444),
		StartAt:     startAt,
		EndAt:       endAt,
		Capacity:    100,
		Status:      domain.EventStatusPublished,
		CreatedAt:   createdAt,
		UpdatedAt:   updatedAt,
		TicketTypes: nil,
		Bookings:    nil,
	}

	m := eventDomainToModel(e)
	got := eventModelToDomain(m)

	// Organizer is intentionally not mapped in current mapper; keep it nil on both sides.
	if got.Organizer != nil {
		t.Fatalf("expected Organizer to be nil, got %#v", got.Organizer)
	}

	got.Organizer = e.Organizer // should be nil anyway
	if !reflect.DeepEqual(got, e) {
		t.Fatalf("round-trip mismatch:\nexpected: %#v\ngot:      %#v", e, got)
	}
}

func TestTicketTypeMapping_RoundTrip(t *testing.T) {
	id := uuid.MustParse("44444444-4444-4444-4444-444444444444")
	eventID := uuid.MustParse("55555555-5555-5555-5555-555555555555")
	createdAt := time.Date(2026, 3, 18, 12, 0, 0, 0, time.UTC)
	updatedAt := time.Date(2026, 3, 18, 12, 30, 0, 0, time.UTC)

	tt := domain.TicketType{
		ID:        id,
		EventID:   eventID,
		Event:     nil,
		Name:      "VIP",
		Price:     49.99,
		Quantity:  50,
		Available: 10,
		CreatedAt: createdAt,
		UpdatedAt: updatedAt,
	}

	m := ticketTypeDomainToModel(tt)
	got := ticketTypeModelToDomain(m)

	if got != tt {
		t.Fatalf("round-trip mismatch:\nexpected: %#v\ngot:      %#v", tt, got)
	}
}

func TestBookingMapping_RoundTrip(t *testing.T) {
	id := uuid.MustParse("66666666-6666-6666-6666-666666666666")
	userID := uuid.MustParse("77777777-7777-7777-7777-777777777777")
	eventID := uuid.MustParse("88888888-8888-8888-8888-888888888888")
	ticketTypeID := uuid.MustParse("99999999-9999-9999-9999-999999999999")

	createdAt := time.Date(2026, 3, 18, 13, 0, 0, 0, time.UTC)
	updatedAt := time.Date(2026, 3, 18, 13, 1, 0, 0, time.UTC)

	b := domain.Booking{
		ID:           id,
		UserID:       userID,
		User:         nil,
		EventID:      eventID,
		Event:        nil,
		TicketTypeID: ticketTypeID,
		TicketType:   nil,
		Quantity:     2,
		TotalCost:    99.98,
		Status:       domain.BookingStatusConfirmed,
		CreatedAt:    createdAt,
		UpdatedAt:    updatedAt,
	}

	m := bookingDomainToModel(b)
	got := bookingModelToDomain(m)

	if got != b {
		t.Fatalf("round-trip mismatch:\nexpected: %#v\ngot:      %#v", b, got)
	}
}

func TestMessageMapping_RoundTrip(t *testing.T) {
	id := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	senderID := uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
	recipientID := uuid.MustParse("cccccccc-cccc-cccc-cccc-cccccccccccc")

	readAt := time.Date(2026, 3, 18, 14, 0, 0, 0, time.UTC)
	createdAt := time.Date(2026, 3, 18, 13, 55, 0, 0, time.UTC)

	eventID := uuid.MustParse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
	msg := domain.Message{
		ID:                 id,
		SenderID:           senderID,
		RecipientID:        recipientID,
		EventID:            &eventID,
		Subject:            "Hello",
		Body:               "Message body",
		ReadAt:             &readAt,
		DeletedBySender:    false,
		DeletedByRecipient: true,
		CreatedAt:          createdAt,
	}

	m := messageDomainToModel(msg)
	got := messageModelToDomain(m)

	if !reflect.DeepEqual(got, msg) {
		t.Fatalf("round-trip mismatch:\nexpected: %#v\ngot:      %#v", msg, got)
	}
}

func TestCategoryMapping_RoundTrip(t *testing.T) {
	id := uuid.MustParse("dddddddd-dddd-dddd-dddd-dddddddddddd")
	createdAt := time.Date(2026, 3, 18, 15, 0, 0, 0, time.UTC)

	c := domain.Category{
		ID:        id,
		Name:      "Music",
		CreatedAt: createdAt,
	}

	m := categoryDomainToModel(c)
	got := categoryModelToDomain(m)

	if got != c {
		t.Fatalf("round-trip mismatch:\nexpected: %#v\ngot:      %#v", c, got)
	}
}

func TestEventPhotoMapping_RoundTrip(t *testing.T) {
	id := uuid.MustParse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
	eventID := uuid.MustParse("ffffffff-ffff-ffff-ffff-ffffffffffff")
	createdAt := time.Date(2026, 3, 18, 16, 0, 0, 0, time.UTC)

	p := domain.EventPhoto{
		ID:          id,
		EventID:     eventID,
		Event:       nil,
		StoragePath: "/tmp/photo.jpg",
		Position:    3,
		CreatedAt:   createdAt,
	}

	m := eventPhotoDomainToModel(p)
	got := eventPhotoModelToDomain(m)

	if got != p {
		t.Fatalf("round-trip mismatch:\nexpected: %#v\ngot:      %#v", p, got)
	}
}
