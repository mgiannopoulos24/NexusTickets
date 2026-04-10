package handler

import (
	"github.com/gofiber/fiber/v2"

	"nexustickets/internal/domain"
	"nexustickets/internal/middleware"
)

func RegisterChatRoutes(router fiber.Router, chatHandler *ChatHandler, jwtSecret string) {
	chat := router.Group("/chat")

	chat.Use(middleware.JWTAuth(jwtSecret))
	chat.Use(middleware.RequireRole(domain.UserRoleAttendee, domain.UserRoleOrganizer, domain.UserRoleAdmin))

	chat.Get("/conversations", chatHandler.GetConversations)
	chat.Post("/rooms", chatHandler.GetOrCreateRoom)
	chat.Get("/rooms/:roomId/messages", chatHandler.GetMessages)
	chat.Post("/rooms/:roomId/messages", chatHandler.SendMessage)
	chat.Post("/messages/:messageId/reactions", chatHandler.ReactToMessage)
	chat.Delete("/messages/:messageId/reactions", chatHandler.RemoveReaction)
}
