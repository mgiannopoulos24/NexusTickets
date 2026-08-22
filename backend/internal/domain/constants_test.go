package domain

import "testing"

// COMPLETED is its own state now — it used to be an alias for "deleted", which
// meant a finished event was indistinguishable from a removed one.
func TestEventStatusCompletedIsDistinct(t *testing.T) {
	if EventStatusCompleted == EventStatusDeleted {
		t.Fatal("EventStatusCompleted must not alias EventStatusDeleted")
	}
	if EventStatusCompleted != "completed" {
		t.Fatalf("EventStatusCompleted = %q, want %q", EventStatusCompleted, "completed")
	}
}

func TestValidEventStatus(t *testing.T) {
	for _, s := range []EventStatus{
		EventStatusDraft, EventStatusPublished, EventStatusCompleted, EventStatusCancelled,
	} {
		if !ValidEventStatus(s) {
			t.Errorf("ValidEventStatus(%q) = false, want true", s)
		}
	}
	for _, s := range []EventStatus{"", "deleted", "archived", "PUBLISHED"} {
		if ValidEventStatus(s) {
			t.Errorf("ValidEventStatus(%q) = true, want false", s)
		}
	}
}

func TestValidAssignableRole(t *testing.T) {
	if !ValidAssignableRole(UserRoleAttendee) || !ValidAssignableRole(UserRoleOrganizer) {
		t.Fatal("attendee and organizer must be assignable")
	}
	// Admin is never assignable through the role endpoint, and guest is never
	// persisted on an account.
	if ValidAssignableRole(UserRoleAdmin) || ValidAssignableRole(UserRoleGuest) {
		t.Fatal("admin and guest must not be assignable")
	}
}
