package integration

import (
	"context"
	"net/http"
	"testing"
	"time"

	"nexustickets/internal/domain"
)

// recommended returns the ids of the recommended events, in order.
func (e *env) recommended(t *testing.T, token string) []string {
	t.Helper()
	var events []eventJSON
	must(t, e.call(t, http.MethodGet, "/api/v1/events/recommended?limit=200", token, nil), http.StatusOK).into(t, &events)
	ids := make([]string, 0, len(events))
	for _, ev := range events {
		ids = append(ids, ev.ID)
	}
	return ids
}

func indexOf(ids []string, id string) int {
	for i, v := range ids {
		if v == id {
			return i
		}
	}
	return -1
}

func TestRecommendations_ColdStartAndHistory(t *testing.T) {
	e := setup(t)
	org := e.newUser(t, domain.UserRoleOrganizer)
	// Far in the future, so both sort into the candidate pool ahead of the
	// events other tests create.
	far := time.Now().Add(5 * 365 * 24 * time.Hour)
	popular := e.publishedEvent(t, org, eventSpec{tickets: 10, start: far.Add(time.Hour)})
	quiet := e.publishedEvent(t, org, eventSpec{tickets: 10, start: far})

	var bookers []user
	for i := 0; i < 3; i++ {
		fan := e.newUser(t, domain.UserRoleAttendee)
		b := e.hold(t, fan, popular, 1)
		must(t, e.call(t, http.MethodPatch, "/api/v1/bookings/"+b.ID+"/confirm", fan.token, nil), http.StatusOK)
		bookers = append(bookers, fan)
	}
	// A user with no bookings, only a visit (§13: views alone drive them).
	browser := e.newUser(t, domain.UserRoleAttendee)
	must(t, e.call(t, http.MethodGet, "/api/v1/events/"+quiet.ID, browser.token, nil), http.StatusOK)
	newcomer := e.newUser(t, domain.UserRoleAttendee)

	rec := e.deps.RecommendationService
	rec.Train(context.Background())

	// Guests and users the model has not seen get the popularity order.
	for name, token := range map[string]string{"guest": "", "newcomer": newcomer.token} {
		ids := e.recommended(t, token)
		p, q := indexOf(ids, popular.ID), indexOf(ids, quiet.ID)
		if p < 0 || q < 0 || p > q {
			t.Errorf("%s: popular at %d, quiet at %d; want the booked event first", name, p, q)
		}
	}
	if rec.HasUser(newcomer.ID) {
		t.Error("a user with no history is in the model")
	}

	// Views alone are enough to be learned.
	if !rec.HasUser(browser.ID) {
		t.Fatal("a user with only a view is not in the model")
	}
	if ids := e.recommended(t, browser.token); len(ids) == 0 {
		t.Fatal("no recommendations for a user known by views")
	}

	// A user is never recommended what they already booked.
	if !rec.HasUser(bookers[0].ID) {
		t.Fatal("a booker is not in the model")
	}
	ids := e.recommended(t, bookers[0].token)
	if indexOf(ids, popular.ID) >= 0 {
		t.Error("recommended an event the user already booked")
	}
	if indexOf(ids, quiet.ID) < 0 {
		t.Errorf("the other open event is missing: %v", ids)
	}
}
