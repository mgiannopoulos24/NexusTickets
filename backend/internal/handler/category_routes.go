package handler

import "github.com/gofiber/fiber/v2"

func RegisterCategoryRoutes(router fiber.Router, categoryHandler *CategoryHandler) {
	categories := router.Group("/categories")
	categories.Get("/", categoryHandler.ListAll)
}

