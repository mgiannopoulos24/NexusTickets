package handler

import (
	"github.com/gofiber/fiber/v2"
)

func RegisterRecommendationRoutes(router fiber.Router, handler *RecommendationHandler) {
	recs := router.Group("/recommendations")

	recs.Get("/", handler.GetPersonalized)
	recs.Get("/popular", handler.GetPopular)
	recs.Get("/status", handler.GetStatus)
}
