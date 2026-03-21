package dto

type SendMessageRequest struct {
	RecipientID string `json:"recipient_id"`
	Subject     string `json:"subject"`
	Body        string `json:"body"`
}

type MessageResponse struct {
	ID          string  `json:"id"`
	SenderID    string  `json:"sender_id"`
	RecipientID string  `json:"recipient_id"`
	Subject     string  `json:"subject"`
	Body        string  `json:"body"`
	ReadAt      *string `json:"read_at"`
	CreatedAt   string  `json:"created_at"`
}

type UnreadCountResponse struct {
	Count int `json:"count"`
}
