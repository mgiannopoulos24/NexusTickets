package handler

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	fiberws "github.com/gofiber/websocket/v2"
	"github.com/google/uuid"

	"nexustickets/internal/handler/ws"
	"nexustickets/internal/middleware"
)

func RegisterChatWebSocketRoutes(app *fiber.App, hub *ws.Hub, jwtSecret string) {
	app.Get("/api/v1/ws/chat", middleware.WebSocketJWTAuth(jwtSecret), middleware.RequireRole("attendee", "organizer", "admin"), fiberws.New(func(c *fiberws.Conn) {
		userIDStr := c.Locals("user_id")
		raw, ok := userIDStr.(string)
		if !ok || strings.TrimSpace(raw) == "" {
			_ = c.Close()
			return
		}
		userID, err := uuid.Parse(raw)
		if err != nil {
			_ = c.Close()
			return
		}

		client := ws.NewClient(hub, c, userID)
		hub.Register(client)
		go client.WritePump()
		client.ReadPump()
	}))
}
