package dto

type SendMessageRequest struct {
	RecipientID string `json:"recipient_id"`
	Subject     string `json:"subject"`
	Body        string `json:"body"`
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

	Sender    *MessageParticipant `json:"sender,omitempty"`
	Recipient *MessageParticipant `json:"recipient,omitempty"`
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

type UnreadCountResponse struct {
	Count int `json:"count"`
}
