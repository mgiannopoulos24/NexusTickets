package dto

type UserResponse struct {
	ID            string   `json:"id"`
	Username      string   `json:"username"`
	FirstName     string   `json:"first_name"`
	LastName      string   `json:"last_name"`
	Email         string   `json:"email"`
	Phone         *string  `json:"phone"`
	Address       *string  `json:"address"`
	City          *string  `json:"city"`
	Country       *string  `json:"country"`
	Latitude      *float64 `json:"latitude"`
	Longitude     *float64 `json:"longitude"`
	VATNumber     *string  `json:"vat_number"`
	Role          string   `json:"role"`
	AccountStatus string   `json:"account_status"`
	CreatedAt     string   `json:"created_at"`
	UpdatedAt     string   `json:"updated_at"`
}

type UpdateProfileRequest struct {
	FirstName *string  `json:"first_name"`
	LastName  *string  `json:"last_name"`
	Email     *string  `json:"email"`
	Phone     *string  `json:"phone"`
	Address   *string  `json:"address"`
	City      *string  `json:"city"`
	Country   *string  `json:"country"`
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
	VATNumber *string  `json:"vat_number"`
}
