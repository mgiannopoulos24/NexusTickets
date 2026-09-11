package handler

import (
	"context"
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

// MessageHandler serves the mailbox of assignment §10.
type MessageHandler struct {
	service *service.MessagingService
	hub     *wshub.Hub
}

func NewMessageHandler(messaging *service.MessagingService, hub *wshub.Hub) *MessageHandler {
	return &MessageHandler{service: messaging, hub: hub}
}

// Inbox lists received messages, newest first. Listing does not mark anything
// read; opening a message (Get) does.
func (h *MessageHandler) Inbox(c *fiber.Ctx) error {
	return h.folder(c, h.service.GetInbox)
}

// Sent lists messages the user wrote, newest first.
func (h *MessageHandler) Sent(c *fiber.Ctx) error {
	return h.folder(c, h.service.GetSent)
}

type folderLister func(ctx context.Context, userID uuid.UUID, limit, offset int) (service.Mailbox, error)

func (h *MessageHandler) folder(c *fiber.Ctx, list folderLister) error {
	userID, err := authUserID(c)
	if err != nil {
		return err
	}
	limit, offset, err := parsePage(c.Query("limit"), c.Query("offset"))
	if err != nil {
		return err
	}
	box, err := list(c.Context(), userID, limit, offset)
	if err != nil {
		return err
	}
	out, err := h.hydrateMessages(c, box.Messages)
	if err != nil {
		return err
	}
	return response.Paginated(c, out, dto.MailboxMeta{Total: box.Total, Limit: limit, Offset: offset})
}

// Get opens one message. For the recipient this marks it read.
func (h *MessageHandler) Get(c *fiber.Ctx) error {
	userID, err := authUserID(c)
	if err != nil {
		return err
	}
	messageID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid message id")
	}
	msg, err := h.service.GetMessage(c.Context(), messageID, userID)
	if err != nil {
		return err
	}
	out, err := h.hydrateMessages(c, []domain.Message{msg})
	if err != nil {
		return err
	}
	return response.OK(c, out[0])
}

// Recipients lists the users the caller may currently message: everyone they
// share a booking with (assignment §10).
func (h *MessageHandler) Recipients(c *fiber.Ctx) error {
	userID, err := authUserID(c)
	if err != nil {
		return err
	}
	people, err := h.service.ListRecipients(c.Context(), userID)
	if err != nil {
		return err
	}
	out := make([]dto.RecipientResponse, 0, len(people))
	for _, u := range people {
		out = append(out, dto.RecipientResponse{
			ID:       u.ID.String(),
			Username: u.Username,
			FullName: strings.TrimSpace(u.FirstName + " " + u.LastName),
			Role:     string(u.Role),
		})
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
	var eventID *uuid.UUID
	if raw := strings.TrimSpace(req.EventID); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid event_id")
		}
		eventID = &parsed
	}

	created, err := h.service.SendMessage(c.Context(), service.SendMessageInput{
		SenderID:    senderID,
		RecipientID: recipientID,
		EventID:     eventID,
		Subject:     req.Subject,
		Body:        req.Body,
	})
	if err != nil {
		return mapMessageError(err)
	}
	out, err := h.hydrateMessages(c, []domain.Message{created})
	if err != nil {
		return err
	}
	return response.Created(c, out[0])
}

// NotifyAttendees sends an organizer's notice to everyone who booked the event.
func (h *MessageHandler) NotifyAttendees(c *fiber.Ctx) error {
	organizerID, err := authUserID(c)
	if err != nil {
		return err
	}
	eventID, err := uuid.Parse(c.Params("eventId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid event id")
	}
	var req dto.NotifyAttendeesRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	n, err := h.service.NotifyEventAttendees(c.Context(), organizerID, eventID, req.Subject, req.Body)
	if err != nil {
		return mapMessageError(err)
	}
	return response.OK(c, dto.NotifyAttendeesResponse{Recipients: n})
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

// ServeWebSocket keeps a push channel open for the user: new messages and the
// unread total arrive here (assignment §10, "new message" indication).
func (h *MessageHandler) ServeWebSocket(c *fiberws.Conn) {
	raw, ok := c.Locals("user_id").(string)
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

// mapMessageError turns the service's validation errors into 400s; everything
// else falls through to the global error handler.
func mapMessageError(err error) error {
	switch {
	case errors.Is(err, service.ErrMessageSubjectBodyRequired),
		errors.Is(err, service.ErrMessageTooLong),
		errors.Is(err, service.ErrMessageSelfRecipient),
		errors.Is(err, service.ErrMessageNoRecipients):
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	default:
		return err
	}
}

// hydrateMessages attaches sender/recipient identities and event titles in
// batch lookups rather than one query per message.
func (h *MessageHandler) hydrateMessages(c *fiber.Ctx, msgs []domain.Message) ([]dto.MessageResponse, error) {
	out := make([]dto.MessageResponse, 0, len(msgs))
	if len(msgs) == 0 {
		return out, nil
	}

	userIDs := make([]uuid.UUID, 0, len(msgs)*2)
	eventIDs := make([]uuid.UUID, 0, len(msgs))
	for _, m := range msgs {
		userIDs = append(userIDs, m.SenderID, m.RecipientID)
		if m.EventID != nil {
			eventIDs = append(eventIDs, *m.EventID)
		}
	}
	people, err := h.service.LookupUsers(c.Context(), userIDs)
	if err != nil {
		return nil, err
	}
	events, err := h.service.LookupEvents(c.Context(), eventIDs)
	if err != nil {
		return nil, err
	}

	for _, m := range msgs {
		resp := toMessageResponse(m)
		if u, ok := people[m.SenderID]; ok {
			resp.Sender = toMessageParticipant(u)
		}
		if u, ok := people[m.RecipientID]; ok {
			resp.Recipient = toMessageParticipant(u)
		}
		if m.EventID != nil {
			if ev, ok := events[*m.EventID]; ok {
				resp.Event = &dto.MessageEventRef{ID: ev.ID.String(), Title: ev.Title}
			}
		}
		out = append(out, resp)
	}
	return out, nil
}

func toMessageParticipant(u domain.User) *dto.MessageParticipant {
	return &dto.MessageParticipant{
		ID:       u.ID.String(),
		Username: u.Username,
		FullName: strings.TrimSpace(u.FirstName + " " + u.LastName),
		Role:     string(u.Role),
	}
}

func toMessageResponse(m domain.Message) dto.MessageResponse {
	var readAt *string
	if m.ReadAt != nil {
		formatted := m.ReadAt.UTC().Format(time.RFC3339)
		readAt = &formatted
	}
	var eventID *string
	if m.EventID != nil {
		id := m.EventID.String()
		eventID = &id
	}
	return dto.MessageResponse{
		ID:          m.ID.String(),
		SenderID:    m.SenderID.String(),
		RecipientID: m.RecipientID.String(),
		EventID:     eventID,
		Subject:     m.Subject,
		Body:        m.Body,
		ReadAt:      readAt,
		CreatedAt:   m.CreatedAt.UTC().Format(time.RFC3339),
	}
}
