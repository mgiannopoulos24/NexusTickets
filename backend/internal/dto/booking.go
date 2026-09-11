package dto

type CreateBookingRequest struct {
	EventID      string `json:"event_id"`
	TicketTypeID string `json:"ticket_type_id"`
	Quantity     int    `json:"quantity"`
}

// BookingEventSummary is enough of the event to render a booking row without a
// second request per booking.
type BookingEventSummary struct {
	ID string `json:"id"`
	// OrganizerID lets the attendee open a message to the organizer (§10).
	OrganizerID string `json:"organizer_id"`
	Title       string `json:"title"`
	Venue       string `json:"venue"`
	City        string `json:"city"`
	StartAt     string `json:"start_at"`
	EndAt       string `json:"end_at"`
	Status      string `json:"status"`
}

// BookingAttendee identifies who made the booking (shown to the organizer).
type BookingAttendee struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	FullName string `json:"full_name"`
	Email    string `json:"email"`
}

// BookingTicketType names the ticket that was bought and its unit price.
type BookingTicketType struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
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

	Event      *BookingEventSummary `json:"event,omitempty"`
	Attendee   *BookingAttendee     `json:"attendee,omitempty"`
	TicketType *BookingTicketType   `json:"ticket_type,omitempty"`
}
