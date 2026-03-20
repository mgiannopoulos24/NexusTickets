package handler

import (
	"github.com/gofiber/fiber/v2"

	"nexustickets/internal/domain"
	"nexustickets/internal/middleware"
)

func RegisterBookingRoutes(app *fiber.App, bookingHandler *BookingHandler, jwtSecret string) {
	bookings := app.Group("/bookings")
	bookings.Use(middleware.JWTAuth(jwtSecret))

	bookings.Post("/", middleware.RequireRole(domain.UserRoleAttendee, domain.UserRoleOrganizer), bookingHandler.Create)
	bookings.Get("/me", middleware.RequireRole(domain.UserRoleAttendee, domain.UserRoleOrganizer), bookingHandler.GetMyBookings)
	bookings.Get("/organizer/events/:eventId", middleware.RequireRole(domain.UserRoleOrganizer), bookingHandler.GetEventBookings)
	bookings.Get("/:id", middleware.RequireRole(domain.UserRoleAttendee, domain.UserRoleOrganizer), bookingHandler.Get)
}
