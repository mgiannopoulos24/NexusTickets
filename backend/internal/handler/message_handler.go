package handler

import (
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	fiberws "github.com/gofiber/websocket/v2"
	"github.com/google/uuid"

	"nexustickets/internal/domain"
	"nexustickets/internal/dto"
	wshub "nexustickets/internal/handler/ws"
	"nexustickets/internal/service"
	"nexustickets/pkg/response"
)

type MessageHandler struct {
	service *service.MessagingService
	hub     *wshub.Hub
}

func NewMessageHandler(messaging *service.MessagingService, hub *wshub.Hub) *MessageHandler {
	return &MessageHandler{service: messaging, hub: hub}
}

func (h *MessageHandler) Inbox(c *fiber.Ctx) error {
	userID, err := authUserID(c)
	if err != nil {
		return err
	}
	limit, offset, err := parsePage(c.Query("limit"), c.Query("offset"))
	if err != nil {
		return err
	}
	msgs, err := h.service.GetInbox(c.Context(), userID, limit, offset)
	if err != nil {
		return err
	}
	out := make([]dto.MessageResponse, 0, len(msgs))
	for _, m := range msgs {
		out = append(out, toMessageResponse(m))
	}
	return response.OK(c, out)
}

func (h *MessageHandler) Sent(c *fiber.Ctx) error {
	userID, err := authUserID(c)
	if err != nil {
		return err
	}
	limit, offset, err := parsePage(c.Query("limit"), c.Query("offset"))
	if err != nil {
		return err
	}
	msgs, err := h.service.GetSent(c.Context(), userID, limit, offset)
	if err != nil {
		return err
	}
	out := make([]dto.MessageResponse, 0, len(msgs))
	for _, m := range msgs {
		out = append(out, toMessageResponse(m))
	}
	return response.OK(c, out)
}

func (h *MessageHandler) UnreadCount(c *fiber.Ctx) error {
	userID, err := authUserID(c)
	if err != nil {
		return err
	}
	n, err := h.service.GetUnreadCount(c.Context(), userID)
	if err != nil {
		return err
	}
	return response.OK(c, dto.UnreadCountResponse{Count: n})
}

func (h *MessageHandler) Send(c *fiber.Ctx) error {
	senderID, err := authUserID(c)
	if err != nil {
		return err
	}
	var req dto.SendMessageRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	recipientID, err := uuid.Parse(strings.TrimSpace(req.RecipientID))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid recipient_id")
	}
	created, err := h.service.SendMessage(c.Context(), service.SendMessageInput{
		SenderID:    senderID,
		RecipientID: recipientID,
		Subject:     req.Subject,
		Body:        req.Body,
	})
	if err != nil {
		if errors.Is(err, service.ErrMessageSubjectBodyRequired) || errors.Is(err, service.ErrMessageSelfRecipient) {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		if err == domain.ErrNotFound {
			return err
		}
		return err
	}
	return response.Created(c, toMessageResponse(created))
}

func (h *MessageHandler) Delete(c *fiber.Ctx) error {
	userID, err := authUserID(c)
	if err != nil {
		return err
	}
	messageID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid message id")
	}
	if err := h.service.DeleteForUser(c.Context(), messageID, userID); err != nil {
		return err
	}
	return response.OK(c, fiber.Map{"deleted": true})
}

func (h *MessageHandler) ServeWebSocket(c *fiberws.Conn) {
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

	client := wshub.NewClient(h.hub, c, userID)
	h.hub.Register(client)
	go client.WritePump()
	client.ReadPump()
}

func toMessageResponse(m domain.Message) dto.MessageResponse {
	var readAt *string
	if m.ReadAt != nil {
		formatted := m.ReadAt.UTC().Format(time.RFC3339)
		readAt = &formatted
	}
	return dto.MessageResponse{
		ID:          m.ID.String(),
		SenderID:    m.SenderID.String(),
		RecipientID: m.RecipientID.String(),
		Subject:     m.Subject,
		Body:        m.Body,
		ReadAt:      readAt,
		CreatedAt:   m.CreatedAt.UTC().Format(time.RFC3339),
	}
}
