package handler

import (
	"github.com/gofiber/fiber/v2"
	fiberws "github.com/gofiber/websocket/v2"

	"nexustickets/internal/domain"
	"nexustickets/internal/middleware"
)

func RegisterMessageRoutes(v1 fiber.Router, messageHandler *MessageHandler, jwtSecret string) {
	messages := v1.Group("/messages")
	messages.Use(middleware.JWTAuth(jwtSecret))
	messages.Use(middleware.RequireRole(domain.UserRoleOrganizer, domain.UserRoleAttendee, domain.UserRoleAdmin))

	messages.Get("/inbox", messageHandler.Inbox)
	messages.Get("/sent", messageHandler.Sent)
	messages.Get("/unread-count", messageHandler.UnreadCount)
	messages.Post("/", messageHandler.Send)
	messages.Delete("/:id", messageHandler.Delete)

	v1.Get("/ws/messages", middleware.WebSocketJWTAuth(jwtSecret), middleware.RequireRole(domain.UserRoleOrganizer, domain.UserRoleAttendee, domain.UserRoleAdmin), fiberws.New(messageHandler.ServeWebSocket))
}
