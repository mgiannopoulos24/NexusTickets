package handler

import (
	"github.com/gofiber/fiber/v2"

	"nexustickets/internal/domain"
	"nexustickets/internal/middleware"
)

func RegisterEventRoutes(router fiber.Router, eventHandler *EventHandler, jwtSecret string) {
	events := router.Group("/events")

	events.Get("/", eventHandler.List)
	events.Get("/search", eventHandler.Search)
	events.Get("/:id", middleware.OptionalJWTAuth(jwtSecret), eventHandler.Get)

	organizer := events.Group("/organizer")
	organizer.Use(middleware.JWTAuth(jwtSecret))
	organizer.Use(middleware.RequireRole(domain.UserRoleOrganizer))
	organizer.Get("/me", eventHandler.GetOrganizerEvents)
	organizer.Post("/", eventHandler.Create)
	organizer.Patch("/:id", eventHandler.Update)
	organizer.Delete("/:id", eventHandler.Delete)
	organizer.Patch("/:id/publish", eventHandler.Publish)
	organizer.Patch("/:id/cancel", eventHandler.Cancel)
	organizer.Post("/:id/ticket-types", eventHandler.AddTicketType)
	organizer.Patch("/:id/ticket-types/:ticketTypeId", eventHandler.UpdateTicketType)
	organizer.Delete("/:id/ticket-types/:ticketTypeId", eventHandler.DeleteTicketType)
	organizer.Post("/:id/photos", eventHandler.UploadPhoto)
	organizer.Delete("/:id/photos/:photoId", eventHandler.DeletePhoto)
}
