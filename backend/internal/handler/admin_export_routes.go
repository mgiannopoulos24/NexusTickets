package handler

import (
	"github.com/gofiber/fiber/v2"

	"nexustickets/internal/domain"
	"nexustickets/internal/middleware"
)

func RegisterAdminExportRoutes(v1 fiber.Router, h *AdminExportHandler, jwtSecret string) {
	admin := v1.Group("/admin")
	admin.Use(middleware.JWTAuth(jwtSecret))
	admin.Use(middleware.RequireRole(domain.UserRoleAdmin))

	admin.Get("/events/export/xml", h.ExportXML)
	admin.Get("/events/export/json", h.ExportJSON)
}
