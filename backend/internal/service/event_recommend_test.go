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

// fakeRecommender is a hand-controlled Recommender for testing EventService's
// ranking logic without training a real BMF model.
type fakeRecommender struct {
	users   map[uuid.UUID]bool
	scores  map[uuid.UUID]map[uuid.UUID]float64 // user -> event -> score
	popular []uuid.UUID
}

func (f *fakeRecommender) HasUser(id uuid.UUID) bool { return f.users[id] }

func (f *fakeRecommender) ScoreEvents(id uuid.UUID, eventIDs []uuid.UUID) map[uuid.UUID]float64 {
	out := make(map[uuid.UUID]float64)
	for _, e := range eventIDs {
		if v, ok := f.scores[id][e]; ok {
			out[e] = v
		}
	}
	return out
}

func (f *fakeRecommender) PopularEventIDs(limit int) []uuid.UUID {
	if limit <= 0 || limit > len(f.popular) {
		limit = len(f.popular)
	}
	return f.popular[:limit]
}

func TestRecommended_PersonalizedByBMFScore(t *testing.T) {
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

	// The model predicts a higher score for the music event than the sports one.
	rec := &fakeRecommender{
		users: map[uuid.UUID]bool{userID: true},
		scores: map[uuid.UUID]map[uuid.UUID]float64{
			userID: {booked: 5.0, musicEvent: 2.0, sportsEvent: 1.0},
		},
	}

	svc := NewEventService(events, bookings, newMockCategoryRepo(),
		newMockEventPhotoRepo(), newMockViewsRepo(), "", nil)
	svc.SetRecommender(rec)

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
	// The higher-scored music event must outrank the sports event.
	if got[0].ID != musicEvent {
		t.Errorf("expected music event first (higher BMF score), got %v; sports=%v music=%v",
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
