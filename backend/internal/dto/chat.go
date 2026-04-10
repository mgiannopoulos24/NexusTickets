package dto

import "github.com/google/uuid"

type CreateChatRoomRequest struct {
	UserID  *uuid.UUID `json:"user_id"`
	EventID *uuid.UUID `json:"event_id"`
}

type ChatMessageRequest struct {
	Content  *string `json:"content"`
	ImageURL *string `json:"image_url"`
	FileURL  *string `json:"file_url"`
	FileName *string `json:"file_name"`
	GifURL   *string `json:"gif_url"`
}

type ReactRequest struct {
	ReactionType string `json:"reaction_type"`
}

type ChatRoomResponse struct {
	ID         uuid.UUID  `json:"id"`
	IsGroup    bool       `json:"is_group"`
	Name       *string    `json:"name"`
	EventID    *uuid.UUID `json:"event_id,omitempty"`
	IsReadOnly bool       `json:"is_read_only"`
}

type ChatMessageResponse struct {
	ID        uuid.UUID                 `json:"id"`
	RoomID    uuid.UUID                 `json:"room_id"`
	SenderID  uuid.UUID                 `json:"sender_id"`
	Sender    *UserResponseChat         `json:"sender,omitempty"`
	Content   *string                   `json:"content,omitempty"`
	ImageURL  *string                   `json:"image_url,omitempty"`
	FileURL   *string                   `json:"file_url,omitempty"`
	FileName  *string                   `json:"file_name,omitempty"`
	GifURL    *string                   `json:"gif_url,omitempty"`
	Reactions []MessageReactionResponse `json:"reactions"`
	CreatedAt string                    `json:"created_at"`
}

type UserResponseChat struct {
	ID        uuid.UUID `json:"id"`
	Username  string    `json:"username"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	PhotoURL  *string   `json:"photo_url,omitempty"`
}

type MessageReactionResponse struct {
	ID           uuid.UUID         `json:"id"`
	UserID       uuid.UUID         `json:"user_id"`
	User         *UserResponseChat `json:"user"`
	ReactionType string            `json:"reaction_type"`
}

type ConversationResponse struct {
	ID          uuid.UUID            `json:"id"`
	OtherUser   *UserResponseChat    `json:"other_user"`
	LastMessage *ChatMessageResponse `json:"last_message,omitempty"`
	UnreadCount int                  `json:"unread_count"`
	IsOnline    bool                 `json:"is_online"`
}
