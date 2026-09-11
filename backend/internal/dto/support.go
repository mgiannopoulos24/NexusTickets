package dto

// OpenSupportTicketRequest starts a request to the administration.
type OpenSupportTicketRequest struct {
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

// SupportReplyRequest appends to a ticket's thread.
type SupportReplyRequest struct {
	Body string `json:"body"`
}

// SupportParticipant identifies a ticket owner or a message author.
type SupportParticipant struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	FullName string `json:"full_name"`
	Role     string `json:"role"`
}

type SupportTicketResponse struct {
	ID        string `json:"id"`
	UserID    string `json:"user_id"`
	Subject   string `json:"subject"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`

	User *SupportParticipant `json:"user,omitempty"`
}

type SupportMessageResponse struct {
	ID        string `json:"id"`
	TicketID  string `json:"ticket_id"`
	AuthorID  string `json:"author_id"`
	Body      string `json:"body"`
	CreatedAt string `json:"created_at"`
	// FromAdmin tells the thread view which side wrote it.
	FromAdmin bool `json:"from_admin"`

	Author *SupportParticipant `json:"author,omitempty"`
}

// SupportThreadResponse is a ticket with its whole conversation.
type SupportThreadResponse struct {
	Ticket   SupportTicketResponse    `json:"ticket"`
	Messages []SupportMessageResponse `json:"messages"`
}

// SupportListMeta is the pagination envelope of a ticket list.
type SupportListMeta struct {
	Total  int `json:"total"`
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
}

// SupportCountsResponse is the admin dashboard summary.
type SupportCountsResponse struct {
	Open     int `json:"open"`
	Answered int `json:"answered"`
	Closed   int `json:"closed"`
}
