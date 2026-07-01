package service

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"nexustickets/internal/domain"
)

// seedPublishedEvent inserts a published event with the given categories into
// the mock repos and returns its ID.
func seedPublishedEvent(events *mockEventRepo, cats ...domain.Category) uuid.UUID {
	id := uuid.New()
	events.events[id] = domain.Event{
		ID:      id,
		Title:   "Event " + id.String()[:8],
		Status:  domain.EventStatusPublished,
		StartAt: time.Now().Add(24 * time.Hour),
	}
	events.categories[id] = cats
	return id
}

func containsEvent(list []domain.Event, id uuid.UUID) bool {
	for _, e := range list {
		if e.ID == id {
			return true
		}
	}
	return false
}

func TestRecommended_ColdStartReturnsPopular(t *testing.T) {
	events := newMockEventRepo()
	music := domain.Category{ID: uuid.New(), Name: "Music"}
	e1 := seedPublishedEvent(events, music)
	e2 := seedPublishedEvent(events, music)

	svc := NewEventService(events, newMockBookingRepo(), newMockCategoryRepo(),
		newMockEventPhotoRepo(), newMockViewsRepo(), "", nil)

	// Guest (uuid.Nil) with no history -> should just get the published events.
	got, cats, err := svc.Recommended(context.Background(), uuid.Nil, 10)
	if err != nil {
		t.Fatalf("Recommended: %v", err)
	}
	if len(got) != 2 || len(cats) != 2 {
		t.Fatalf("expected 2 events, got %d (cats %d)", len(got), len(cats))
	}
	if !containsEvent(got, e1) || !containsEvent(got, e2) {
		t.Errorf("cold-start result missing seeded events")
	}
}

func TestRecommended_PersonalizedByCategoryAffinity(t *testing.T) {
	events := newMockEventRepo()
	bookings := newMockBookingRepo()

	music := domain.Category{ID: uuid.New(), Name: "Music"}
	sports := domain.Category{ID: uuid.New(), Name: "Sports"}

	booked := seedPublishedEvent(events, music) // user already booked this one
	musicEvent := seedPublishedEvent(events, music)
	sportsEvent := seedPublishedEvent(events, sports)

	userID := uuid.New()
	bookings.add(domain.Booking{
		UserID:  userID,
		EventID: booked,
		Status:  domain.BookingStatusConfirmed,
	})

	svc := NewEventService(events, bookings, newMockCategoryRepo(),
		newMockEventPhotoRepo(), newMockViewsRepo(), "", nil)

	got, _, err := svc.Recommended(context.Background(), userID, 10)
	if err != nil {
		t.Fatalf("Recommended: %v", err)
	}

	// The already-booked event must be excluded.
	if containsEvent(got, booked) {
		t.Errorf("already-booked event should not be recommended")
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 recommendations, got %d", len(got))
	}
	// The music event (matching the user's affinity) must outrank the sports event.
	if got[0].ID != musicEvent {
		t.Errorf("expected music event first (affinity match), got %v; sports=%v music=%v",
			got[0].ID, sportsEvent, musicEvent)
	}
}

func TestRecommended_DefaultLimit(t *testing.T) {
	events := newMockEventRepo()
	music := domain.Category{ID: uuid.New(), Name: "Music"}
	for i := 0; i < 25; i++ {
		seedPublishedEvent(events, music)
	}
	svc := NewEventService(events, newMockBookingRepo(), newMockCategoryRepo(),
		newMockEventPhotoRepo(), newMockViewsRepo(), "", nil)

	got, _, err := svc.Recommended(context.Background(), uuid.Nil, 0)
	if err != nil {
		t.Fatalf("Recommended: %v", err)
	}
	if len(got) != 20 {
		t.Errorf("expected default limit of 20, got %d", len(got))
	}
}
