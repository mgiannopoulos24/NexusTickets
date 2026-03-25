package handler

import (
	"github.com/gofiber/fiber/v2"

	"nexustickets/internal/repository"
	"nexustickets/pkg/response"
)

type CategoryHandler struct {
	repo repository.CategoryRepository
}

func NewCategoryHandler(repo repository.CategoryRepository) *CategoryHandler {
	return &CategoryHandler{repo: repo}
}

func (h *CategoryHandler) ListAll(c *fiber.Ctx) error {
	cats, err := h.repo.ListAll(c.Context())
	if err != nil {
		return err
	}
	out := make([]fiber.Map, 0, len(cats))
	for _, cat := range cats {
		out = append(out, fiber.Map{
			"id":   cat.ID.String(),
			"name": cat.Name,
		})
	}
	return response.OK(c, out)
}

