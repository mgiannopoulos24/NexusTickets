package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"nexustickets/internal/domain"
)

type mockChatRoomRepo struct {
	rooms        map[uuid.UUID]domain.ChatRoom
	messages     map[uuid.UUID]domain.ChatMessage
	reactions    map[uuid.UUID]domain.MessageReaction
	participants map[uuid.UUID][]domain.ChatRoomParticipant
	convos       []domain.Conversation
}

func newMockChatRoomRepo() *mockChatRoomRepo {
	return &mockChatRoomRepo{
		rooms:        make(map[uuid.UUID]domain.ChatRoom),
		messages:     make(map[uuid.UUID]domain.ChatMessage),
		reactions:    make(map[uuid.UUID]domain.MessageReaction),
		participants: make(map[uuid.UUID][]domain.ChatRoomParticipant),
	}
}

func (m *mockChatRoomRepo) CreateRoom(_ context.Context, room domain.ChatRoom) (domain.ChatRoom, error) {
	room.ID = uuid.New()
	room.CreatedAt = time.Now().UTC()
	m.rooms[room.ID] = room
	return room, nil
}

func (m *mockChatRoomRepo) GetRoomByID(_ context.Context, id uuid.UUID) (domain.ChatRoom, error) {
	r, ok := m.rooms[id]
	if !ok {
		return domain.ChatRoom{}, domain.ErrNotFound
	}
	return r, nil
}

func (m *mockChatRoomRepo) GetOrCreateDirectRoom(_ context.Context, u1, u2 uuid.UUID) (domain.ChatRoom, error) {
	for _, r := range m.rooms {
		if r.IsGroup {
			continue
		}
		return r, nil
	}
	r := domain.ChatRoom{ID: uuid.New(), IsGroup: false, CreatedAt: time.Now()}
	m.rooms[r.ID] = r
	return r, nil
}

func (m *mockChatRoomRepo) GetRoomByEvent(_ context.Context, eid uuid.UUID) (domain.ChatRoom, error) {
	for _, r := range m.rooms {
		if r.EventID != nil && *r.EventID == eid {
			return r, nil
		}
	}
	return domain.ChatRoom{}, domain.ErrNotFound
}

func (m *mockChatRoomRepo) ListUserRooms(_ context.Context, uid uuid.UUID) ([]domain.Conversation, error) {
	return m.convos, nil
}

func (m *mockChatRoomRepo) AddParticipant(_ context.Context, p domain.ChatRoomParticipant) error {
	m.participants[p.RoomID] = append(m.participants[p.RoomID], p)
	return nil
}

func (m *mockChatRoomRepo) RemoveParticipant(_ context.Context, roomID, userID uuid.UUID) error {
	ps := m.participants[roomID]
	for i, p := range ps {
		if p.UserID == userID {
			m.participants[roomID] = append(ps[:i], ps[i+1:]...)
			return nil
		}
	}
	return nil
}

func (m *mockChatRoomRepo) GetParticipants(_ context.Context, roomID uuid.UUID) ([]domain.ChatRoomParticipant, error) {
	return m.participants[roomID], nil
}

func (m *mockChatRoomRepo) CreateMessage(_ context.Context, msg domain.ChatMessage) (domain.ChatMessage, error) {
	msg.ID = uuid.New()
	msg.CreatedAt = time.Now().UTC()
	m.messages[msg.ID] = msg
	return msg, nil
}

func (m *mockChatRoomRepo) GetMessages(_ context.Context, roomID uuid.UUID, limit, offset int) ([]domain.ChatMessage, error) {
	var out []domain.ChatMessage
	for _, msg := range m.messages {
		if msg.RoomID == roomID {
			out = append(out, msg)
		}
	}
	return out, nil
}

func (m *mockChatRoomRepo) GetMessageByID(_ context.Context, id uuid.UUID) (domain.ChatMessage, error) {
	msg, ok := m.messages[id]
	if !ok {
		return domain.ChatMessage{}, domain.ErrNotFound
	}
	return msg, nil
}

func (m *mockChatRoomRepo) AddReaction(_ context.Context, r domain.MessageReaction) (domain.MessageReaction, error) {
	r.ID = uuid.New()
	r.CreatedAt = time.Now().UTC()
	m.reactions[r.ID] = r
	return r, nil
}

func (m *mockChatRoomRepo) RemoveReaction(_ context.Context, msgID, userID uuid.UUID, rtype string) error {
	for id, r := range m.reactions {
		if r.MessageID == msgID && r.UserID == userID && r.ReactionType == rtype {
			delete(m.reactions, id)
			return nil
		}
	}
	return nil
}

func (m *mockChatRoomRepo) GetReactions(_ context.Context, msgID uuid.UUID) ([]domain.MessageReaction, error) {
	var out []domain.MessageReaction
	for _, r := range m.reactions {
		if r.MessageID == msgID {
			out = append(out, r)
		}
	}
	return out, nil
}

func TestChatService_CreateOrGetDirectRoom(t *testing.T) {
	repo := newMockChatRoomRepo()
	svc := NewChatService(repo)

	u1 := uuid.New()
	u2 := uuid.New()

	room, err := svc.CreateOrGetDirectRoom(context.Background(), u1, u2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if room.ID == uuid.Nil {
		t.Fatal("expected non-nil room ID")
	}
}

func TestChatService_SendAndGetMessages(t *testing.T) {
	repo := newMockChatRoomRepo()
	svc := NewChatService(repo)

	roomID := uuid.New()
	senderID := uuid.New()
	content := "Hello!"

	msg, err := svc.SendMessage(context.Background(), roomID, senderID, &content, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if msg.Content == nil || *msg.Content != content {
		t.Fatalf("expected content %q, got %v", content, msg.Content)
	}
	if msg.SenderID != senderID {
		t.Fatalf("expected sender %s, got %s", senderID, msg.SenderID)
	}

	messages, err := svc.GetMessages(context.Background(), roomID, 10, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(messages) != 1 {
		t.Fatalf("expected 1 message, got %d", len(messages))
	}
}

func TestChatService_Reactions(t *testing.T) {
	repo := newMockChatRoomRepo()
	svc := NewChatService(repo)

	msgID := uuid.New()
	userID := uuid.New()

	rxn, err := svc.AddReaction(context.Background(), msgID, userID, "like")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rxn.ReactionType != "like" {
		t.Fatalf("expected 'like', got %s", rxn.ReactionType)
	}
	if rxn.MessageID != msgID {
		t.Fatalf("expected msg id %s, got %s", msgID, rxn.MessageID)
	}

	err = svc.RemoveReaction(context.Background(), msgID, userID, "like")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	reactions, err := svc.GetReactions(context.Background(), msgID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(reactions) != 0 {
		t.Fatalf("expected 0 reactions after removal, got %d", len(reactions))
	}
}

func TestChatService_GetRoomByID(t *testing.T) {
	repo := newMockChatRoomRepo()
	svc := NewChatService(repo)

	room, _ := repo.CreateRoom(context.Background(), domain.ChatRoom{
		IsGroup: true,
		Name:    strPtr("Group Chat"),
	})

	t.Run("found", func(t *testing.T) {
		got, err := svc.GetRoomByID(context.Background(), room.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.ID != room.ID {
			t.Fatalf("expected room %s, got %s", room.ID, got.ID)
		}
	})

	t.Run("not found", func(t *testing.T) {
		_, err := svc.GetRoomByID(context.Background(), uuid.New())
		if !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("expected ErrNotFound, got %v", err)
		}
	})
}
