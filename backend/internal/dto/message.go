package dto

type SendMessageRequest struct {
	RecipientID string `json:"recipient_id"`
	Subject     string `json:"subject"`
	Body        string `json:"body"`

	// One attachment per message. `body` is optional when one is present.
	ImageURL string `json:"image_url,omitempty"`
	FileURL  string `json:"file_url,omitempty"`
	FileName string `json:"file_name,omitempty"`
	GifURL   string `json:"gif_url,omitempty"`

	// ReplyToID quotes an earlier message in the same thread.
	ReplyToID string `json:"reply_to_id,omitempty"`
}

// AttachmentResponse is what an upload returns, ready to be attached to a
// message.
type AttachmentResponse struct {
	URL string `json:"url"`
	// Name is the original file name, shown on a file bubble.
	Name string `json:"name"`
	// Kind is "image" or "file" — it decides how the bubble renders.
	Kind string `json:"kind"`
	Size int64  `json:"size"`
}

// MessageParticipant is the display identity of a message's sender or
// recipient, so a mailbox can show who wrote to whom without extra lookups.
type MessageParticipant struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	FullName string `json:"full_name"`
	Role     string `json:"role"`
}

type MessageResponse struct {
	ID          string  `json:"id"`
	SenderID    string  `json:"sender_id"`
	RecipientID string  `json:"recipient_id"`
	Subject     string  `json:"subject"`
	Body        string  `json:"body"`
	ReadAt      *string `json:"read_at"`
	CreatedAt   string  `json:"created_at"`

	ImageURL string `json:"image_url,omitempty"`
	FileURL  string `json:"file_url,omitempty"`
	FileName string `json:"file_name,omitempty"`
	GifURL   string `json:"gif_url,omitempty"`

	// Deleted marks a message withdrawn by its sender: both sides still see the
	// tombstone, but the content is gone.
	Deleted bool `json:"deleted"`

	ReplyTo   *MessageQuote     `json:"reply_to,omitempty"`
	Reactions []ReactionSummary `json:"reactions,omitempty"`

	Sender    *MessageParticipant `json:"sender,omitempty"`
	Recipient *MessageParticipant `json:"recipient,omitempty"`
}

// MessageQuote is the one-line preview shown above a reply.
type MessageQuote struct {
	ID       string `json:"id"`
	SenderID string `json:"sender_id"`
	Body     string `json:"body"`
	Deleted  bool   `json:"deleted"`
}

// ReactionSummary groups one emoji across everyone who used it.
type ReactionSummary struct {
	Emoji string `json:"emoji"`
	Count int    `json:"count"`
	// Mine is true when the current user is one of them, so the UI can
	// highlight it and a tap can toggle it off.
	Mine bool `json:"mine"`
}

// ReactToMessageRequest toggles one emoji on a mailbox message.
type ReactToMessageRequest struct {
	Emoji string `json:"emoji"`
}

// RecipientResponse is one entry of the "who can I write to" list.
type RecipientResponse struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	FullName string `json:"full_name"`
	Role     string `json:"role"`
	// Support marks an administrator, reachable without a booking.
	Support bool `json:"support"`
}

// MailboxConversationResponse is one thread in the messenger sidebar.
type MailboxConversationResponse struct {
	User        MessageParticipant `json:"user"`
	Support     bool               `json:"support"`
	LastMessage MessageResponse    `json:"last_message"`
	UnreadCount int                `json:"unread_count"`
}

type UnreadCountResponse struct {
	Count int `json:"count"`
}
