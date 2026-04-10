package service

import (
	"context"

	"github.com/google/uuid"
	"nexustickets/internal/domain"
	repo "nexustickets/internal/repository"
)

type ChatService struct {
	rooms repo.ChatRoomRepository
}

func NewChatService(rooms repo.ChatRoomRepository) *ChatService {
	return &ChatService{rooms: rooms}
}

func (s *ChatService) CreateOrGetDirectRoom(ctx context.Context, user1ID, user2ID uuid.UUID) (domain.ChatRoom, error) {
	return s.rooms.GetOrCreateDirectRoom(ctx, user1ID, user2ID)
}

func (s *ChatService) GetRoomByID(ctx context.Context, id uuid.UUID) (domain.ChatRoom, error) {
	return s.rooms.GetRoomByID(ctx, id)
}

func (s *ChatService) GetRoomByEvent(ctx context.Context, eventID uuid.UUID) (domain.ChatRoom, error) {
	return s.rooms.GetRoomByEvent(ctx, eventID)
}

func (s *ChatService) ListUserRooms(ctx context.Context, userID uuid.UUID) ([]domain.Conversation, error) {
	return s.rooms.ListUserRooms(ctx, userID)
}

func (s *ChatService) GetParticipants(ctx context.Context, roomID uuid.UUID) ([]domain.ChatRoomParticipant, error) {
	return s.rooms.GetParticipants(ctx, roomID)
}

func (s *ChatService) SendMessage(ctx context.Context, roomID, senderID uuid.UUID, content, imageURL, fileURL, fileName, gifURL *string) (domain.ChatMessage, error) {
	msg := domain.ChatMessage{
		RoomID:   roomID,
		SenderID: senderID,
		Content:  content,
		ImageURL: imageURL,
		FileURL:  fileURL,
		FileName: fileName,
		GifURL:   gifURL,
	}
	return s.rooms.CreateMessage(ctx, msg)
}

func (s *ChatService) GetMessages(ctx context.Context, roomID uuid.UUID, limit, offset int) ([]domain.ChatMessage, error) {
	return s.rooms.GetMessages(ctx, roomID, limit, offset)
}

func (s *ChatService) GetMessageByID(ctx context.Context, id uuid.UUID) (domain.ChatMessage, error) {
	return s.rooms.GetMessageByID(ctx, id)
}

func (s *ChatService) AddReaction(ctx context.Context, messageID, userID uuid.UUID, reactionType string) (domain.MessageReaction, error) {
	rxn := domain.MessageReaction{
		MessageID:    messageID,
		UserID:       userID,
		ReactionType: reactionType,
	}
	return s.rooms.AddReaction(ctx, rxn)
}

func (s *ChatService) RemoveReaction(ctx context.Context, messageID, userID uuid.UUID, reactionType string) error {
	return s.rooms.RemoveReaction(ctx, messageID, userID, reactionType)
}

func (s *ChatService) GetReactions(ctx context.Context, messageID uuid.UUID) ([]domain.MessageReaction, error) {
	return s.rooms.GetReactions(ctx, messageID)
}
