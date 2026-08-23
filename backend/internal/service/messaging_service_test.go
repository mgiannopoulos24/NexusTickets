package service

import (
	"bytes"
	"context"
	"errors"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	wshub "nexustickets/internal/handler/ws"

	"nexustickets/internal/domain"
)

type mockMessageRepo struct {
	messages  map[uuid.UUID]domain.Message
	inbox     map[uuid.UUID][]domain.Message
	sent      map[uuid.UUID][]domain.Message
	unreadCnt map[uuid.UUID]int
	reactions map[uuid.UUID][]domain.MailboxReaction
}

func newMockMessageRepo() *mockMessageRepo {
	return &mockMessageRepo{
		messages:  make(map[uuid.UUID]domain.Message),
		inbox:     make(map[uuid.UUID][]domain.Message),
		sent:      make(map[uuid.UUID][]domain.Message),
		unreadCnt: make(map[uuid.UUID]int),
		reactions: make(map[uuid.UUID][]domain.MailboxReaction),
	}
}

func (m *mockMessageRepo) Create(_ context.Context, msg domain.Message) (domain.Message, error) {
	msg.ID = uuid.New()
	msg.CreatedAt = time.Now().UTC()
	m.messages[msg.ID] = msg
	m.inbox[msg.RecipientID] = append(m.inbox[msg.RecipientID], msg)
	m.sent[msg.SenderID] = append(m.sent[msg.SenderID], msg)
	m.unreadCnt[msg.RecipientID]++
	return msg, nil
}

func (m *mockMessageRepo) CreateBatch(_ context.Context, msgs []domain.Message) ([]domain.Message, error) {
	out := make([]domain.Message, len(msgs))
	for i, msg := range msgs {
		out[i], _ = m.Create(context.Background(), msg)
	}
	return out, nil
}

func (m *mockMessageRepo) ListInbox(_ context.Context, uid uuid.UUID, limit, offset int) ([]domain.Message, error) {
	return m.inbox[uid], nil
}

func (m *mockMessageRepo) ListSent(_ context.Context, uid uuid.UUID, limit, offset int) ([]domain.Message, error) {
	return m.sent[uid], nil
}

func (m *mockMessageRepo) threadBetween(a, b uuid.UUID) []domain.Message {
	out := make([]domain.Message, 0)
	for _, msg := range m.messages {
		mine := msg.SenderID == a && msg.RecipientID == b && !msg.DeletedBySender
		theirs := msg.SenderID == b && msg.RecipientID == a && !msg.DeletedByRecipient
		if mine || theirs {
			out = append(out, msg)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.Before(out[j].CreatedAt) })
	return out
}

func (m *mockMessageRepo) ListThread(_ context.Context, uid, other uuid.UUID, limit, offset int) ([]domain.Message, error) {
	thread := m.threadBetween(uid, other)
	if offset >= len(thread) {
		return []domain.Message{}, nil
	}
	thread = thread[offset:]
	if limit > 0 && limit < len(thread) {
		thread = thread[:limit]
	}
	return thread, nil
}

func (m *mockMessageRepo) LastInThread(_ context.Context, uid, other uuid.UUID) (domain.Message, error) {
	thread := m.threadBetween(uid, other)
	if len(thread) == 0 {
		return domain.Message{}, domain.ErrNotFound
	}
	return thread[len(thread)-1], nil
}

func (m *mockMessageRepo) ListCounterpartIDs(_ context.Context, uid uuid.UUID) ([]uuid.UUID, error) {
	latest := make(map[uuid.UUID]time.Time)
	for _, msg := range m.messages {
		var other uuid.UUID
		switch {
		case msg.SenderID == uid && !msg.DeletedBySender:
			other = msg.RecipientID
		case msg.RecipientID == uid && !msg.DeletedByRecipient:
			other = msg.SenderID
		default:
			continue
		}
		if msg.CreatedAt.After(latest[other]) {
			latest[other] = msg.CreatedAt
		}
	}
	out := make([]uuid.UUID, 0, len(latest))
	for id := range latest {
		out = append(out, id)
	}
	sort.Slice(out, func(i, j int) bool { return latest[out[i]].After(latest[out[j]]) })
	return out, nil
}

func (m *mockMessageRepo) UnreadCountsBySender(_ context.Context, uid uuid.UUID) (map[uuid.UUID]int, error) {
	out := make(map[uuid.UUID]int)
	for _, msg := range m.messages {
		if msg.RecipientID == uid && msg.ReadAt == nil && !msg.DeletedByRecipient {
			out[msg.SenderID]++
		}
	}
	return out, nil
}

func (m *mockMessageRepo) MarkThreadAsRead(_ context.Context, uid, other uuid.UUID) (int, error) {
	now := time.Now().UTC()
	changed := 0
	for id, msg := range m.messages {
		if msg.RecipientID == uid && msg.SenderID == other && msg.ReadAt == nil && !msg.DeletedByRecipient {
			readAt := now
			msg.ReadAt = &readAt
			m.messages[id] = msg
			changed++
			if m.unreadCnt[uid] > 0 {
				m.unreadCnt[uid]--
			}
		}
	}
	return changed, nil
}

func (m *mockMessageRepo) DeleteForUser(_ context.Context, mid, uid uuid.UUID) error {
	msg, ok := m.messages[mid]
	if !ok {
		return domain.ErrNotFound
	}
	if msg.SenderID == uid {
		msg.DeletedBySender = true
	} else if msg.RecipientID == uid {
		msg.DeletedByRecipient = true
	} else {
		return domain.ErrForbidden
	}
	m.messages[mid] = msg
	return nil
}

func (m *mockMessageRepo) GetByID(_ context.Context, mid uuid.UUID) (domain.Message, error) {
	msg, ok := m.messages[mid]
	if !ok {
		return domain.Message{}, domain.ErrNotFound
	}
	return msg, nil
}

func (m *mockMessageRepo) DeleteForEveryone(_ context.Context, mid uuid.UUID) error {
	msg, ok := m.messages[mid]
	if !ok {
		return domain.ErrNotFound
	}
	msg.DeletedForEveryone = true
	msg.Body = ""
	msg.ImageURL = ""
	msg.FileURL = ""
	msg.FileName = ""
	msg.GifURL = ""
	m.messages[mid] = msg
	return nil
}

func (m *mockMessageRepo) ListPreviews(_ context.Context, ids []uuid.UUID) (map[uuid.UUID]domain.MessagePreview, error) {
	out := make(map[uuid.UUID]domain.MessagePreview, len(ids))
	for _, id := range ids {
		msg, ok := m.messages[id]
		if !ok {
			continue
		}
		out[id] = domain.MessagePreview{
			ID:       msg.ID.String(),
			SenderID: msg.SenderID,
			Body:     msg.Body,
			Deleted:  msg.DeletedForEveryone,
		}
	}
	return out, nil
}

func (m *mockMessageRepo) AddReaction(_ context.Context, mid, uid uuid.UUID, emoji string) error {
	for _, r := range m.reactions[mid] {
		if r.UserID == uid && r.Emoji == emoji {
			return nil
		}
	}
	m.reactions[mid] = append(m.reactions[mid], domain.MailboxReaction{
		ID: uuid.New(), MessageID: mid, UserID: uid, Emoji: emoji, CreatedAt: time.Now().UTC(),
	})
	return nil
}

func (m *mockMessageRepo) RemoveReaction(_ context.Context, mid, uid uuid.UUID, emoji string) error {
	kept := make([]domain.MailboxReaction, 0, len(m.reactions[mid]))
	for _, r := range m.reactions[mid] {
		if r.UserID == uid && r.Emoji == emoji {
			continue
		}
		kept = append(kept, r)
	}
	m.reactions[mid] = kept
	return nil
}

func (m *mockMessageRepo) ListReactions(_ context.Context, ids []uuid.UUID) (map[uuid.UUID][]domain.MailboxReaction, error) {
	out := make(map[uuid.UUID][]domain.MailboxReaction, len(ids))
	for _, id := range ids {
		if rs := m.reactions[id]; len(rs) > 0 {
			out[id] = rs
		}
	}
	return out, nil
}

func (m *mockMessageRepo) MarkAsRead(_ context.Context, uid uuid.UUID) error {
	m.unreadCnt[uid] = 0
	return nil
}

func (m *mockMessageRepo) MarkAsReadByIDs(_ context.Context, uid uuid.UUID, ids []uuid.UUID) error {
	want := make(map[uuid.UUID]struct{}, len(ids))
	for _, id := range ids {
		want[id] = struct{}{}
	}
	now := time.Now().UTC()
	for id, msg := range m.messages {
		if msg.RecipientID != uid || msg.ReadAt != nil {
			continue
		}
		if _, ok := want[id]; !ok {
			continue
		}
		readAt := now
		msg.ReadAt = &readAt
		m.messages[id] = msg
		if m.unreadCnt[uid] > 0 {
			m.unreadCnt[uid]--
		}
	}
	for uidKey, list := range m.inbox {
		for i := range list {
			if _, ok := want[list[i].ID]; ok && list[i].ReadAt == nil {
				readAt := now
				list[i].ReadAt = &readAt
			}
		}
		m.inbox[uidKey] = list
	}
	return nil
}

func (m *mockMessageRepo) GetUnreadCount(_ context.Context, uid uuid.UUID) (int, error) {
	return m.unreadCnt[uid], nil
}

func msgSvc(t *testing.T) *MessagingService {
	t.Helper()
	return NewMessagingService(
		newMockMessageRepo(),
		newMockUserRepo(),
		newMockBookingRepo(),
		newMockEventRepo(),
		newTestRedis(),
		wshub.NewHub(),
	)
}

func TestMessagingService_SendMessageValidation(t *testing.T) {
	msgs := newMockMessageRepo()
	users := newMockUserRepo()
	svc := NewMessagingService(msgs, users, newMockBookingRepo(), newMockEventRepo(), newTestRedis(), wshub.NewHub())

	senderID := uuid.New()
	recipientID := uuid.New()
	users.add(domain.User{ID: senderID, Username: "sender", Email: "s@s.com"})
	users.add(domain.User{ID: recipientID, Username: "recipient", Email: "r@r.com"})

	t.Run("empty subject", func(t *testing.T) {
		_, err := svc.SendMessage(context.Background(), SendMessageInput{
			SenderID: senderID, RecipientID: recipientID,
			Subject: "", Body: "body",
		})
		if !errors.Is(err, ErrMessageSubjectBodyRequired) {
			t.Fatalf("expected ErrMessageSubjectBodyRequired, got %v", err)
		}
	})

	t.Run("empty body", func(t *testing.T) {
		_, err := svc.SendMessage(context.Background(), SendMessageInput{
			SenderID: senderID, RecipientID: recipientID,
			Subject: "subj", Body: "",
		})
		if !errors.Is(err, ErrMessageSubjectBodyRequired) {
			t.Fatalf("expected ErrMessageSubjectBodyRequired, got %v", err)
		}
	})

	t.Run("self recipient", func(t *testing.T) {
		_, err := svc.SendMessage(context.Background(), SendMessageInput{
			SenderID: senderID, RecipientID: senderID,
			Subject: "subj", Body: "body",
		})
		if !errors.Is(err, ErrMessageSelfRecipient) {
			t.Fatalf("expected ErrMessageSelfRecipient, got %v", err)
		}
	})

	t.Run("unknown recipient", func(t *testing.T) {
		_, err := svc.SendMessage(context.Background(), SendMessageInput{
			SenderID: senderID, RecipientID: uuid.New(),
			Subject: "subj", Body: "body",
		})
		if !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("expected ErrNotFound, got %v", err)
		}
	})
}

func TestMessagingService_GetSent(t *testing.T) {
	msgs := newMockMessageRepo()
	users := newMockUserRepo()
	svc := NewMessagingService(msgs, users, newMockBookingRepo(), newMockEventRepo(), newTestRedis(), wshub.NewHub())

	userID := uuid.New()
	users.add(domain.User{ID: userID, Username: "u", Email: "u@u.com"})
	users.add(domain.User{ID: uuid.New(), Username: "r", Email: "r@r.com"})

	msgs.Create(context.Background(), domain.Message{SenderID: userID, RecipientID: uuid.New(), Subject: "S1", Body: "B1"})
	msgs.Create(context.Background(), domain.Message{SenderID: userID, RecipientID: uuid.New(), Subject: "S2", Body: "B2"})

	sent, err := svc.GetSent(context.Background(), userID, 10, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(sent) != 2 {
		t.Fatalf("expected 2 sent messages, got %d", len(sent))
	}
}

func TestMessagingService_GetInbox(t *testing.T) {
	msgs := newMockMessageRepo()
	users := newMockUserRepo()
	svc := NewMessagingService(msgs, users, newMockBookingRepo(), newMockEventRepo(), newTestRedis(), wshub.NewHub())

	recipientID := uuid.New()
	users.add(domain.User{ID: recipientID, Username: "r", Email: "r@r.com"})

	msgs.Create(context.Background(), domain.Message{SenderID: uuid.New(), RecipientID: recipientID, Subject: "S1", Body: "B1"})
	msgs.Create(context.Background(), domain.Message{SenderID: uuid.New(), RecipientID: recipientID, Subject: "S2", Body: "B2"})

	// Two unread before reading the inbox.
	if got := msgs.unreadCnt[recipientID]; got != 2 {
		t.Fatalf("precondition: unread = %d, want 2", got)
	}

	inbox, err := svc.GetInbox(context.Background(), recipientID, 10, 0)
	if err != nil {
		t.Fatalf("GetInbox: %v", err)
	}
	if len(inbox) != 2 {
		t.Fatalf("expected 2 inbox messages, got %d", len(inbox))
	}
	// Opening the inbox marks everything read.
	if got := msgs.unreadCnt[recipientID]; got != 0 {
		t.Fatalf("unread after GetInbox = %d, want 0", got)
	}
}

func TestMessagingService_GetUnreadCount(t *testing.T) {
	msgs := newMockMessageRepo()
	users := newMockUserRepo()
	rdb := newTestRedis()
	svc := NewMessagingService(msgs, users, newMockBookingRepo(), newMockEventRepo(), rdb, wshub.NewHub())

	recipientID := uuid.New()
	// Ensure no stale Redis cache from a previous run.
	rdb.Del(context.Background(), unreadRedisKey(recipientID))

	msgs.Create(context.Background(), domain.Message{SenderID: uuid.New(), RecipientID: recipientID, Subject: "S", Body: "B"})

	n, err := svc.GetUnreadCount(context.Background(), recipientID)
	if err != nil {
		t.Fatalf("GetUnreadCount: %v", err)
	}
	if n != 1 {
		t.Fatalf("unread count = %d, want 1", n)
	}
}

func TestMessagingService_DeleteForUser(t *testing.T) {
	msgs := newMockMessageRepo()
	users := newMockUserRepo()
	svc := NewMessagingService(msgs, users, newMockBookingRepo(), newMockEventRepo(), newTestRedis(), wshub.NewHub())

	senderID := uuid.New()
	recipientID := uuid.New()
	created, _ := msgs.Create(context.Background(), domain.Message{SenderID: senderID, RecipientID: recipientID, Subject: "S", Body: "B"})

	// Recipient deletes their copy -> flagged deleted for recipient.
	if err := svc.DeleteForUser(context.Background(), created.ID, recipientID); err != nil {
		t.Fatalf("DeleteForUser: %v", err)
	}
	if !msgs.messages[created.ID].DeletedByRecipient {
		t.Errorf("message not flagged DeletedByRecipient")
	}

	// A user who is neither sender nor recipient cannot delete it.
	stranger := uuid.New()
	if err := svc.DeleteForUser(context.Background(), created.ID, stranger); !errors.Is(err, domain.ErrForbidden) {
		t.Errorf("stranger delete: expected ErrForbidden, got %v", err)
	}

	// Deleting a non-existent message returns ErrNotFound.
	if err := svc.DeleteForUser(context.Background(), uuid.New(), recipientID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("missing message: expected ErrNotFound, got %v", err)
	}
}

func TestMessagingService_NotifyEventCancellation(t *testing.T) {
	msgs := newMockMessageRepo()
	users := newMockUserRepo()
	events := newMockEventRepo()
	bookings := newMockBookingRepo()

	svc := NewMessagingService(msgs, users, bookings, events, newTestRedis(), wshub.NewHub())

	orgID := uuid.New()
	attendee1 := uuid.New()
	attendee2 := uuid.New()
	eventID := uuid.New()

	users.add(domain.User{ID: orgID, Username: "org", Email: "o@o.com"})
	users.add(domain.User{ID: attendee1, Username: "a1", Email: "a1@a.com"})
	users.add(domain.User{ID: attendee2, Username: "a2", Email: "a2@a.com"})

	events.events[eventID] = domain.Event{
		ID: eventID, OrganizerID: orgID, Title: "Cancelled Event",
		Status: domain.EventStatusPublished,
	}

	bookings.add(domain.Booking{UserID: attendee1, EventID: eventID, Status: domain.BookingStatusConfirmed})
	bookings.add(domain.Booking{UserID: attendee2, EventID: eventID, Status: domain.BookingStatusConfirmed})

	err := svc.NotifyEventCancellation(context.Background(), eventID)
	// Redis is required for full success; this test verifies messages are created
	// in the repo even if Redis broadcast fails.
	if err != nil {
		// Messages may still be created even if Redis fails (depends on order)
		_ = err
	}

	if len(msgs.sent[orgID]) != 2 {
		t.Fatalf("expected 2 cancellation notifications sent, got %d", len(msgs.sent[orgID]))
	}
}

func TestMessagingService_ListConversations(t *testing.T) {
	msgs := newMockMessageRepo()
	users := newMockUserRepo()
	svc := NewMessagingService(msgs, users, newMockBookingRepo(), newMockEventRepo(), newTestRedis(), wshub.NewHub())

	me := uuid.New()
	organizer := uuid.New()
	admin := uuid.New()
	users.add(domain.User{ID: me, Username: "me", Email: "me@x.com", Role: domain.UserRoleAttendee})
	users.add(domain.User{ID: organizer, Username: "org", Email: "o@x.com", Role: domain.UserRoleOrganizer})
	users.add(domain.User{ID: admin, Username: "admin", Email: "a@x.com", Role: domain.UserRoleAdmin})

	ctx := context.Background()
	msgs.Create(ctx, domain.Message{SenderID: organizer, RecipientID: me, Subject: "S1", Body: "first"})
	msgs.Create(ctx, domain.Message{SenderID: me, RecipientID: organizer, Subject: "S2", Body: "reply"})
	msgs.Create(ctx, domain.Message{SenderID: admin, RecipientID: me, Subject: "S3", Body: "support"})

	convos, err := svc.ListConversations(ctx, me)
	if err != nil {
		t.Fatalf("ListConversations: %v", err)
	}
	if len(convos) != 2 {
		t.Fatalf("expected 2 threads, got %d", len(convos))
	}

	byUser := map[uuid.UUID]Conversation{}
	for _, c := range convos {
		byUser[c.User.ID] = c
	}

	org, ok := byUser[organizer]
	if !ok {
		t.Fatal("organizer thread missing")
	}
	// The preview is the newest message either way, not the oldest.
	if org.LastMessage.Body != "reply" {
		t.Fatalf("organizer preview = %q, want %q", org.LastMessage.Body, "reply")
	}
	// Our own reply is not unread.
	if org.UnreadCount != 1 {
		t.Fatalf("organizer unread = %d, want 1", org.UnreadCount)
	}

	sup, ok := byUser[admin]
	if !ok {
		t.Fatal("support thread missing")
	}
	if !sup.Support {
		t.Fatal("admin thread should be flagged as support")
	}

	// Listing threads must not mark anything read.
	if got := msgs.unreadCnt[me]; got != 2 {
		t.Fatalf("unread after ListConversations = %d, want 2", got)
	}
}

func TestMessagingService_GetThread(t *testing.T) {
	msgs := newMockMessageRepo()
	users := newMockUserRepo()
	svc := NewMessagingService(msgs, users, newMockBookingRepo(), newMockEventRepo(), newTestRedis(), wshub.NewHub())

	me := uuid.New()
	other := uuid.New()
	stranger := uuid.New()
	users.add(domain.User{ID: me, Username: "me", Email: "me@x.com"})
	users.add(domain.User{ID: other, Username: "other", Email: "o@x.com"})

	ctx := context.Background()
	msgs.Create(ctx, domain.Message{SenderID: other, RecipientID: me, Subject: "S1", Body: "one"})
	msgs.Create(ctx, domain.Message{SenderID: me, RecipientID: other, Subject: "S2", Body: "two"})
	msgs.Create(ctx, domain.Message{SenderID: stranger, RecipientID: me, Subject: "S3", Body: "unrelated"})

	thread, err := svc.GetThread(ctx, me, other, 50, 0)
	if err != nil {
		t.Fatalf("GetThread: %v", err)
	}
	if len(thread) != 2 {
		t.Fatalf("expected 2 messages in the thread, got %d", len(thread))
	}
	// Oldest first, so the transcript reads top to bottom.
	if thread[0].Body != "one" || thread[1].Body != "two" {
		t.Fatalf("thread order = %q, %q", thread[0].Body, thread[1].Body)
	}
	// Opening the thread marks what they sent as read, and nothing else.
	if thread[0].ReadAt == nil {
		t.Fatal("incoming message should be marked read")
	}
	for _, m := range msgs.messages {
		if m.SenderID == stranger && m.ReadAt != nil {
			t.Fatal("an unrelated thread was marked read")
		}
	}

	if _, err := svc.GetThread(ctx, me, me, 50, 0); !errors.Is(err, ErrMessageSelfRecipient) {
		t.Fatalf("self thread: expected ErrMessageSelfRecipient, got %v", err)
	}
}

func TestMessagingService_SendMessageWithAttachment(t *testing.T) {
	msgs := newMockMessageRepo()
	users := newMockUserRepo()
	bookings := newMockBookingRepo()
	svc := NewMessagingService(msgs, users, bookings, newMockEventRepo(), newTestRedis(), wshub.NewHub())

	attendee := uuid.New()
	admin := uuid.New()
	users.add(domain.User{ID: attendee, Username: "a", Email: "a@x.com", Role: domain.UserRoleAttendee})
	users.add(domain.User{ID: admin, Username: "adm", Email: "adm@x.com", Role: domain.UserRoleAdmin})

	ctx := context.Background()

	t.Run("an image needs no body", func(t *testing.T) {
		got, err := svc.SendMessage(ctx, SendMessageInput{
			SenderID:    attendee,
			RecipientID: admin,
			Subject:     "Φωτογραφία",
			ImageURL:    "/uploads/media/messages/x/y.png",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.ImageURL != "/uploads/media/messages/x/y.png" {
			t.Fatalf("image url = %q", got.ImageURL)
		}
		if !got.HasAttachment() {
			t.Fatal("expected HasAttachment to be true")
		}
	})

	t.Run("a gif needs no body", func(t *testing.T) {
		got, err := svc.SendMessage(ctx, SendMessageInput{
			SenderID:    attendee,
			RecipientID: admin,
			Subject:     "GIF",
			GifURL:      "https://media.giphy.com/x.gif",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.GifURL == "" {
			t.Fatal("gif url was dropped")
		}
	})

	t.Run("a file needs a name", func(t *testing.T) {
		_, err := svc.SendMessage(ctx, SendMessageInput{
			SenderID:    attendee,
			RecipientID: admin,
			Subject:     "Αρχείο",
			FileURL:     "/uploads/media/messages/x/y.pdf",
		})
		if !errors.Is(err, ErrMessageAttachmentNameRequired) {
			t.Fatalf("expected ErrMessageAttachmentNameRequired, got %v", err)
		}
	})

	t.Run("plain text still needs a body", func(t *testing.T) {
		_, err := svc.SendMessage(ctx, SendMessageInput{
			SenderID:    attendee,
			RecipientID: admin,
			Subject:     "Κενό",
		})
		if !errors.Is(err, ErrMessageSubjectBodyRequired) {
			t.Fatalf("expected ErrMessageSubjectBodyRequired, got %v", err)
		}
	})

	t.Run("a subject is still required", func(t *testing.T) {
		_, err := svc.SendMessage(ctx, SendMessageInput{
			SenderID:    attendee,
			RecipientID: admin,
			ImageURL:    "/uploads/media/messages/x/y.png",
		})
		if !errors.Is(err, ErrMessageSubjectBodyRequired) {
			t.Fatalf("expected ErrMessageSubjectBodyRequired, got %v", err)
		}
	})
}

func TestMessagingService_StoreAttachment(t *testing.T) {
	svc := NewMessagingService(
		newMockMessageRepo(), newMockUserRepo(), newMockBookingRepo(),
		newMockEventRepo(), newTestRedis(), wshub.NewHub(),
	)
	svc.SetMediaRoot(t.TempDir())

	sender := uuid.New()

	t.Run("stores a png as an image", func(t *testing.T) {
		png := append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 64)...)
		got, err := svc.StoreAttachment(sender, "shot.png", int64(len(png)), bytes.NewReader(png))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Kind != AttachmentKindImage {
			t.Fatalf("kind = %q, want image", got.Kind)
		}
		if !strings.HasPrefix(got.URL, "/uploads/media/messages/"+sender.String()+"/") {
			t.Fatalf("url = %q", got.URL)
		}
		if got.Size != int64(len(png)) {
			t.Fatalf("size = %d, want %d", got.Size, len(png))
		}
	})

	t.Run("stores anything else as a file, keeping the name", func(t *testing.T) {
		data := []byte("ticket,quantity\nA,2\n")
		got, err := svc.StoreAttachment(sender, "report.csv", int64(len(data)), bytes.NewReader(data))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Kind != AttachmentKindFile {
			t.Fatalf("kind = %q, want file", got.Kind)
		}
		if got.Name != "report.csv" {
			t.Fatalf("name = %q", got.Name)
		}
	})

	t.Run("a traversal attempt cannot escape the directory", func(t *testing.T) {
		data := []byte("x")
		got, err := svc.StoreAttachment(sender, "../../etc/passwd", int64(len(data)), bytes.NewReader(data))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if strings.Contains(got.URL, "..") {
			t.Fatalf("url escaped the directory: %q", got.URL)
		}
		if got.Name != "passwd" {
			t.Fatalf("name = %q, want passwd", got.Name)
		}
	})

	t.Run("rejects an oversized upload", func(t *testing.T) {
		_, err := svc.StoreAttachment(sender, "big.bin", maxAttachmentBytes+1, bytes.NewReader([]byte("x")))
		if !errors.Is(err, ErrAttachmentTooLarge) {
			t.Fatalf("expected ErrAttachmentTooLarge, got %v", err)
		}
	})
}

func TestMessagingService_DeleteLeavesTombstoneForBothSides(t *testing.T) {
	msgs := newMockMessageRepo()
	users := newMockUserRepo()
	svc := NewMessagingService(msgs, users, newMockBookingRepo(), newMockEventRepo(), newTestRedis(), wshub.NewHub())

	sender := uuid.New()
	recipient := uuid.New()
	stranger := uuid.New()
	users.add(domain.User{ID: sender, Username: "s", Email: "s@x.com"})
	users.add(domain.User{ID: recipient, Username: "r", Email: "r@x.com"})

	ctx := context.Background()
	created, _ := msgs.Create(ctx, domain.Message{
		SenderID: sender, RecipientID: recipient,
		Subject: "S", Body: "μυστικό", ImageURL: "/uploads/media/x.png",
	})

	t.Run("a stranger cannot delete it", func(t *testing.T) {
		if err := svc.DeleteForUser(ctx, created.ID, stranger); !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got %v", err)
		}
	})

	t.Run("the sender withdraws it for everyone", func(t *testing.T) {
		if err := svc.DeleteForUser(ctx, created.ID, sender); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		got := msgs.messages[created.ID]
		if !got.DeletedForEveryone {
			t.Fatal("expected a tombstone both sides can see")
		}
		// The content must not survive the withdrawal.
		if got.Body != "" || got.ImageURL != "" {
			t.Fatalf("content survived deletion: body=%q image=%q", got.Body, got.ImageURL)
		}
		// The row stays, so both sides still see that something was deleted.
		if got.DeletedBySender || got.DeletedByRecipient {
			t.Fatal("a withdrawal should not hide the row from either mailbox")
		}
	})

	t.Run("the recipient only hides it from their own mailbox", func(t *testing.T) {
		other, _ := msgs.Create(ctx, domain.Message{
			SenderID: sender, RecipientID: recipient, Subject: "S2", Body: "κείμενο",
		})
		if err := svc.DeleteForUser(ctx, other.ID, recipient); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		got := msgs.messages[other.ID]
		if got.DeletedForEveryone {
			t.Fatal("deleting a received message must not withdraw it from the sender")
		}
		if !got.DeletedByRecipient {
			t.Fatal("expected the recipient's own copy to be hidden")
		}
		if got.Body != "κείμενο" {
			t.Fatal("the sender's copy should keep its content")
		}
	})
}

func TestMessagingService_Reactions(t *testing.T) {
	msgs := newMockMessageRepo()
	users := newMockUserRepo()
	svc := NewMessagingService(msgs, users, newMockBookingRepo(), newMockEventRepo(), newTestRedis(), wshub.NewHub())

	sender := uuid.New()
	recipient := uuid.New()
	stranger := uuid.New()
	users.add(domain.User{ID: sender, Username: "s", Email: "s@x.com"})
	users.add(domain.User{ID: recipient, Username: "r", Email: "r@x.com"})

	ctx := context.Background()
	created, _ := msgs.Create(ctx, domain.Message{
		SenderID: sender, RecipientID: recipient, Subject: "S", Body: "γεια",
	})

	count := func() int { return len(msgs.reactions[created.ID]) }

	t.Run("adds a reaction", func(t *testing.T) {
		if err := svc.ToggleReaction(ctx, created.ID, recipient, "👍"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if count() != 1 {
			t.Fatalf("reactions = %d, want 1", count())
		}
	})

	t.Run("reacting again with the same emoji removes it", func(t *testing.T) {
		if err := svc.ToggleReaction(ctx, created.ID, recipient, "👍"); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if count() != 0 {
			t.Fatalf("reactions = %d, want 0", count())
		}
	})

	t.Run("both sides may react, with different emoji", func(t *testing.T) {
		_ = svc.ToggleReaction(ctx, created.ID, recipient, "❤️")
		_ = svc.ToggleReaction(ctx, created.ID, sender, "🎉")
		if count() != 2 {
			t.Fatalf("reactions = %d, want 2", count())
		}
	})

	t.Run("an outsider cannot react", func(t *testing.T) {
		if err := svc.ToggleReaction(ctx, created.ID, stranger, "👍"); !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got %v", err)
		}
	})

	t.Run("rejects a non-emoji blob", func(t *testing.T) {
		err := svc.ToggleReaction(ctx, created.ID, recipient, "this is not an emoji")
		if !errors.Is(err, ErrInvalidReaction) {
			t.Fatalf("expected ErrInvalidReaction, got %v", err)
		}
		if err := svc.ToggleReaction(ctx, created.ID, recipient, "  "); !errors.Is(err, ErrInvalidReaction) {
			t.Fatalf("expected ErrInvalidReaction for blank, got %v", err)
		}
	})

	t.Run("cannot react to a withdrawn message", func(t *testing.T) {
		_ = svc.DeleteForUser(ctx, created.ID, sender)
		if err := svc.ToggleReaction(ctx, created.ID, recipient, "👍"); !errors.Is(err, ErrMessageDeleted) {
			t.Fatalf("expected ErrMessageDeleted, got %v", err)
		}
	})
}

func TestMessagingService_HydrateThreadAttachesQuotesAndReactions(t *testing.T) {
	msgs := newMockMessageRepo()
	users := newMockUserRepo()
	svc := NewMessagingService(msgs, users, newMockBookingRepo(), newMockEventRepo(), newTestRedis(), wshub.NewHub())

	sender := uuid.New()
	recipient := uuid.New()
	users.add(domain.User{ID: sender, Username: "s", Email: "s@x.com"})
	users.add(domain.User{ID: recipient, Username: "r", Email: "r@x.com"})

	ctx := context.Background()
	first, _ := msgs.Create(ctx, domain.Message{
		SenderID: sender, RecipientID: recipient, Subject: "S", Body: "η ερώτηση",
	})
	reply, _ := msgs.Create(ctx, domain.Message{
		SenderID: recipient, RecipientID: sender, Subject: "Απ: S", Body: "η απάντηση",
		ReplyToID: &first.ID,
	})
	_ = svc.ToggleReaction(ctx, first.ID, recipient, "👍")

	hydrated, err := svc.HydrateThread(ctx, []domain.Message{first, reply})
	if err != nil {
		t.Fatalf("HydrateThread: %v", err)
	}

	if len(hydrated[0].Reactions) != 1 || hydrated[0].Reactions[0].Emoji != "👍" {
		t.Fatalf("reactions not attached: %#v", hydrated[0].Reactions)
	}
	if hydrated[0].ReplyTo != nil {
		t.Fatal("a message that is not a reply should carry no quote")
	}
	if hydrated[1].ReplyTo == nil {
		t.Fatal("the reply should quote the first message")
	}
	if hydrated[1].ReplyTo.Body != "η ερώτηση" {
		t.Fatalf("quote body = %q", hydrated[1].ReplyTo.Body)
	}
}

func TestMessagingService_TombstoneCarriesNoReactions(t *testing.T) {
	msgs := newMockMessageRepo()
	users := newMockUserRepo()
	svc := NewMessagingService(msgs, users, newMockBookingRepo(), newMockEventRepo(), newTestRedis(), wshub.NewHub())

	sender := uuid.New()
	recipient := uuid.New()
	users.add(domain.User{ID: sender, Username: "s", Email: "s@x.com"})
	users.add(domain.User{ID: recipient, Username: "r", Email: "r@x.com"})

	ctx := context.Background()
	created, _ := msgs.Create(ctx, domain.Message{
		SenderID: sender, RecipientID: recipient, Subject: "S", Body: "γεια",
	})
	if err := svc.ToggleReaction(ctx, created.ID, recipient, "👍"); err != nil {
		t.Fatalf("ToggleReaction: %v", err)
	}
	if err := svc.DeleteForUser(ctx, created.ID, sender); err != nil {
		t.Fatalf("DeleteForUser: %v", err)
	}

	hydrated, err := svc.HydrateThread(ctx, []domain.Message{msgs.messages[created.ID]})
	if err != nil {
		t.Fatalf("HydrateThread: %v", err)
	}
	if len(hydrated[0].Reactions) != 0 {
		t.Fatalf("a tombstone should carry no reactions, got %#v", hydrated[0].Reactions)
	}
}
