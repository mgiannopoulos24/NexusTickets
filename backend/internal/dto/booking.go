package dto

type CreateBookingRequest struct {
	EventID      string `json:"event_id"`
	TicketTypeID string `json:"ticket_type_id"`
	Quantity     int    `json:"quantity"`
}

type BookingResponse struct {
	ID           string  `json:"id"`
	UserID       string  `json:"user_id"`
	EventID      string  `json:"event_id"`
	TicketTypeID string  `json:"ticket_type_id"`
	Quantity     int     `json:"quantity"`
	TotalCost    float64 `json:"total_cost"`
	Status       string  `json:"status"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`
}
