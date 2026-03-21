package ws

const (
	// MaxMessageBytes caps inbound WebSocket frames from clients.
	MaxMessageBytes = 4096

	TypeNewMessage  = "new_message"
	TypeUnreadCount = "unread_count"
)
