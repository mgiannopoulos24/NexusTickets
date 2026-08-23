package ws

const (
	// MaxMessageBytes caps inbound WebSocket frames from clients.
	MaxMessageBytes = 4096

	TypeNewMessage  = "new_message"
	TypeUnreadCount = "unread_count"
	// TypeTyping travels both ways: a client announces it is typing to one
	// recipient, and the server relays that to the recipient's connections.
	TypeTyping = "typing"
	// TypeMessageDeleted and TypeReactionChanged keep an open thread in step
	// when the other side withdraws a message or reacts to one.
	TypeMessageDeleted  = "message_deleted"
	TypeReactionChanged = "reaction_changed"
)
