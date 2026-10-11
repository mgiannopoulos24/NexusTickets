package integration

import (
	"context"
	"net/http"
	"sync"
	"testing"
	"time"

	"nexustickets/internal/domain"
)

func TestBooking_HoldConfirm(t *testing.T) {
	e := setup(t)
	org := e.newUser(t, domain.UserRoleOrganizer)
	fan := e.newUser(t, domain.UserRoleAttendee)
	ev := e.publishedEvent(t, org, eventSpec{tickets: 10, price: 12.5})

	b := e.hold(t, fan, ev, 3)
	if b.Status != "pending" || b.ConfirmedAt != nil || b.HoldExpiresAt == nil {
		t.Fatalf("new booking: status %s, confirmed_at %v, hold_expires_at %v", b.Status, b.ConfirmedAt, b.HoldExpiresAt)
	}
	if b.TotalCost != 37.5 {
		t.Fatalf("total %v, want 37.5", b.TotalCost)
	}
	expires, err := time.Parse(time.RFC3339, *b.HoldExpiresAt)
	if err != nil {
		t.Fatalf("hold_expires_at: %v", err)
	}
	if left := time.Until(expires); left < domain.BookingHoldTTL-time.Minute || left > domain.BookingHoldTTL+time.Minute {
		t.Fatalf("hold lasts %v, want about %v", left, domain.BookingHoldTTL)
	}
	if got := e.available(t, ev.ID); got != 7 {
		t.Fatalf("available while held = %d, want 7", got)
	}

	var confirmed bookingJSON
	must(t, e.call(t, http.MethodPatch, "/api/v1/bookings/"+b.ID+"/confirm", fan.token, nil), http.StatusOK).into(t, &confirmed)
	if confirmed.Status != "confirmed" || confirmed.ConfirmedAt == nil || confirmed.HoldExpiresAt != nil {
		t.Fatalf("confirmed booking: %+v", confirmed)
	}
	if got := e.available(t, ev.ID); got != 7 {
		t.Fatalf("available after confirm = %d, want 7", got)
	}

	// §9: a confirmed booking is final.
	r := e.call(t, http.MethodPatch, "/api/v1/bookings/"+b.ID+"/cancel", fan.token, nil)
	if r.status != http.StatusConflict || r.errCode() != "booking_not_pending" {
		t.Fatalf("cancel confirmed: %d %s", r.status, r.errCode())
	}
	r = e.call(t, http.MethodPatch, "/api/v1/bookings/"+b.ID+"/confirm", fan.token, nil)
	if r.status != http.StatusConflict {
		t.Fatalf("confirm twice: %d", r.status)
	}

	var mine []bookingJSON
	must(t, e.call(t, http.MethodGet, "/api/v1/bookings/me", fan.token, nil), http.StatusOK).into(t, &mine)
	if len(mine) != 1 || mine[0].Status != "confirmed" {
		t.Fatalf("my bookings: %+v", mine)
	}
}

func TestBooking_ReleaseReturnsSeats(t *testing.T) {
	e := setup(t)
	org := e.newUser(t, domain.UserRoleOrganizer)
	fan := e.newUser(t, domain.UserRoleAttendee)
	ev := e.publishedEvent(t, org, eventSpec{tickets: 5})

	b := e.hold(t, fan, ev, 5)
	if got := e.available(t, ev.ID); got != 0 {
		t.Fatalf("available = %d, want 0", got)
	}
	// Sold out while held: nobody else can take the seats.
	other := e.newUser(t, domain.UserRoleAttendee)
	r := e.call(t, http.MethodPost, "/api/v1/bookings", other.token, map[string]any{
		"event_id": ev.ID, "ticket_type_id": ev.TicketTypes[0].ID, "quantity": 1,
	})
	if r.status != http.StatusConflict || r.errCode() != "capacity_exceeded" {
		t.Fatalf("book sold-out event: %d %s", r.status, r.errCode())
	}

	var released bookingJSON
	must(t, e.call(t, http.MethodPatch, "/api/v1/bookings/"+b.ID+"/cancel", fan.token, nil), http.StatusOK).into(t, &released)
	if released.Status != "cancelled" || released.ConfirmedAt != nil {
		t.Fatalf("released booking: %+v", released)
	}
	if got := e.available(t, ev.ID); got != 5 {
		t.Fatalf("available after release = %d, want 5", got)
	}

	// Releasing again changes nothing.
	r = e.call(t, http.MethodPatch, "/api/v1/bookings/"+b.ID+"/cancel", fan.token, nil)
	if r.status != http.StatusConflict {
		t.Fatalf("release twice: %d", r.status)
	}
	if got := e.available(t, ev.ID); got != 5 {
		t.Fatalf("available after second release = %d, want 5", got)
	}
}

func TestBooking_OnlyTheBookerMayDecide(t *testing.T) {
	e := setup(t)
	org := e.newUser(t, domain.UserRoleOrganizer)
	fan := e.newUser(t, domain.UserRoleAttendee)
	stranger := e.newUser(t, domain.UserRoleAttendee)
	ev := e.publishedEvent(t, org, eventSpec{})
	b := e.hold(t, fan, ev, 1)

	for _, action := range []string{"confirm", "cancel"} {
		r := e.call(t, http.MethodPatch, "/api/v1/bookings/"+b.ID+"/"+action, stranger.token, nil)
		if r.status != http.StatusForbidden {
			t.Errorf("%s by a stranger: %d", action, r.status)
		}
		// Not even the event's organizer.
		r = e.call(t, http.MethodPatch, "/api/v1/bookings/"+b.ID+"/"+action, org.token, nil)
		if r.status != http.StatusForbidden {
			t.Errorf("%s by the organizer: %d", action, r.status)
		}
		r = e.call(t, http.MethodPatch, "/api/v1/bookings/"+b.ID+"/"+action, "", nil)
		if r.status != http.StatusUnauthorized {
			t.Errorf("%s by a guest: %d", action, r.status)
		}
	}
	r := e.call(t, http.MethodPatch, "/api/v1/bookings/not-a-uuid/confirm", fan.token, nil)
	if r.status != http.StatusBadRequest {
		t.Errorf("malformed id: %d", r.status)
	}
	r = e.call(t, http.MethodPatch, "/api/v1/bookings/01900000-0000-7000-8000-000000000000/confirm", fan.token, nil)
	if r.status != http.StatusNotFound {
		t.Errorf("unknown id: %d", r.status)
	}
}

func TestBooking_ExpiredHolds(t *testing.T) {
	e := setup(t)
	org := e.newUser(t, domain.UserRoleOrganizer)
	fan := e.newUser(t, domain.UserRoleAttendee)
	ev := e.publishedEvent(t, org, eventSpec{tickets: 10})

	t.Run("confirming a lapsed hold releases it", func(t *testing.T) {
		b := e.hold(t, fan, ev, 2)
		e.ageBooking(t, b.ID, domain.BookingHoldTTL+time.Second)

		r := e.call(t, http.MethodPatch, "/api/v1/bookings/"+b.ID+"/confirm", fan.token, nil)
		if r.status != http.StatusUnprocessableEntity {
			t.Fatalf("confirm lapsed hold: %d %s", r.status, r.errCode())
		}
		var got bookingJSON
		must(t, e.call(t, http.MethodGet, "/api/v1/bookings/"+b.ID, fan.token, nil), http.StatusOK).into(t, &got)
		if got.Status != "cancelled" {
			t.Fatalf("status %s, want cancelled", got.Status)
		}
		if a := e.available(t, ev.ID); a != 10 {
			t.Fatalf("available = %d, want 10", a)
		}
	})

	t.Run("the sweeper releases only lapsed holds, per ticket type", func(t *testing.T) {
		stale1 := e.hold(t, fan, ev, 1)
		stale2 := e.hold(t, fan, ev, 2)
		fresh := e.hold(t, fan, ev, 3)
		e.ageBooking(t, stale1.ID, domain.BookingHoldTTL+time.Minute)
		e.ageBooking(t, stale2.ID, domain.BookingHoldTTL+time.Minute)
		if a := e.available(t, ev.ID); a != 4 {
			t.Fatalf("available before sweep = %d, want 4", a)
		}

		n, err := e.deps.BookingService.ReleaseExpiredHolds(context.Background())
		if err != nil {
			t.Fatalf("sweep: %v", err)
		}
		if n < 2 {
			t.Fatalf("released %d holds, want at least 2", n)
		}
		if a := e.available(t, ev.ID); a != 7 {
			t.Fatalf("available after sweep = %d, want 7 (only the fresh hold of 3 left)", a)
		}
		var got bookingJSON
		must(t, e.call(t, http.MethodGet, "/api/v1/bookings/"+fresh.ID, fan.token, nil), http.StatusOK).into(t, &got)
		if got.Status != "pending" {
			t.Fatalf("fresh hold status %s, want pending", got.Status)
		}
		// A second sweep has nothing left to do for this event.
		before := e.available(t, ev.ID)
		if _, err := e.deps.BookingService.ReleaseExpiredHolds(context.Background()); err != nil {
			t.Fatalf("second sweep: %v", err)
		}
		if a := e.available(t, ev.ID); a != before {
			t.Fatalf("second sweep moved seats: %d -> %d", before, a)
		}
	})
}

// Assignment §9 and the TODO's open item: concurrent bookings must never sell
// more seats than exist.
func TestBooking_ConcurrentHoldsNeverOversell(t *testing.T) {
	e := setup(t)
	org := e.newUser(t, domain.UserRoleOrganizer)
	ev := e.publishedEvent(t, org, eventSpec{tickets: 7})

	const buyers = 20
	fans := make([]user, buyers)
	for i := range fans {
		fans[i] = e.newUser(t, domain.UserRoleAttendee)
	}

	var (
		wg       sync.WaitGroup
		mu       sync.Mutex
		ok, full int
		other    []int
	)
	for _, fan := range fans {
		wg.Add(1)
		go func(fan user) {
			defer wg.Done()
			r := e.call(t, http.MethodPost, "/api/v1/bookings", fan.token, map[string]any{
				"event_id": ev.ID, "ticket_type_id": ev.TicketTypes[0].ID, "quantity": 1,
			})
			mu.Lock()
			defer mu.Unlock()
			switch r.status {
			case http.StatusCreated:
				ok++
			case http.StatusConflict:
				full++
			default:
				other = append(other, r.status)
			}
		}(fan)
	}
	wg.Wait()

	if len(other) > 0 {
		t.Fatalf("unexpected statuses: %v", other)
	}
	if ok != 7 || full != buyers-7 {
		t.Fatalf("%d booked, %d turned away; want 7 and %d", ok, full, buyers-7)
	}
	if a := e.available(t, ev.ID); a != 0 {
		t.Fatalf("available = %d, want 0", a)
	}
}

func TestBooking_EventRules(t *testing.T) {
	e := setup(t)
	org := e.newUser(t, domain.UserRoleOrganizer)
	fan := e.newUser(t, domain.UserRoleAttendee)

	t.Run("guests cannot book", func(t *testing.T) {
		ev := e.publishedEvent(t, org, eventSpec{})
		r := e.call(t, http.MethodPost, "/api/v1/bookings", "", map[string]any{
			"event_id": ev.ID, "ticket_type_id": ev.TicketTypes[0].ID, "quantity": 1,
		})
		if r.status != http.StatusUnauthorized {
			t.Fatalf("guest booking: %d", r.status)
		}
	})

	t.Run("a ticket type from another event is refused", func(t *testing.T) {
		a := e.publishedEvent(t, org, eventSpec{})
		b := e.publishedEvent(t, org, eventSpec{})
		r := e.call(t, http.MethodPost, "/api/v1/bookings", fan.token, map[string]any{
			"event_id": a.ID, "ticket_type_id": b.TicketTypes[0].ID, "quantity": 1,
		})
		if r.status != http.StatusNotFound {
			t.Fatalf("mismatched ticket type: %d", r.status)
		}
	})

	t.Run("quantity must be positive", func(t *testing.T) {
		ev := e.publishedEvent(t, org, eventSpec{})
		r := e.call(t, http.MethodPost, "/api/v1/bookings", fan.token, map[string]any{
			"event_id": ev.ID, "ticket_type_id": ev.TicketTypes[0].ID, "quantity": 0,
		})
		if r.status != http.StatusUnprocessableEntity {
			t.Fatalf("zero quantity: %d", r.status)
		}
	})

	t.Run("a hold blocks deleting the event; a lapsed one does not", func(t *testing.T) {
		ev := e.publishedEvent(t, org, eventSpec{})
		b := e.hold(t, fan, ev, 1)
		r := e.call(t, http.MethodDelete, "/api/v1/events/organizer/"+ev.ID, org.token, nil)
		if r.status != http.StatusUnprocessableEntity {
			t.Fatalf("delete with a live hold: %d", r.status)
		}
		must(t, e.call(t, http.MethodPatch, "/api/v1/bookings/"+b.ID+"/cancel", fan.token, nil), http.StatusOK)
		r = e.call(t, http.MethodDelete, "/api/v1/events/organizer/"+ev.ID, org.token, nil)
		if r.status/100 != 2 {
			t.Fatalf("delete with only a released hold: %d %s", r.status, r.errCode())
		}
	})

	t.Run("a confirmed booking blocks deleting the event", func(t *testing.T) {
		ev := e.publishedEvent(t, org, eventSpec{})
		b := e.hold(t, fan, ev, 1)
		must(t, e.call(t, http.MethodPatch, "/api/v1/bookings/"+b.ID+"/confirm", fan.token, nil), http.StatusOK)
		r := e.call(t, http.MethodDelete, "/api/v1/events/organizer/"+ev.ID, org.token, nil)
		if r.status != http.StatusUnprocessableEntity {
			t.Fatalf("delete with a confirmed booking: %d", r.status)
		}
	})
}

func TestBooking_EventCancellation(t *testing.T) {
	e := setup(t)
	org := e.newUser(t, domain.UserRoleOrganizer)
	confirmedFan := e.newUser(t, domain.UserRoleAttendee)
	holdingFan := e.newUser(t, domain.UserRoleAttendee)
	ev := e.publishedEvent(t, org, eventSpec{tickets: 10})

	confirmed := e.hold(t, confirmedFan, ev, 2)
	must(t, e.call(t, http.MethodPatch, "/api/v1/bookings/"+confirmed.ID+"/confirm", confirmedFan.token, nil), http.StatusOK)
	held := e.hold(t, holdingFan, ev, 3)

	must(t, e.call(t, http.MethodPatch, "/api/v1/events/organizer/"+ev.ID+"/cancel", org.token, nil), http.StatusOK)

	var bookings []bookingJSON
	must(t, e.call(t, http.MethodGet, "/api/v1/bookings/organizer/events/"+ev.ID, org.token, nil), http.StatusOK).into(t, &bookings)
	byID := map[string]bookingJSON{}
	for _, b := range bookings {
		byID[b.ID] = b
	}
	if b := byID[confirmed.ID]; b.Status != "cancelled" || b.ConfirmedAt == nil {
		t.Fatalf("confirmed booking after event cancel: %+v", b)
	}
	if b := byID[held.ID]; b.Status != "cancelled" || b.ConfirmedAt != nil {
		t.Fatalf("held booking after event cancel: %+v", b)
	}

	// The held seats came back; the sold ones stay counted as sold.
	if a := e.available(t, ev.ID); a != 8 {
		t.Fatalf("available after cancel = %d, want 8", a)
	}

	// §10: everyone with a confirmed booking is told; a hold is not a booking.
	inbox := func(u user) []struct {
		Subject string `json:"subject"`
	} {
		var msgs []struct {
			Subject string `json:"subject"`
		}
		must(t, e.call(t, http.MethodGet, "/api/v1/messages/inbox", u.token, nil), http.StatusOK).into(t, &msgs)
		return msgs
	}
	if msgs := inbox(confirmedFan); len(msgs) != 1 {
		t.Fatalf("confirmed fan got %d messages, want the cancellation notice", len(msgs))
	}
	if msgs := inbox(holdingFan); len(msgs) != 0 {
		t.Fatalf("fan with only a hold got %d messages", len(msgs))
	}

	// The event takes no bookings any more.
	r := e.call(t, http.MethodPost, "/api/v1/bookings", holdingFan.token, map[string]any{
		"event_id": ev.ID, "ticket_type_id": ev.TicketTypes[0].ID, "quantity": 1,
	})
	if r.status != http.StatusUnprocessableEntity {
		t.Fatalf("book cancelled event: %d", r.status)
	}
	// And a hold cannot be confirmed once the event is gone.
	r = e.call(t, http.MethodPatch, "/api/v1/bookings/"+held.ID+"/confirm", holdingFan.token, nil)
	if r.status != http.StatusConflict {
		t.Fatalf("confirm hold on cancelled event: %d", r.status)
	}
}

func TestBooking_MessagingNeedsAConfirmedBooking(t *testing.T) {
	e := setup(t)
	org := e.newUser(t, domain.UserRoleOrganizer)
	fan := e.newUser(t, domain.UserRoleAttendee)
	ev := e.publishedEvent(t, org, eventSpec{})

	send := func() reply {
		return e.call(t, http.MethodPost, "/api/v1/messages", fan.token, map[string]any{
			"recipient_id": org.ID.String(),
			"event_id":     ev.ID,
			"subject":      "Ερώτηση",
			"body":         "Υπάρχει στάθμευση;",
		})
	}

	b := e.hold(t, fan, ev, 1)
	if r := send(); r.status != http.StatusForbidden {
		t.Fatalf("message with only a hold: %d", r.status)
	}
	must(t, e.call(t, http.MethodPatch, "/api/v1/bookings/"+b.ID+"/cancel", fan.token, nil), http.StatusOK)
	if r := send(); r.status != http.StatusForbidden {
		t.Fatalf("message after releasing the hold: %d", r.status)
	}

	b = e.hold(t, fan, ev, 1)
	must(t, e.call(t, http.MethodPatch, "/api/v1/bookings/"+b.ID+"/confirm", fan.token, nil), http.StatusOK)
	must(t, send(), http.StatusCreated)

	var recipients []struct {
		ID string `json:"id"`
	}
	must(t, e.call(t, http.MethodGet, "/api/v1/messages/recipients", org.token, nil), http.StatusOK).into(t, &recipients)
	found := false
	for _, r := range recipients {
		found = found || r.ID == fan.ID.String()
	}
	if !found {
		t.Fatalf("organizer's address book lacks the confirmed attendee: %+v", recipients)
	}
}

func TestMessaging_AdminWritesToOrganizersOfOpenEvents(t *testing.T) {
	e := setup(t)
	admin := e.newUser(t, domain.UserRoleAdmin)
	org := e.newUser(t, domain.UserRoleOrganizer)
	gone := e.newUser(t, domain.UserRoleOrganizer)
	fan := e.newUser(t, domain.UserRoleAttendee)
	ev := e.publishedEvent(t, org, eventSpec{})
	cancelled := e.publishedEvent(t, gone, eventSpec{})
	must(t, e.call(t, http.MethodPatch, "/api/v1/events/organizer/"+cancelled.ID+"/cancel", gone.token, nil), http.StatusOK)

	send := func(from user, to user) reply {
		return e.call(t, http.MethodPost, "/api/v1/messages", from.token, map[string]any{
			"recipient_id": to.ID.String(),
			"event_id":     ev.ID,
			"subject":      "Ερώτηση",
			"body":         "Χωρίς κράτηση",
		})
	}

	// No booking needed: the admin could attend the event.
	must(t, send(admin, org), http.StatusCreated)
	must(t, send(org, admin), http.StatusCreated)
	// Only events still open count, and only administrators get the shortcut.
	if r := send(admin, gone); r.status != http.StatusForbidden {
		t.Fatalf("admin -> organizer of a cancelled event: %d", r.status)
	}
	if r := send(fan, org); r.status != http.StatusForbidden {
		t.Fatalf("attendee -> organizer without a booking: %d", r.status)
	}

	var recipients []struct {
		ID string `json:"id"`
	}
	must(t, e.call(t, http.MethodGet, "/api/v1/messages/recipients", admin.token, nil), http.StatusOK).into(t, &recipients)
	seen := map[string]int{}
	for _, r := range recipients {
		seen[r.ID]++
	}
	if seen[org.ID.String()] != 1 || seen[gone.ID.String()] != 0 || seen[admin.ID.String()] != 0 {
		t.Fatalf("admin's address book: %+v", recipients)
	}
}
