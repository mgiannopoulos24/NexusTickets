package dto

// SendMessageRequest composes one message to one recipient.
type SendMessageRequest struct {
	RecipientID string `json:"recipient_id"`
	// EventID optionally names the event the message is about.
	EventID string `json:"event_id,omitempty"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

// NotifyAttendeesRequest is an organizer's notice to everyone who booked one
// of their events.
type NotifyAttendeesRequest struct {
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

// NotifyAttendeesResponse reports how many inboxes the notice landed in.
type NotifyAttendeesResponse struct {
	Recipients int `json:"recipients"`
}

// MessageParticipant is the display identity of a message's sender or
// recipient, so a mailbox can show who wrote to whom without extra lookups.
type MessageParticipant struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	FullName string `json:"full_name"`
	Role     string `json:"role"`
}

// MessageEventRef is the event a message refers to, enough to label and link it.
type MessageEventRef struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

type MessageResponse struct {
	ID          string  `json:"id"`
	SenderID    string  `json:"sender_id"`
	RecipientID string  `json:"recipient_id"`
	EventID     *string `json:"event_id"`
	Subject     string  `json:"subject"`
	Body        string  `json:"body"`
	// ReadAt is null while the recipient has not opened the message — the
	// "new message" indicator in the inbox.
	ReadAt    *string `json:"read_at"`
	CreatedAt string  `json:"created_at"`

	Sender    *MessageParticipant `json:"sender,omitempty"`
	Recipient *MessageParticipant `json:"recipient,omitempty"`
	Event     *MessageEventRef    `json:"event,omitempty"`
}

// MailboxMeta is the pagination envelope of an inbox / sent page.
type MailboxMeta struct {
	Total  int `json:"total"`
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
}

// RecipientResponse is one entry of the "who can I write to" list.
type RecipientResponse struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	FullName string `json:"full_name"`
	Role     string `json:"role"`
}

type UnreadCountResponse struct {
	Count int `json:"count"`
}
