package handler

import (
	"github.com/gofiber/fiber/v2"

	"nexustickets/internal/domain"
	"nexustickets/internal/middleware"
)

func RegisterSupportRoutes(v1 fiber.Router, h *SupportHandler, jwtSecret string) {
	support := v1.Group("/support")
	support.Use(middleware.JWTAuth(jwtSecret))
	support.Use(middleware.RequireRole(domain.UserRoleAttendee, domain.UserRoleOrganizer, domain.UserRoleAdmin))

	admin := support.Group("/admin", middleware.RequireRole(domain.UserRoleAdmin))
	admin.Get("/tickets", h.AdminList)
	admin.Get("/counts", h.AdminCounts)

	support.Post("/tickets", h.Open)
	support.Get("/tickets/me", h.ListMine)
	support.Get("/tickets/:id", h.Get)
	support.Post("/tickets/:id/messages", h.Reply)
	support.Patch("/tickets/:id/close", h.Close)
}
