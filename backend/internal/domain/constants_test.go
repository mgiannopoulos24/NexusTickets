package domain

import "testing"

func TestEventStatusCompletedMapsToDeleted(t *testing.T) {
	if EventStatusCompleted != EventStatusDeleted {
		t.Fatalf("expected EventStatusCompleted == EventStatusDeleted, got %q vs %q", EventStatusCompleted, EventStatusDeleted)
	}
}

