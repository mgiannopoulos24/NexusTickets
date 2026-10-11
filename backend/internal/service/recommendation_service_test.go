package service

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"nexustickets/internal/domain"
)

// confirmedBooking adds a confirmed booking (user -> event) to the mock repo.
func confirmedBooking(repo *mockBookingRepo, userID, eventID uuid.UUID) {
	repo.add(domain.Booking{
		UserID:  userID,
		EventID: eventID,
		Status:  domain.BookingStatusConfirmed,
	})
}

func TestRecommendationService_TrainsFromDBAndScoresRealEvents(t *testing.T) {
	bookings := newMockBookingRepo()
	views := newMockViewsRepo()

	userA := uuid.New()
	userB := uuid.New()
	eventX := uuid.New()
	eventY := uuid.New()
	eventZ := uuid.New()

	// X booked by A and B, Y booked by A, Z only viewed by A.
	confirmedBooking(bookings, userA, eventX)
	confirmedBooking(bookings, userA, eventY)
	confirmedBooking(bookings, userB, eventX)
	if err := views.Record(context.Background(), userA, eventZ); err != nil {
		t.Fatalf("record view: %v", err)
	}

	svc := NewRecommendationService(bookings, views)
	svc.Train(context.Background())

	// Users with history are known; a random user is not.
	if !svc.HasUser(userA) {
		t.Error("expected userA to be known to the model")
	}
	if svc.HasUser(uuid.New()) {
		t.Error("expected an unseen user to be unknown")
	}

	// Scores are produced for events the model knows, keyed by real UUIDs.
	scores := svc.ScoreEvents(userA, []uuid.UUID{eventX, eventY, eventZ, uuid.New()})
	for _, id := range []uuid.UUID{eventX, eventY, eventZ} {
		if _, ok := scores[id]; !ok {
			t.Errorf("expected a score for event %s", id)
		}
	}
	if len(scores) != 3 {
		t.Errorf("expected 3 scored events, got %d", len(scores))
	}

	// Popularity: X (2 bookers) ranks ahead of Y (1 booker); Z (view only) absent.
	popular := svc.PopularEventIDs(0)
	if len(popular) != 2 {
		t.Fatalf("expected 2 popular events, got %d", len(popular))
	}
	if popular[0] != eventX {
		t.Errorf("expected eventX first in popularity, got %s", popular[0])
	}
}

func TestRecommendationService_ColdStartNoData(t *testing.T) {
	svc := NewRecommendationService(newMockBookingRepo(), newMockViewsRepo())
	svc.Train(context.Background())

	if svc.HasUser(uuid.New()) {
		t.Error("expected no known users with no data")
	}
	if got := svc.ScoreEvents(uuid.New(), []uuid.UUID{uuid.New()}); len(got) != 0 {
		t.Errorf("expected no scores with no model, got %d", len(got))
	}
	if got := svc.PopularEventIDs(10); len(got) != 0 {
		t.Errorf("expected no popular events with no data, got %d", len(got))
	}
	status := svc.Status()
	if status["model_loaded"] != false {
		t.Errorf("expected model_loaded=false, got %v", status["model_loaded"])
	}
}
