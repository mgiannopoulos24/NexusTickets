package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"nexustickets/internal/domain"
	"nexustickets/internal/dto"
	"nexustickets/internal/service"
	"nexustickets/pkg/response"
)

type UserHandler struct {
	service *service.UserService
}

func NewUserHandler(userService *service.UserService) *UserHandler {
	return &UserHandler{service: userService}
}

func (h *UserHandler) AdminListUsers(c *fiber.Ctx) error {
	limit, offset, err := parsePage(c.Query("limit"), c.Query("offset"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	users, err := h.service.ListUsers(c.Context(), limit, offset)
	if err != nil {
		return err
	}

	out := make([]dto.UserResponse, 0, len(users))
	for _, user := range users {
		out = append(out, toUserResponse(user))
	}
	return response.OK(c, out)
}

func (h *UserHandler) AdminGetUser(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid user id")
	}
	user, err := h.service.GetUser(c.Context(), id)
	if err != nil {
		return err
	}
	return response.OK(c, toUserResponse(user))
}

func (h *UserHandler) AdminApproveUser(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid user id")
	}
	user, err := h.service.ApproveUser(c.Context(), id)
	if err != nil {
		return err
	}
	return response.OK(c, toUserResponse(user))
}

func (h *UserHandler) AdminRejectUser(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid user id")
	}
	user, err := h.service.RejectUser(c.Context(), id)
	if err != nil {
		return err
	}
	return response.OK(c, toUserResponse(user))
}

func (h *UserHandler) Me(c *fiber.Ctx) error {
	userID, err := authUserID(c)
	if err != nil {
		return err
	}
	user, err := h.service.GetUser(c.Context(), userID)
	if err != nil {
		return err
	}
	return response.OK(c, toUserResponse(user))
}

func (h *UserHandler) UpdateMe(c *fiber.Ctx) error {
	userID, err := authUserID(c)
	if err != nil {
		return err
	}

	var req dto.UpdateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	user, err := h.service.UpdateProfile(c.Context(), userID, service.UpdateProfileInput{
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Email:     req.Email,
		Phone:     req.Phone,
		Address:   req.Address,
		City:      req.City,
		Country:   req.Country,
		Latitude:  req.Latitude,
		Longitude: req.Longitude,
		VATNumber: req.VATNumber,
	})
	if err != nil {
		return err
	}
	return response.OK(c, toUserResponse(user))
}

func toUserResponse(user domain.User) dto.UserResponse {
	return dto.UserResponse{
		ID:            user.ID.String(),
		Username:      user.Username,
		FirstName:     user.FirstName,
		LastName:      user.LastName,
		Email:         user.Email,
		Phone:         user.Phone,
		Address:       user.Address,
		City:          user.City,
		Country:       user.Country,
		Latitude:      user.Latitude,
		Longitude:     user.Longitude,
		VATNumber:     user.VATNumber,
		Role:          string(user.Role),
		AccountStatus: string(user.AccountStatus),
		CreatedAt:     user.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		UpdatedAt:     user.UpdatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
}

func authUserID(c *fiber.Ctx) (uuid.UUID, error) {
	raw, ok := c.Locals("user_id").(string)
	if !ok {
		return uuid.Nil, fiber.NewError(fiber.StatusUnauthorized, "missing auth context")
	}
	userID, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, fiber.NewError(fiber.StatusUnauthorized, "invalid auth subject")
	}
	return userID, nil
}

func parsePage(rawLimit, rawOffset string) (int, int, error) {
	limit := 20
	offset := 0
	var err error
	if rawLimit != "" {
		limit, err = strconv.Atoi(rawLimit)
		if err != nil || limit < 1 {
			return 0, 0, fiber.NewError(fiber.StatusBadRequest, "limit must be a positive integer")
		}
	}
	if rawOffset != "" {
		offset, err = strconv.Atoi(rawOffset)
		if err != nil || offset < 0 {
			return 0, 0, fiber.NewError(fiber.StatusBadRequest, "offset must be a non-negative integer")
		}
	}
	return limit, offset, nil
}
