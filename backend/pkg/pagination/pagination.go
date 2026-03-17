package pagination

import (
	"fmt"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

type Params struct {
	Page  int
	Limit int
}

type Meta struct {
	Page       int `json:"page"`
	Limit      int `json:"limit"`
	TotalItems int `json:"totalItems"`
	TotalPages int `json:"totalPages"`
}

func FromQuery(c *fiber.Ctx, defaultLimit, maxLimit int) (Params, error) {
	page := 1
	limit := defaultLimit

	if raw := c.Query("page"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 {
			return Params{}, fmt.Errorf("invalid page")
		}
		page = n
	}

	if raw := c.Query("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 {
			return Params{}, fmt.Errorf("invalid limit")
		}
		if n > maxLimit {
			n = maxLimit
		}
		limit = n
	}

	return Params{Page: page, Limit: limit}, nil
}

func BuildMeta(p Params, totalItems int) Meta {
	totalPages := 0
	if totalItems > 0 && p.Limit > 0 {
		totalPages = (totalItems + p.Limit - 1) / p.Limit
	}
	return Meta{
		Page:       p.Page,
		Limit:      p.Limit,
		TotalItems: totalItems,
		TotalPages: totalPages,
	}
}

