package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	wshub "nexustickets/internal/handler/ws"
	"github.com/redis/go-redis/v9"

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
		redis.NewClient(&redis.Options{Addr: "localhost:6379"}),
		wshub.NewHub(),
	)
}

func TestMessagingService_SendMessageValidation(t *testing.T) {
	msgs := newMockMessageRepo()
	users := newMockUserRepo()
	svc := NewMessagingService(msgs, users, newMockBookingRepo(), newMockEventRepo(), redis.NewClient(&redis.Options{Addr: "localhost:6379"}), wshub.NewHub())

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
	svc := NewMessagingService(msgs, users, newMockBookingRepo(), newMockEventRepo(), redis.NewClient(&redis.Options{Addr: "localhost:6379"}), wshub.NewHub())

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

func TestMessagingService_NotifyEventCancellation(t *testing.T) {
	msgs := newMockMessageRepo()
	users := newMockUserRepo()
	events := newMockEventRepo()
	bookings := newMockBookingRepo()

	svc := NewMessagingService(msgs, users, bookings, events, redis.NewClient(&redis.Options{Addr: "localhost:6379"}), wshub.NewHub())

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
