package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"nexustickets/internal/domain"
	"nexustickets/internal/repository"
)

type chatRoomRepositoryPostgres struct {
	db *gorm.DB
}

func NewChatRoomRepository(db *gorm.DB) repository.ChatRoomRepository {
	return &chatRoomRepositoryPostgres{db: db}
}

func (r *chatRoomRepositoryPostgres) CreateRoom(ctx context.Context, room domain.ChatRoom) (domain.ChatRoom, error) {
	m := chatRoomDomainToModel(room)
	m.ID = uuid.Must(uuid.NewV7())
	if err := r.db.WithContext(ctx).Create(&m).Error; err != nil {
		return domain.ChatRoom{}, err
	}
	return chatRoomModelToDomain(m), nil
}

func (r *chatRoomRepositoryPostgres) GetRoomByID(ctx context.Context, id uuid.UUID) (domain.ChatRoom, error) {
	var m ChatRoomModel
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&m).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domain.ChatRoom{}, domain.ErrNotFound
		}
		return domain.ChatRoom{}, err
	}
	return chatRoomModelToDomain(m), nil
}

func (r *chatRoomRepositoryPostgres) GetOrCreateDirectRoom(ctx context.Context, user1ID, user2ID uuid.UUID) (domain.ChatRoom, error) {
	var m ChatRoomModel

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing ChatRoomModel
		err := tx.Joins("JOIN chat_room_participants crp ON crp.room_id = chat_rooms.id").
			Where("chat_rooms.is_group = ?", false).
			Where("crp.user_id IN (?, ?)", user1ID, user2ID).
			Group("chat_rooms.id").
			Having("COUNT(crp.user_id) = 2").
			First(&existing).Error
		if err == nil {
			m = existing
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		m = ChatRoomModel{
			ID:          uuid.Must(uuid.NewV7()),
			IsGroup:     false,
			CreatedByID: &user1ID,
		}
		if err := tx.Create(&m).Error; err != nil {
			return err
		}

		participants := []ChatRoomParticipantModel{
			{ID: uuid.Must(uuid.NewV7()), RoomID: m.ID, UserID: user1ID},
			{ID: uuid.Must(uuid.NewV7()), RoomID: m.ID, UserID: user2ID},
		}
		return tx.Create(&participants).Error
	})
	if err != nil {
		return domain.ChatRoom{}, err
	}
	return chatRoomModelToDomain(m), nil
}

func (r *chatRoomRepositoryPostgres) GetRoomByEvent(ctx context.Context, eventID uuid.UUID) (domain.ChatRoom, error) {
	var m ChatRoomModel
	if err := r.db.WithContext(ctx).Where("event_id = ?", eventID).First(&m).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domain.ChatRoom{}, domain.ErrNotFound
		}
		return domain.ChatRoom{}, err
	}
	return chatRoomModelToDomain(m), nil
}

func (r *chatRoomRepositoryPostgres) ListUserRooms(ctx context.Context, userID uuid.UUID) ([]domain.Conversation, error) {
	var results []struct {
		Room      ChatRoomModel
		LastMsg   ChatMessageModel
		OtherUser UserModel
		UnreadCnt int
	}

	subQuery := r.db.Model(&ChatRoomParticipantModel{}).Where("user_id = ?", userID).Select("room_id")

	if err := r.db.WithContext(ctx).
		Joins("JOIN chat_room_participants crp ON crp.room_id = chat_rooms.id AND crp.user_id != ?", userID).
		Joins("LEFT JOIN LATERAL (SELECT * FROM chat_messages WHERE room_id = chat_rooms.id ORDER BY created_at DESC LIMIT 1) lm ON true").
		Joins("LEFT JOIN users u ON u.id = COALESCE(lm.sender_id, crp.user_id)").
		Where("chat_rooms.id IN ?", subQuery).
		Select("chat_rooms.id, chat_rooms.is_group, chat_rooms.name, chat_rooms.created_by_id, chat_rooms.event_id, chat_rooms.is_read_only, chat_rooms.created_at, lm.id, lm.room_id, lm.sender_id, lm.content, lm.image_url, lm.file_url, lm.file_name, lm.gif_url, lm.reply_to_id, lm.created_at, u.id, u.username, u.first_name, u.last_name, u.email, u.photo_url, (SELECT COUNT(*) FROM chat_messages cm2 WHERE cm2.room_id = chat_rooms.id AND cm2.sender_id != ? AND cm2.id > COALESCE((SELECT MAX(cm3.id) FROM chat_messages cm3 JOIN chat_room_participants crp2 ON crp2.room_id = cm3.room_id AND crp2.user_id = ? AND cm3.id > cm2.id), '00000000-0000-0000-0000-000000000000')) as unread_count", userID, userID).
		Scan(&results).Error; err != nil {
		return nil, err
	}

	convos := make([]domain.Conversation, len(results))
	for i, res := range results {
		msg := chatMessageModelToDomain(res.LastMsg)
		u := userModelToDomain(res.OtherUser)
		convos[i] = domain.Conversation{
			ID:          res.Room.ID,
			OtherUser:   &u,
			LastMessage: &msg,
			UnreadCount: res.UnreadCnt,
			IsOnline:    false,
		}
	}
	return convos, nil
}

func (r *chatRoomRepositoryPostgres) AddParticipant(ctx context.Context, p domain.ChatRoomParticipant) error {
	m := ChatRoomParticipantModel{
		ID:     uuid.Must(uuid.NewV7()),
		RoomID: p.RoomID,
		UserID: p.UserID,
	}
	return r.db.WithContext(ctx).Create(&m).Error
}

func (r *chatRoomRepositoryPostgres) RemoveParticipant(ctx context.Context, roomID, userID uuid.UUID) error {
	return r.db.WithContext(ctx).Where("room_id = ? AND user_id = ?", roomID, userID).Delete(&ChatRoomParticipantModel{}).Error
}

func (r *chatRoomRepositoryPostgres) GetParticipants(ctx context.Context, roomID uuid.UUID) ([]domain.ChatRoomParticipant, error) {
	var ms []ChatRoomParticipantModel
	if err := r.db.WithContext(ctx).Preload("User").Where("room_id = ?", roomID).Find(&ms).Error; err != nil {
		return nil, err
	}
	ps := make([]domain.ChatRoomParticipant, len(ms))
	for i, m := range ms {
		ps[i] = chatRoomParticipantModelToDomain(m)
	}
	return ps, nil
}

func (r *chatRoomRepositoryPostgres) CreateMessage(ctx context.Context, msg domain.ChatMessage) (domain.ChatMessage, error) {
	m := chatMessageDomainToModel(msg)
	m.ID = uuid.Must(uuid.NewV7())
	if err := r.db.WithContext(ctx).Create(&m).Error; err != nil {
		return domain.ChatMessage{}, err
	}
	var loaded ChatMessageModel
	if err := r.db.WithContext(ctx).Preload("Sender").First(&loaded, m.ID).Error; err != nil {
		return domain.ChatMessage{}, err
	}
	return chatMessageModelToDomain(loaded), nil
}

func (r *chatRoomRepositoryPostgres) GetMessages(ctx context.Context, roomID uuid.UUID, limit, offset int) ([]domain.ChatMessage, error) {
	var ms []ChatMessageModel
	if err := r.db.WithContext(ctx).Preload("Sender").Where("room_id = ?", roomID).Order("created_at DESC").Offset(offset).Limit(limit).Find(&ms).Error; err != nil {
		return nil, err
	}
	msgs := make([]domain.ChatMessage, len(ms))
	for i, m := range ms {
		msgs[i] = chatMessageModelToDomain(m)
	}
	return msgs, nil
}

func (r *chatRoomRepositoryPostgres) GetMessageByID(ctx context.Context, id uuid.UUID) (domain.ChatMessage, error) {
	var m ChatMessageModel
	if err := r.db.WithContext(ctx).Preload("Sender").Where("id = ?", id).First(&m).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domain.ChatMessage{}, domain.ErrNotFound
		}
		return domain.ChatMessage{}, err
	}
	return chatMessageModelToDomain(m), nil
}

func (r *chatRoomRepositoryPostgres) AddReaction(ctx context.Context, rxn domain.MessageReaction) (domain.MessageReaction, error) {
	m := MessageReactionModel{
		ID:           uuid.Must(uuid.NewV7()),
		MessageID:    rxn.MessageID,
		UserID:       rxn.UserID,
		ReactionType: rxn.ReactionType,
	}
	if err := r.db.WithContext(ctx).Create(&m).Error; err != nil {
		return domain.MessageReaction{}, err
	}
	var loaded MessageReactionModel
	if err := r.db.WithContext(ctx).Preload("User").First(&loaded, m.ID).Error; err != nil {
		return domain.MessageReaction{}, err
	}
	return messageReactionModelToDomain(loaded), nil
}

func (r *chatRoomRepositoryPostgres) RemoveReaction(ctx context.Context, messageID, userID uuid.UUID, reactionType string) error {
	return r.db.WithContext(ctx).Where("message_id = ? AND user_id = ? AND reaction_type = ?", messageID, userID, reactionType).Delete(&MessageReactionModel{}).Error
}

func (r *chatRoomRepositoryPostgres) GetReactions(ctx context.Context, messageID uuid.UUID) ([]domain.MessageReaction, error) {
	var ms []MessageReactionModel
	if err := r.db.WithContext(ctx).Preload("User").Where("message_id = ?", messageID).Find(&ms).Error; err != nil {
		return nil, err
	}
	rxns := make([]domain.MessageReaction, len(ms))
	for i, m := range ms {
		rxns[i] = messageReactionModelToDomain(m)
	}
	return rxns, nil
}
