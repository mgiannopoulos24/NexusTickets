package domain

import (
	"time"

	"github.com/google/uuid"
)

type ChatRoom struct {
	ID uuid.UUID

	IsGroup bool
	Name    *string

	CreatedByID *uuid.UUID
	EventID     *uuid.UUID
	IsReadOnly  bool

	CreatedAt time.Time
}

type ChatRoomParticipant struct {
	ID         uuid.UUID
	RoomID     uuid.UUID
	UserID     uuid.UUID
	User       *User
	JoinedAt   time.Time
	LastReadAt *time.Time
}

type ChatMessage struct {
	ID uuid.UUID

	RoomID   uuid.UUID
	SenderID uuid.UUID
	Sender   *User

	Content   *string
	ImageURL  *string
	FileURL   *string
	FileName  *string
	GifURL    *string
	ReplyToID *uuid.UUID

	Reactions []MessageReaction

	CreatedAt time.Time
}

type MessageReaction struct {
	ID uuid.UUID

	MessageID    uuid.UUID
	UserID       uuid.UUID
	User         *User
	ReactionType string

	CreatedAt time.Time
}

type Conversation struct {
	ID          uuid.UUID
	OtherUser   *User
	LastMessage *ChatMessage
	UnreadCount int
	IsOnline    bool
}
