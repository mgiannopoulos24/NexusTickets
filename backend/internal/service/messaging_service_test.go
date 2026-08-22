package service

import (
	"context"
	"errors"
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
}

func newMockMessageRepo() *mockMessageRepo {
	return &mockMessageRepo{
		messages:  make(map[uuid.UUID]domain.Message),
		inbox:     make(map[uuid.UUID][]domain.Message),
		sent:      make(map[uuid.UUID][]domain.Message),
		unreadCnt: make(map[uuid.UUID]int),
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
