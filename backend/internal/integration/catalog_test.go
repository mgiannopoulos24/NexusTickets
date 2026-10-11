package integration

import (
	"encoding/xml"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"nexustickets/internal/domain"
)

// searchTitles runs a public search and returns the titles found.
func (e *env) searchTitles(t *testing.T, q string) []string {
	t.Helper()
	var events []eventJSON
	must(t, e.call(t, http.MethodGet, "/api/v1/events/search?limit=50&offset=0&q="+url.QueryEscape(q), "", nil), http.StatusOK).into(t, &events)
	titles := make([]string, 0, len(events))
	for _, ev := range events {
		titles = append(titles, ev.Title)
	}
	return titles
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

func TestSearch_AsYouType(t *testing.T) {
	e := setup(t)
	org := e.newUser(t, domain.UserRoleOrganizer)
	tag := unique("Ζ")
	concert := e.publishedEvent(t, org, eventSpec{title: "Μεγάλη Συναυλία " + tag, city: "Θεσσαλονίκη", venue: "Μύλος"})
	play := e.publishedEvent(t, org, eventSpec{title: "Θεατρική Παράσταση " + tag, city: "Πάτρα", venue: "Δημοτικό Θέατρο"})

	// A draft never shows up in public search.
	draftTitle := "Συναυλία Πρόχειρη " + tag
	must(t, e.call(t, http.MethodPost, "/api/v1/events/organizer", org.token, map[string]any{
		"title": draftTitle, "description": "draft", "venue": "Χ", "event_type": "concert", "city": "Αθήνα",
		"start_at": "2099-01-01T20:00:00Z", "end_at": "2099-01-01T22:00:00Z", "capacity": 10,
		"categories":   []string{"Μουσική"},
		"ticket_types": []map[string]any{{"name": "Κανονικό", "price": 5, "quantity": 10}},
	}), http.StatusCreated)

	cases := []struct {
		q    string
		want []string
		not  []string
	}{
		// A half-typed last word matches as a prefix.
		{q: "Συναυ " + tag, want: []string{concert.Title}, not: []string{play.Title, draftTitle}},
		{q: tag + " Θεατρ", want: []string{play.Title}, not: []string{concert.Title}},
		// Venue and city match as substrings too.
		{q: "Μύλο", want: []string{concert.Title}},
		{q: "Πάτρ", want: []string{play.Title}},
		// Whole words still work.
		{q: "Συναυλία " + tag, want: []string{concert.Title}, not: []string{draftTitle}},
	}
	for _, c := range cases {
		got := e.searchTitles(t, c.q)
		for _, w := range c.want {
			if !contains(got, w) {
				t.Errorf("q=%q: missing %q in %v", c.q, w, got)
			}
		}
		for _, n := range c.not {
			if contains(got, n) {
				t.Errorf("q=%q: unexpected %q", c.q, n)
			}
		}
	}

	// tsquery syntax in the box is not an error.
	for _, q := range []string{"&", "a & !b | (c", "':*", "'; DROP TABLE events; --"} {
		r := e.call(t, http.MethodGet, "/api/v1/events/search?limit=3&offset=0&q="+url.QueryEscape(q), "", nil)
		if r.status != http.StatusOK {
			t.Errorf("q=%q: status %d", q, r.status)
		}
	}
	if got := e.searchTitles(t, tag); !contains(got, concert.Title) {
		t.Fatalf("events table damaged? search after odd queries: %v", got)
	}
}

func TestTicketTypes_RemovableAfterLapsedHold(t *testing.T) {
	e := setup(t)
	org := e.newUser(t, domain.UserRoleOrganizer)
	fan := e.newUser(t, domain.UserRoleAttendee)
	ev := e.publishedEvent(t, org, eventSpec{tickets: 10})

	// A second ticket type, held and then released.
	var withVIP eventJSON
	must(t, e.call(t, http.MethodPost, "/api/v1/events/organizer/"+ev.ID+"/ticket-types", org.token, map[string]any{
		"name": "VIP", "price": 50, "quantity": 0,
	}), http.StatusOK).into(t, &withVIP)
	var vip ticketTypeJSON
	for _, tt := range withVIP.TicketTypes {
		if tt.Name == "VIP" {
			vip = tt
		}
	}
	if vip.ID == "" {
		t.Fatalf("VIP ticket type not created: %+v", withVIP.TicketTypes)
	}

	b := e.hold(t, fan, ev, 1)
	path := "/api/v1/events/organizer/" + ev.ID + "/ticket-types/" + ev.TicketTypes[0].ID
	if r := e.call(t, http.MethodDelete, path, org.token, nil); r.status != http.StatusUnprocessableEntity {
		t.Fatalf("delete ticket type with a live hold: %d", r.status)
	}
	must(t, e.call(t, http.MethodPatch, "/api/v1/bookings/"+b.ID+"/cancel", fan.token, nil), http.StatusOK)
	if r := e.call(t, http.MethodDelete, path, org.token, nil); r.status != http.StatusOK {
		t.Fatalf("delete ticket type after the hold was released: %d %s", r.status, r.errCode())
	}
}

func TestAuth_RegistrationNeedsApproval(t *testing.T) {
	e := setup(t)
	admin := e.newUser(t, domain.UserRoleAdmin)
	name := unique("newcomer")

	// The auth group is rate limited per client, so this test keeps to the
	// few calls it needs.
	var created struct {
		ID            string `json:"id"`
		AccountStatus string `json:"account_status"`
	}
	must(t, e.call(t, http.MethodPost, "/api/v1/auth/register", "", map[string]any{
		"username": name, "password": password, "confirm_password": password,
		"first_name": "Νέος", "last_name": "Χρήστης", "email": name + "@example.com",
		"phone": "+30 210 1234567", "address": "Πανεπιστημίου 30", "city": "Αθήνα", "country": "Ελλάδα",
		"vat_number": "123456789", "role": "attendee",
	}), http.StatusCreated).into(t, &created)
	if created.AccountStatus != "pending" {
		t.Fatalf("new account status %q, want pending", created.AccountStatus)
	}

	login := func() reply {
		return e.call(t, http.MethodPost, "/api/v1/auth/login", "", map[string]any{"username": name, "password": password})
	}
	if r := login(); r.status/100 == 2 {
		t.Fatal("a pending account could sign in")
	}

	must(t, e.call(t, http.MethodPatch, "/api/v1/users/admin/"+created.ID+"/approve", admin.token, nil), http.StatusOK)

	var tokens struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
	}
	must(t, login(), http.StatusOK).into(t, &tokens)

	var me struct {
		Username string `json:"username"`
	}
	must(t, e.call(t, http.MethodGet, "/api/v1/users/me", tokens.AccessToken, nil), http.StatusOK).into(t, &me)
	if me.Username != name {
		t.Fatalf("me = %q, want %q", me.Username, name)
	}

	var refreshed struct {
		AccessToken string `json:"access_token"`
	}
	must(t, e.call(t, http.MethodPost, "/api/v1/auth/refresh", "", map[string]any{"refresh_token": tokens.RefreshToken}), http.StatusOK).into(t, &refreshed)
	if refreshed.AccessToken == "" {
		t.Fatal("refresh returned no access token")
	}

	// Only an administrator approves accounts.
	if r := e.call(t, http.MethodPatch, "/api/v1/users/admin/"+created.ID+"/approve", tokens.AccessToken, nil); r.status != http.StatusForbidden {
		t.Fatalf("attendee approving: %d", r.status)
	}
}

func TestExport_BookingStatuses(t *testing.T) {
	e := setup(t)
	admin := e.newUser(t, domain.UserRoleAdmin)
	org := e.newUser(t, domain.UserRoleOrganizer)
	fan := e.newUser(t, domain.UserRoleAttendee)
	ev := e.publishedEvent(t, org, eventSpec{tickets: 10, price: 9})

	confirmed := e.hold(t, fan, ev, 2)
	must(t, e.call(t, http.MethodPatch, "/api/v1/bookings/"+confirmed.ID+"/confirm", fan.token, nil), http.StatusOK)
	released := e.hold(t, fan, ev, 1)
	must(t, e.call(t, http.MethodPatch, "/api/v1/bookings/"+released.ID+"/cancel", fan.token, nil), http.StatusOK)
	pending := e.hold(t, fan, ev, 3)

	r := must(t, e.call(t, http.MethodGet, "/api/v1/admin/events/export/xml", admin.token, nil), http.StatusOK)
	var doc struct {
		Events []struct {
			ID       string `xml:"EventID,attr"`
			Bookings []struct {
				ID     string `xml:"BookingID,attr"`
				Status string `xml:"BookingStatus"`
				Count  int    `xml:"NumberOfTickets"`
			} `xml:"Bookings>Booking"`
		} `xml:"Event"`
	}
	if err := xml.Unmarshal(r.Data, &doc); err != nil {
		t.Fatalf("export is not XML: %v\n%s", err, r.Data)
	}
	statuses := map[string]string{}
	for _, x := range doc.Events {
		if x.ID != ev.ID {
			continue
		}
		for _, b := range x.Bookings {
			statuses[b.ID] = b.Status
		}
	}
	want := map[string]string{confirmed.ID: "CONFIRMED", released.ID: "CANCELLED", pending.ID: "PENDING"}
	for id, status := range want {
		if statuses[id] != status {
			t.Errorf("booking %s exported as %q, want %q (all: %v)", id, statuses[id], status, statuses)
		}
	}

	r = must(t, e.call(t, http.MethodGet, "/api/v1/admin/events/export/json", admin.token, nil), http.StatusOK)
	if !strings.Contains(string(r.body), confirmed.ID) || !strings.Contains(string(r.body), "PENDING") {
		t.Fatalf("JSON export lacks the event's bookings: %.300s", r.body)
	}
	if r := e.call(t, http.MethodGet, "/api/v1/admin/events/export/xml", org.token, nil); r.status != http.StatusForbidden {
		t.Fatalf("organizer exporting: %d", r.status)
	}
}
