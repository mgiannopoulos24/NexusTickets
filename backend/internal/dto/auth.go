package dto

type RegisterRequest struct {
	Username        string  `json:"username"`
	Password        string  `json:"password"`
	ConfirmPassword string  `json:"confirm_password"`
	FirstName       string  `json:"first_name"`
	LastName        string  `json:"last_name"`
	Email           string  `json:"email"`
	Phone           *string `json:"phone"`
	Address         *string `json:"address"`
	City            *string `json:"city"`
	Country         *string `json:"country"`
	VATNumber       *string `json:"vat_number"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type LogoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type AuthTokensResponse struct {
	AccessToken      string `json:"access_token"`
	RefreshToken     string `json:"refresh_token"`
	TokenType        string `json:"token_type"`
	AccessExpiresIn  int64  `json:"access_expires_in"`
	RefreshExpiresIn int64  `json:"refresh_expires_in"`
}
