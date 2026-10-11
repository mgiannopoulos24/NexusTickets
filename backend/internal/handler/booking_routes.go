package handler

import (
	"github.com/gofiber/fiber/v2"

	"nexustickets/internal/domain"
	"nexustickets/internal/middleware"
)

func RegisterBookingRoutes(router fiber.Router, bookingHandler *BookingHandler, jwtSecret string) {
	bookings := router.Group("/bookings")
	bookings.Use(middleware.JWTAuth(jwtSecret))

	bookings.Post("/", middleware.RequireRole(domain.UserRoleAttendee, domain.UserRoleOrganizer, domain.UserRoleAdmin), bookingHandler.Create)
	bookings.Get("/me", middleware.RequireRole(domain.UserRoleAttendee, domain.UserRoleOrganizer, domain.UserRoleAdmin), bookingHandler.GetMyBookings)
	bookings.Get("/organizer/events/:eventId", middleware.RequireRole(domain.UserRoleOrganizer, domain.UserRoleAdmin), bookingHandler.GetEventBookings)
	bookings.Patch("/:id/confirm", middleware.RequireRole(domain.UserRoleAttendee, domain.UserRoleOrganizer, domain.UserRoleAdmin), bookingHandler.Confirm)
	bookings.Patch("/:id/cancel", middleware.RequireRole(domain.UserRoleAttendee, domain.UserRoleOrganizer, domain.UserRoleAdmin), bookingHandler.Cancel)
	bookings.Get("/:id", middleware.RequireRole(domain.UserRoleAttendee, domain.UserRoleOrganizer, domain.UserRoleAdmin), bookingHandler.Get)
}
