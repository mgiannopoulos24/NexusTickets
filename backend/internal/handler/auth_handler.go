package handler

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	"nexustickets/internal/dto"
	"nexustickets/internal/service"
	"nexustickets/pkg/response"
)

type AuthHandler struct {
	service *service.AuthService
}

func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{service: authService}
}

func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req dto.RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if err := validateRegisterRequest(req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	user, err := h.service.Register(c.Context(), service.RegisterInput{
		Username:        strings.TrimSpace(req.Username),
		Password:        req.Password,
		ConfirmPassword: req.ConfirmPassword,
		FirstName:       strings.TrimSpace(req.FirstName),
		LastName:        strings.TrimSpace(req.LastName),
		Email:           strings.TrimSpace(req.Email),
		Phone:           req.Phone,
		Address:         req.Address,
		City:            req.City,
		Country:         req.Country,
		VATNumber:       req.VATNumber,
	})
	if err != nil {
		return err
	}

	return response.Created(c, fiber.Map{
		"id":             user.ID,
		"username":       user.Username,
		"email":          user.Email,
		"account_status": user.AccountStatus,
	})
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req dto.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if strings.TrimSpace(req.Username) == "" || strings.TrimSpace(req.Password) == "" {
		return fiber.NewError(fiber.StatusBadRequest, "username and password are required")
	}

	tokens, err := h.service.Login(c.Context(), req.Username, req.Password)
	if err != nil {
		return err
	}

	return response.OK(c, dto.AuthTokensResponse{
		AccessToken:      tokens.AccessToken,
		RefreshToken:     tokens.RefreshToken,
		TokenType:        "Bearer",
		AccessExpiresIn:  tokens.AccessExpiresIn,
		RefreshExpiresIn: tokens.RefreshExpiresIn,
	})
}

func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	var req dto.RefreshTokenRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if strings.TrimSpace(req.RefreshToken) == "" {
		return fiber.NewError(fiber.StatusBadRequest, "refresh_token is required")
	}

	tokens, err := h.service.RefreshToken(c.Context(), req.RefreshToken)
	if err != nil {
		return err
	}

	return response.OK(c, dto.AuthTokensResponse{
		AccessToken:      tokens.AccessToken,
		RefreshToken:     tokens.RefreshToken,
		TokenType:        "Bearer",
		AccessExpiresIn:  tokens.AccessExpiresIn,
		RefreshExpiresIn: tokens.RefreshExpiresIn,
	})
}

func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	var req dto.LogoutRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if strings.TrimSpace(req.RefreshToken) == "" {
		return fiber.NewError(fiber.StatusBadRequest, "refresh_token is required")
	}

	if err := h.service.Logout(c.Context(), req.RefreshToken); err != nil {
		return err
	}
	return response.OK(c, fiber.Map{"message": "logged out"})
}

func validateRegisterRequest(req dto.RegisterRequest) error {
	if strings.TrimSpace(req.Username) == "" ||
		strings.TrimSpace(req.Password) == "" ||
		strings.TrimSpace(req.ConfirmPassword) == "" ||
		strings.TrimSpace(req.FirstName) == "" ||
		strings.TrimSpace(req.LastName) == "" ||
		strings.TrimSpace(req.Email) == "" {
		return fiber.NewError(fiber.StatusBadRequest, "missing required registration fields")
	}
	return nil
}
