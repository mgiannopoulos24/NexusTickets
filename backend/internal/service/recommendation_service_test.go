package service

import (
	"os"
	"path/filepath"
	"testing"
)

func writeCSV(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600); err != nil {
		t.Fatalf("write %s: %v", name, err)
	}
}

func testUserEventData() (*userData, *eventData) {
	users := &userData{
		userIDs: []int{10, 20},
		idxMap:  map[int]int{10: 0, 20: 1},
	}
	events := &eventData{
		eventIDs: []int{100, 200, 300},
		idxMap:   map[int]int{100: 0, 200: 1, 300: 2},
	}
	return users, events
}

func ratingValue(ratings []Rating, userIdx, itemIdx int) (float64, bool) {
	for _, r := range ratings {
		if r.UserIdx == userIdx && r.ItemIdx == itemIdx {
			return r.Value, true
		}
	}
	return 0, false
}

func TestLoadRatings_ImplicitScoring(t *testing.T) {
	dir := t.TempDir()
	users, events := testUserEventData()

	// user 10 -> interested in event 100 (view), not_interested in 200 (skip),
	//            invited-only to 300 (view).
	writeCSV(t, dir, "event_interest.csv",
		"user,event,invited,timestamp,interested,not_interested\n"+
			"10,100,0,t,1,0\n"+
			"10,200,0,t,0,1\n"+
			"10,300,1,t,0,0\n"+
			"99,100,0,t,1,0\n") // unknown user -> skipped

	// user 10 booked event 100 (book, upgrades the view score);
	// user 20 booked event 200; a "no"/"maybe" row is ignored.
	writeCSV(t, dir, "event_attendees.csv",
		"_,event,status,user_id,start_time\n"+
			"1,100,yes,10,t\n"+
			"2,200,yes,20,t\n"+
			"3,300,no,20,t\n"+
			"4,300,maybe,20,t\n")

	s := &RecommendationService{dataDir: dir}
	ratings, err := s.loadRatings(users, events)
	if err != nil {
		t.Fatalf("loadRatings: %v", err)
	}

	// user 10 / event 100: view + book -> book wins (3.0)
	if v, ok := ratingValue(ratings, 0, 0); !ok || v != scoreBook {
		t.Errorf("user10/event100 = %v (ok=%v), want %v", v, ok, scoreBook)
	}
	// user 10 / event 200: only not_interested -> no rating
	if v, ok := ratingValue(ratings, 0, 1); ok {
		t.Errorf("user10/event200 should be absent, got %v", v)
	}
	// user 10 / event 300: invited-only view -> 1.0
	if v, ok := ratingValue(ratings, 0, 2); !ok || v != scoreView {
		t.Errorf("user10/event300 = %v (ok=%v), want %v", v, ok, scoreView)
	}
	// user 20 / event 200: booking only -> 3.0
	if v, ok := ratingValue(ratings, 1, 1); !ok || v != scoreBook {
		t.Errorf("user20/event200 = %v (ok=%v), want %v", v, ok, scoreBook)
	}
	// unknown user 99 skipped, so only the 4 pairs above (minus the skipped one) exist
	if len(ratings) != 3 {
		t.Errorf("len(ratings) = %d, want 3", len(ratings))
	}
}

func TestLoadRatings_BookWinsRegardlessOfOrder(t *testing.T) {
	dir := t.TempDir()
	users, events := testUserEventData()

	// No interest rows; only a booking.
	writeCSV(t, dir, "event_interest.csv",
		"user,event,invited,timestamp,interested,not_interested\n")
	writeCSV(t, dir, "event_attendees.csv",
		"_,event,status,user_id,start_time\n"+
			"1,100,yes,10,t\n")

	s := &RecommendationService{dataDir: dir}
	ratings, err := s.loadRatings(users, events)
	if err != nil {
		t.Fatalf("loadRatings: %v", err)
	}
	if len(ratings) != 1 {
		t.Fatalf("len(ratings) = %d, want 1", len(ratings))
	}
	if ratings[0].Value != scoreBook {
		t.Errorf("value = %v, want %v", ratings[0].Value, scoreBook)
	}
}
