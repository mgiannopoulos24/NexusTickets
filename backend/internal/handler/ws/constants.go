package ws

const (
	// MaxMessageBytes caps inbound WebSocket frames from clients. The socket is
	// push-only, so anything a client sends is ignored, but a limit still stops
	// a misbehaving peer from buffering unbounded data.
	MaxMessageBytes = 1024

	// TypeNewMessage carries a message that just landed in the user's inbox.
	TypeNewMessage = "new_message"
	// TypeUnreadCount carries the user's current unread total, sent whenever it
	// changes so the navbar badge stays exact.
	TypeUnreadCount = "unread_count"
	// TypeSupportUpdate tells the other side of a support ticket that it was
	// opened, replied to or closed, so queues and threads refresh live.
	TypeSupportUpdate = "support_update"
)
