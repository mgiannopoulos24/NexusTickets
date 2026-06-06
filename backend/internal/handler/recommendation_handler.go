package handler

import (
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"

	"nexustickets/internal/service"
	"nexustickets/pkg/response"
)

type RecommendationHandler struct {
	service *service.RecommendationService
}

func NewRecommendationHandler(svc *service.RecommendationService) *RecommendationHandler {
	return &RecommendationHandler{service: svc}
}

func (h *RecommendationHandler) GetPersonalized(c *fiber.Ctx) error {
	userIDStr := strings.TrimSpace(c.Query("user_id"))
	if userIDStr == "" {
		return fiber.NewError(fiber.StatusBadRequest, "user_id query parameter is required")
	}
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid user_id")
	}
	limit := parseRecommendationLimit(c.Query("limit"))
	recs := h.service.GetForUser(userID, limit)
	return response.OK(c, recs)
}

func (h *RecommendationHandler) GetPopular(c *fiber.Ctx) error {
	limit := parseRecommendationLimit(c.Query("limit"))
	recs := h.service.GetPopular(limit)
	return response.OK(c, recs)
}

func (h *RecommendationHandler) GetStatus(c *fiber.Ctx) error {
	status := h.service.GetStatus()
	return response.OK(c, status)
}

func parseRecommendationLimit(raw string) int {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 20
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return 20
	}
	if n > 100 {
		return 100
	}
	return n
}
