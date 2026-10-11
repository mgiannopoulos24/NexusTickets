package service

import (
	"context"
	"errors"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"nexustickets/internal/domain"
	wshub "nexustickets/internal/handler/ws"
)

// mockMessageRepo keeps every message in one map and derives the folders from
// it, the way the real table does, so per-side deletion behaves like Postgres.
type mockMessageRepo struct {
	messages map[uuid.UUID]domain.Message
	seq      int
}

func newMockMessageRepo() *mockMessageRepo {
	return &mockMessageRepo{messages: make(map[uuid.UUID]domain.Message)}
}

func (m *mockMessageRepo) Create(_ context.Context, msg domain.Message) (domain.Message, error) {
	msg.ID = uuid.New()
	// Strictly increasing timestamps keep "newest first" deterministic.
	m.seq++
	msg.CreatedAt = time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC).Add(time.Duration(m.seq) * time.Second)
	m.messages[msg.ID] = msg
	return msg, nil
}

func (m *mockMessageRepo) CreateBatch(_ context.Context, msgs []domain.Message) ([]domain.Message, error) {
	out := make([]domain.Message, len(msgs))
	for i, msg := range msgs {
		out[i], _ = m.Create(context.Background(), msg)
	}
	return out, nil
}

func (m *mockMessageRepo) GetByID(_ context.Context, mid uuid.UUID) (domain.Message, error) {
	msg, ok := m.messages[mid]
	if !ok {
		return domain.Message{}, domain.ErrNotFound
	}
	return msg, nil
}

func (m *mockMessageRepo) folder(keep func(domain.Message) bool, limit, offset int) ([]domain.Message, int, error) {
	var all []domain.Message
	for _, msg := range m.messages {
		if keep(msg) {
			all = append(all, msg)
		}
	}
	sort.Slice(all, func(i, j int) bool { return all[i].CreatedAt.After(all[j].CreatedAt) })
	total := len(all)
	if offset > total {
		offset = total
	}
	end := offset + limit
	if limit < 1 || end > total {
		end = total
	}
	return all[offset:end], total, nil
}

func (m *mockMessageRepo) ListInbox(_ context.Context, uid uuid.UUID, limit, offset int) ([]domain.Message, int, error) {
	return m.folder(func(msg domain.Message) bool {
		return msg.RecipientID == uid && !msg.DeletedByRecipient
	}, limit, offset)
}

func (m *mockMessageRepo) ListSent(_ context.Context, uid uuid.UUID, limit, offset int) ([]domain.Message, int, error) {
	return m.folder(func(msg domain.Message) bool {
		return msg.SenderID == uid && !msg.DeletedBySender
	}, limit, offset)
}

func (m *mockMessageRepo) MarkAsRead(_ context.Context, mid, uid uuid.UUID) (bool, error) {
	msg, ok := m.messages[mid]
	if !ok || msg.RecipientID != uid || msg.ReadAt != nil {
		return false, nil
	}
	now := time.Now().UTC()
	msg.ReadAt = &now
	m.messages[mid] = msg
	return true, nil
}

func (m *mockMessageRepo) DeleteForUser(_ context.Context, mid, uid uuid.UUID) error {
	msg, ok := m.messages[mid]
	if !ok {
		return domain.ErrNotFound
	}
	switch uid {
	case msg.SenderID:
		msg.DeletedBySender = true
	case msg.RecipientID:
		msg.DeletedByRecipient = true
	default:
		return domain.ErrForbidden
	}
	m.messages[mid] = msg
	return nil
}

func (m *mockMessageRepo) GetUnreadCount(_ context.Context, uid uuid.UUID) (int, error) {
	n := 0
	for _, msg := range m.messages {
		if msg.RecipientID == uid && msg.ReadAt == nil && !msg.DeletedByRecipient {
			n++
		}
	}
	return n, nil
}

// mailboxFixture is two users who share a booking, so they may write to each
// other, plus the repos behind the service.
type mailboxFixture struct {
	svc      *MessagingService
	msgs     *mockMessageRepo
	users    *mockUserRepo
	bookings *mockBookingRepo
	events   *mockEventRepo
	attendee domain.User
	org      domain.User
}

func newMailboxFixture(t *testing.T) mailboxFixture {
	t.Helper()
	msgs := newMockMessageRepo()
	users := newMockUserRepo()
	bookings := newMockBookingRepo()
	events := newMockEventRepo()
	svc := NewMessagingService(msgs, users, bookings, events, newTestRedis(), wshub.NewHub())

	attendee := mustUser(t, users, domain.UserRoleAttendee)
	org := mustUser(t, users, domain.UserRoleOrganizer)
	bookings.correspondents[[2]uuid.UUID{attendee.ID, org.ID}] = true

	return mailboxFixture{svc: svc, msgs: msgs, users: users, bookings: bookings, events: events, attendee: attendee, org: org}
}

func (f mailboxFixture) send(t *testing.T, from, to uuid.UUID, subject string) domain.Message {
	t.Helper()
	msg, err := f.svc.SendMessage(context.Background(), SendMessageInput{
		SenderID: from, RecipientID: to, Subject: subject, Body: "body of " + subject,
	})
	if err != nil {
		t.Fatalf("send %q: %v", subject, err)
	}
	return msg
}

func TestMessagingService_SendMessageValidation(t *testing.T) {
	f := newMailboxFixture(t)
	ctx := context.Background()

	cases := []struct {
		name string
		in   SendMessageInput
		want error
	}{
		{"empty subject", SendMessageInput{SenderID: f.attendee.ID, RecipientID: f.org.ID, Body: "b"}, ErrMessageSubjectBodyRequired},
		{"empty body", SendMessageInput{SenderID: f.attendee.ID, RecipientID: f.org.ID, Subject: "s"}, ErrMessageSubjectBodyRequired},
		{"whitespace only", SendMessageInput{SenderID: f.attendee.ID, RecipientID: f.org.ID, Subject: "  ", Body: "\n"}, ErrMessageSubjectBodyRequired},
		{"subject too long", SendMessageInput{SenderID: f.attendee.ID, RecipientID: f.org.ID, Subject: strings.Repeat("x", maxSubjectLength+1), Body: "b"}, ErrMessageTooLong},
		{"self recipient", SendMessageInput{SenderID: f.attendee.ID, RecipientID: f.attendee.ID, Subject: "s", Body: "b"}, ErrMessageSelfRecipient},
		{"unknown recipient", SendMessageInput{SenderID: f.attendee.ID, RecipientID: uuid.New(), Subject: "s", Body: "b"}, domain.ErrNotFound},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := f.svc.SendMessage(ctx, tc.in)
			if !errors.Is(err, tc.want) {
				t.Fatalf("expected %v, got %v", tc.want, err)
			}
		})
	}

	t.Run("unknown event reference", func(t *testing.T) {
		bogus := uuid.New()
		_, err := f.svc.SendMessage(ctx, SendMessageInput{
			SenderID: f.attendee.ID, RecipientID: f.org.ID, EventID: &bogus, Subject: "s", Body: "b",
		})
		if !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("expected ErrNotFound for bogus event, got %v", err)
		}
	})
}

func TestMessagingService_SendFilesUnderBothFolders(t *testing.T) {
	f := newMailboxFixture(t)
	ctx := context.Background()

	eventID := uuid.New()
	f.events.events[eventID] = domain.Event{ID: eventID, OrganizerID: f.org.ID, Title: "Concert"}

	msg, err := f.svc.SendMessage(ctx, SendMessageInput{
		SenderID: f.attendee.ID, RecipientID: f.org.ID, EventID: &eventID,
		Subject: "  Question  ", Body: "  Is parking available?  ",
	})
	if err != nil {
		t.Fatalf("send: %v", err)
	}
	if msg.Subject != "Question" || msg.Body != "Is parking available?" {
		t.Fatalf("expected trimmed subject/body, got %q / %q", msg.Subject, msg.Body)
	}
	if msg.EventID == nil || *msg.EventID != eventID {
		t.Fatalf("expected event reference to be kept")
	}
	if msg.ReadAt != nil {
		t.Fatalf("a fresh message must be unread")
	}

	inbox, err := f.svc.GetInbox(ctx, f.org.ID, 20, 0)
	if err != nil {
		t.Fatalf("inbox: %v", err)
	}
	if inbox.Total != 1 || len(inbox.Messages) != 1 || inbox.Messages[0].ID != msg.ID {
		t.Fatalf("expected the message in the recipient's inbox, got %+v", inbox)
	}

	sent, err := f.svc.GetSent(ctx, f.attendee.ID, 20, 0)
	if err != nil {
		t.Fatalf("sent: %v", err)
	}
	if sent.Total != 1 || len(sent.Messages) != 1 || sent.Messages[0].ID != msg.ID {
		t.Fatalf("expected the message in the sender's sent folder, got %+v", sent)
	}

	// The sender's inbox and the recipient's sent folder stay empty.
	if box, _ := f.svc.GetInbox(ctx, f.attendee.ID, 20, 0); box.Total != 0 {
		t.Fatalf("sender's inbox should be empty, got %d", box.Total)
	}
	if box, _ := f.svc.GetSent(ctx, f.org.ID, 20, 0); box.Total != 0 {
		t.Fatalf("recipient's sent folder should be empty, got %d", box.Total)
	}
}

func TestMessagingService_FoldersPaginateNewestFirst(t *testing.T) {
	f := newMailboxFixture(t)
	ctx := context.Background()

	var ids []uuid.UUID
	for i := 0; i < 5; i++ {
		ids = append(ids, f.send(t, f.org.ID, f.attendee.ID, "n"+string(rune('0'+i))).ID)
	}

	page1, err := f.svc.GetInbox(ctx, f.attendee.ID, 2, 0)
	if err != nil {
		t.Fatalf("page 1: %v", err)
	}
	if page1.Total != 5 || len(page1.Messages) != 2 {
		t.Fatalf("expected total 5 and 2 rows, got total %d rows %d", page1.Total, len(page1.Messages))
	}
	if page1.Messages[0].ID != ids[4] || page1.Messages[1].ID != ids[3] {
		t.Fatalf("expected newest first")
	}

	page3, err := f.svc.GetInbox(ctx, f.attendee.ID, 2, 4)
	if err != nil {
		t.Fatalf("page 3: %v", err)
	}
	if len(page3.Messages) != 1 || page3.Messages[0].ID != ids[0] {
		t.Fatalf("expected the oldest message alone on the last page")
	}
}

func TestMessagingService_ListingDoesNotMarkRead(t *testing.T) {
	f := newMailboxFixture(t)
	ctx := context.Background()

	f.send(t, f.org.ID, f.attendee.ID, "one")
	f.send(t, f.org.ID, f.attendee.ID, "two")

	if _, err := f.svc.GetInbox(ctx, f.attendee.ID, 20, 0); err != nil {
		t.Fatalf("inbox: %v", err)
	}
	n, err := f.svc.GetUnreadCount(ctx, f.attendee.ID)
	if err != nil {
		t.Fatalf("unread: %v", err)
	}
	if n != 2 {
		t.Fatalf("listing the inbox must not mark anything read; unread = %d", n)
	}
}

func TestMessagingService_OpeningMarksReadForRecipientOnly(t *testing.T) {
	f := newMailboxFixture(t)
	ctx := context.Background()

	msg := f.send(t, f.org.ID, f.attendee.ID, "hello")

	// The sender re-reading their own sent message changes nothing.
	got, err := f.svc.GetMessage(ctx, msg.ID, f.org.ID)
	if err != nil {
		t.Fatalf("sender open: %v", err)
	}
	if got.ReadAt != nil {
		t.Fatalf("sender opening must not mark the message read")
	}
	if n, _ := f.svc.GetUnreadCount(ctx, f.attendee.ID); n != 1 {
		t.Fatalf("expected 1 unread before the recipient opens it, got %d", n)
	}

	got, err = f.svc.GetMessage(ctx, msg.ID, f.attendee.ID)
	if err != nil {
		t.Fatalf("recipient open: %v", err)
	}
	if got.ReadAt == nil {
		t.Fatalf("recipient opening must mark the message read")
	}
	if n, _ := f.svc.GetUnreadCount(ctx, f.attendee.ID); n != 0 {
		t.Fatalf("expected 0 unread after opening, got %d", n)
	}

	// Opening again is idempotent.
	again, err := f.svc.GetMessage(ctx, msg.ID, f.attendee.ID)
	if err != nil {
		t.Fatalf("second open: %v", err)
	}
	if again.ReadAt == nil {
		t.Fatalf("read_at must persist")
	}

	// A third party may not read it at all.
	stranger := mustUser(t, f.users, domain.UserRoleAttendee)
	if _, err := f.svc.GetMessage(ctx, msg.ID, stranger.ID); !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("expected ErrForbidden for a third party, got %v", err)
	}
}

func TestMessagingService_DeleteIsPerFolder(t *testing.T) {
	f := newMailboxFixture(t)
	ctx := context.Background()

	msg := f.send(t, f.org.ID, f.attendee.ID, "notice")

	// Recipient drops it from the inbox: gone for them, still in the
	// organizer's sent folder, and off the unread badge.
	if err := f.svc.DeleteForUser(ctx, msg.ID, f.attendee.ID); err != nil {
		t.Fatalf("recipient delete: %v", err)
	}
	if box, _ := f.svc.GetInbox(ctx, f.attendee.ID, 20, 0); box.Total != 0 {
		t.Fatalf("expected empty inbox after delete, got %d", box.Total)
	}
	if box, _ := f.svc.GetSent(ctx, f.org.ID, 20, 0); box.Total != 1 {
		t.Fatalf("sender's copy must survive the recipient's delete, got %d", box.Total)
	}
	if n, _ := f.svc.GetUnreadCount(ctx, f.attendee.ID); n != 0 {
		t.Fatalf("deleting an unread message must clear it from the badge, got %d", n)
	}
	if _, err := f.svc.GetMessage(ctx, msg.ID, f.attendee.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("a deleted message must not open from that side, got %v", err)
	}

	// The sender can still open it, and can drop their own copy too.
	if _, err := f.svc.GetMessage(ctx, msg.ID, f.org.ID); err != nil {
		t.Fatalf("sender open after recipient delete: %v", err)
	}
	if err := f.svc.DeleteForUser(ctx, msg.ID, f.org.ID); err != nil {
		t.Fatalf("sender delete: %v", err)
	}
	if box, _ := f.svc.GetSent(ctx, f.org.ID, 20, 0); box.Total != 0 {
		t.Fatalf("expected empty sent folder after sender delete, got %d", box.Total)
	}

	// Nobody else may delete it.
	stranger := mustUser(t, f.users, domain.UserRoleAttendee)
	if err := f.svc.DeleteForUser(ctx, msg.ID, stranger.ID); !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("expected ErrForbidden, got %v", err)
	}
	if err := f.svc.DeleteForUser(ctx, uuid.New(), f.org.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for unknown message, got %v", err)
	}
}

func TestMessagingService_UnreadCountFallsBackToDatabase(t *testing.T) {
	f := newMailboxFixture(t)
	ctx := context.Background()

	f.send(t, f.org.ID, f.attendee.ID, "a")
	f.send(t, f.org.ID, f.attendee.ID, "b")

	// Wipe the cached value: the next read must recompute from the repo.
	if err := f.svc.redis.Del(ctx, unreadRedisKey(f.attendee.ID)).Err(); err != nil {
		t.Fatalf("redis del: %v", err)
	}
	n, err := f.svc.GetUnreadCount(ctx, f.attendee.ID)
	if err != nil {
		t.Fatalf("unread: %v", err)
	}
	if n != 2 {
		t.Fatalf("expected 2 from the database fallback, got %d", n)
	}
}

func TestMessagingService_ListRecipients(t *testing.T) {
	f := newMailboxFixture(t)
	mustUser(t, f.users, domain.UserRoleAdmin)
	mustUser(t, f.users, domain.UserRoleOrganizer)

	people, err := f.svc.ListRecipients(context.Background(), f.attendee.ID)
	if err != nil {
		t.Fatalf("recipients: %v", err)
	}
	// Only the organizer they booked with: neither the unrelated organizer nor
	// the administrator (support goes through tickets, not messages).
	if len(people) != 1 || people[0].ID != f.org.ID {
		t.Fatalf("expected exactly the booked organizer, got %+v", people)
	}
}

func TestMessagingService_AdminWritesToOrganizersOfOpenEvents(t *testing.T) {
	f := newMailboxFixture(t)
	ctx := context.Background()
	admin := mustUser(t, f.users, domain.UserRoleAdmin)
	other := mustUser(t, f.users, domain.UserRoleOrganizer)
	idle := mustUser(t, f.users, domain.UserRoleOrganizer)

	now := time.Now()
	put := func(org uuid.UUID, status domain.EventStatus, end time.Time) {
		id := uuid.New()
		f.events.events[id] = domain.Event{ID: id, OrganizerID: org, Status: status, StartAt: end.Add(-2 * time.Hour), EndAt: end}
	}
	put(f.org.ID, domain.EventStatusPublished, now.Add(24*time.Hour))
	put(other.ID, domain.EventStatusPublished, now.Add(time.Hour))
	// Nothing the admin could attend: a draft, an ended and a cancelled event.
	put(idle.ID, domain.EventStatusDraft, now.Add(24*time.Hour))
	put(idle.ID, domain.EventStatusPublished, now.Add(-time.Hour))
	put(idle.ID, domain.EventStatusCancelled, now.Add(24*time.Hour))

	send := func(from, to uuid.UUID) error {
		_, err := f.svc.SendMessage(ctx, SendMessageInput{SenderID: from, RecipientID: to, Subject: "s", Body: "b"})
		return err
	}

	// No booking needed in either direction.
	if err := send(admin.ID, other.ID); err != nil {
		t.Fatalf("admin -> organizer of an open event: %v", err)
	}
	if err := send(other.ID, admin.ID); err != nil {
		t.Fatalf("organizer replying to the admin: %v", err)
	}
	if err := send(admin.ID, idle.ID); !errors.Is(err, domain.ErrMessagingNotAllowed) {
		t.Fatalf("admin -> organizer with nothing open: %v", err)
	}
	if err := send(admin.ID, f.attendee.ID); !errors.Is(err, domain.ErrMessagingNotAllowed) {
		t.Fatalf("admin -> attendee without a booking: %v", err)
	}
	// The organizer rule is for administrators only.
	if err := send(f.attendee.ID, other.ID); !errors.Is(err, domain.ErrMessagingNotAllowed) {
		t.Fatalf("attendee -> organizer without a booking: %v", err)
	}

	people, err := f.svc.ListRecipients(ctx, admin.ID)
	if err != nil {
		t.Fatalf("recipients: %v", err)
	}
	got := map[uuid.UUID]bool{}
	for _, p := range people {
		if got[p.ID] {
			t.Fatalf("recipient %s listed twice", p.ID)
		}
		got[p.ID] = true
	}
	if len(got) != 2 || !got[f.org.ID] || !got[other.ID] {
		t.Fatalf("admin recipients = %v, want the two organizers with open events", got)
	}
}

func TestMessagingService_NotifyEventCancellation(t *testing.T) {
	f := newMailboxFixture(t)
	ctx := context.Background()

	attendee2 := mustUser(t, f.users, domain.UserRoleAttendee)
	eventID := uuid.New()
	f.events.events[eventID] = domain.Event{
		ID: eventID, OrganizerID: f.org.ID, Title: "Cancelled Event",
		StartAt: time.Date(2026, 7, 12, 20, 30, 0, 0, time.UTC),
		Status:  domain.EventStatusCancelled,
	}
	f.bookings.add(domain.Booking{UserID: f.attendee.ID, EventID: eventID, Status: domain.BookingStatusConfirmed})
	f.bookings.add(domain.Booking{UserID: f.attendee.ID, EventID: eventID, Status: domain.BookingStatusConfirmed})
	f.bookings.add(domain.Booking{UserID: attendee2.ID, EventID: eventID, Status: domain.BookingStatusConfirmed})
	// The organizer's own booking must not notify themselves.
	f.bookings.add(domain.Booking{UserID: f.org.ID, EventID: eventID, Status: domain.BookingStatusConfirmed})

	if err := f.svc.NotifyEventCancellation(ctx, eventID); err != nil {
		t.Fatalf("notify: %v", err)
	}

	sent, _ := f.svc.GetSent(ctx, f.org.ID, 20, 0)
	if sent.Total != 2 {
		t.Fatalf("expected one notice per distinct booker (2), got %d", sent.Total)
	}
	for _, uid := range []uuid.UUID{f.attendee.ID, attendee2.ID} {
		box, _ := f.svc.GetInbox(ctx, uid, 20, 0)
		if box.Total != 1 {
			t.Fatalf("expected exactly one notice for %s, got %d", uid, box.Total)
		}
		msg := box.Messages[0]
		if msg.EventID == nil || *msg.EventID != eventID {
			t.Fatalf("notice must reference the event")
		}
		if !strings.Contains(msg.Subject, "Cancelled Event") || !strings.Contains(msg.Body, "ακυρώθηκε") {
			t.Fatalf("unexpected notice text: %q / %q", msg.Subject, msg.Body)
		}
		if n, _ := f.svc.GetUnreadCount(ctx, uid); n != 1 {
			t.Fatalf("notice must count as unread, got %d", n)
		}
	}
	if box, _ := f.svc.GetInbox(ctx, f.org.ID, 20, 0); box.Total != 0 {
		t.Fatalf("the organizer must not receive their own notice")
	}
}

func TestMessagingService_NotifyEventAttendees(t *testing.T) {
	f := newMailboxFixture(t)
	ctx := context.Background()

	eventID := uuid.New()
	f.events.events[eventID] = domain.Event{ID: eventID, OrganizerID: f.org.ID, Title: "Workshop"}

	t.Run("nobody booked yet", func(t *testing.T) {
		_, err := f.svc.NotifyEventAttendees(ctx, f.org.ID, eventID, "Update", "Doors open at 19:00")
		if !errors.Is(err, ErrMessageNoRecipients) {
			t.Fatalf("expected ErrMessageNoRecipients, got %v", err)
		}
	})

	f.bookings.add(domain.Booking{UserID: f.attendee.ID, EventID: eventID, Status: domain.BookingStatusConfirmed})

	t.Run("only the organizer of the event", func(t *testing.T) {
		other := mustUser(t, f.users, domain.UserRoleOrganizer)
		_, err := f.svc.NotifyEventAttendees(ctx, other.ID, eventID, "Update", "…")
		if !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got %v", err)
		}
	})

	t.Run("validation", func(t *testing.T) {
		_, err := f.svc.NotifyEventAttendees(ctx, f.org.ID, eventID, "", "…")
		if !errors.Is(err, ErrMessageSubjectBodyRequired) {
			t.Fatalf("expected ErrMessageSubjectBodyRequired, got %v", err)
		}
	})

	t.Run("delivers to every booker", func(t *testing.T) {
		n, err := f.svc.NotifyEventAttendees(ctx, f.org.ID, eventID, "Update", "Doors open at 19:00")
		if err != nil {
			t.Fatalf("notify: %v", err)
		}
		if n != 1 {
			t.Fatalf("expected 1 recipient, got %d", n)
		}
		box, _ := f.svc.GetInbox(ctx, f.attendee.ID, 20, 0)
		if box.Total != 1 || box.Messages[0].Subject != "Update" || box.Messages[0].SenderID != f.org.ID {
			t.Fatalf("expected the organizer's notice in the attendee's inbox, got %+v", box)
		}
	})
}
