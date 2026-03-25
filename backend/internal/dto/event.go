package dto

type TicketTypeRequest struct {
	Name     string  `json:"name"`
	Price    float64 `json:"price"`
	Quantity int     `json:"quantity"`
}

type CreateEventRequest struct {
	Title       string              `json:"title"`
	Description string              `json:"description"`
	Venue       string              `json:"venue"`
	FeaturedImageURL *string         `json:"featured_image_url"`
	Address     *string             `json:"address"`
	City        string              `json:"city"`
	Country     *string             `json:"country"`
	Latitude    *float64            `json:"latitude"`
	Longitude   *float64            `json:"longitude"`
	StartAt     string              `json:"start_at"`
	EndAt       string              `json:"end_at"`
	Capacity    int                 `json:"capacity"`
	Categories  []string            `json:"categories"`
	TicketTypes []TicketTypeRequest `json:"ticket_types"`
}

type UpdateEventRequest struct {
	Title       *string              `json:"title"`
	Description *string              `json:"description"`
	Venue       *string              `json:"venue"`
	FeaturedImageURL *string         `json:"featured_image_url"`
	Address     *string              `json:"address"`
	City        *string              `json:"city"`
	Country     *string              `json:"country"`
	Latitude    *float64             `json:"latitude"`
	Longitude   *float64             `json:"longitude"`
	StartAt     *string              `json:"start_at"`
	EndAt       *string              `json:"end_at"`
	Capacity    *int                 `json:"capacity"`
	Categories  *[]string            `json:"categories"`
	TicketTypes *[]TicketTypeRequest `json:"ticket_types"`
}

type TicketTypeResponse struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Quantity  int     `json:"quantity"`
	Available int     `json:"available"`
}

type EventResponse struct {
	ID          string               `json:"id"`
	OrganizerID string               `json:"organizer_id"`
	Title       string               `json:"title"`
	Description string               `json:"description"`
	Venue       string               `json:"venue"`
	FeaturedImageURL *string          `json:"featured_image_url"`
	Address     *string              `json:"address"`
	City        string               `json:"city"`
	Country     *string              `json:"country"`
	Latitude    *float64             `json:"latitude"`
	Longitude   *float64             `json:"longitude"`
	StartAt     string               `json:"start_at"`
	EndAt       string               `json:"end_at"`
	Capacity    int                  `json:"capacity"`
	Status      string               `json:"status"`
	Categories  []string             `json:"categories"`
	TicketTypes []TicketTypeResponse `json:"ticket_types"`
	CreatedAt   string               `json:"created_at"`
	UpdatedAt   string               `json:"updated_at"`
}
