package handler

import (
	"context"
	"encoding/json"
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
	out, err := h.hydrateMessages(c, msgs)
	if err != nil {
		return err
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
	out, err := h.hydrateMessages(c, msgs)
	if err != nil {
		return err
	}
	return response.OK(c, out)
}

// Recipients lists the users the caller may currently message: everyone they
// share a booking with, plus support (assignment §10).
// Conversations lists the user's threads for the messenger sidebar. Unlike
// Inbox it does not mark anything read — that happens when a thread is opened.
func (h *MessageHandler) Conversations(c *fiber.Ctx) error {
	userID, err := authUserID(c)
	if err != nil {
		return err
	}

	convos, err := h.service.ListConversations(c.Context(), userID)
	if err != nil {
		return err
	}

	out := make([]dto.MailboxConversationResponse, 0, len(convos))
	for _, cv := range convos {
		hydrated, err := h.hydrateMessages(c, []domain.Message{cv.LastMessage})
		if err != nil {
			return err
		}
		out = append(out, dto.MailboxConversationResponse{
			User:        *toMessageParticipant(cv.User),
			Support:     cv.Support,
			LastMessage: hydrated[0],
			UnreadCount: cv.UnreadCount,
		})
	}
	return response.OK(c, out)
}

// Thread returns the whole exchange with one person, oldest first.
func (h *MessageHandler) Thread(c *fiber.Ctx) error {
	userID, err := authUserID(c)
	if err != nil {
		return err
	}
	otherID, err := uuid.Parse(c.Params("userId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid user id")
	}
	limit, offset, err := parsePage(c.Query("limit"), c.Query("offset"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	msgs, err := h.service.GetThread(c.Context(), userID, otherID, limit, offset)
	if err != nil {
		if errors.Is(err, service.ErrMessageSelfRecipient) {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		return err
	}
	msgs, err = h.service.HydrateThread(c.Context(), msgs)
	if err != nil {
		return err
	}
	out, err := h.hydrateMessages(c, msgs)
	if err != nil {
		return err
	}
	// Reactions are summarised from the reader's point of view.
	for i := range out {
		out[i].Reactions = summariseReactions(msgs[i].Reactions, userID)
	}
	return response.OK(c, out)
}

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
	for _, p := range people {
		out = append(out, dto.RecipientResponse{
			ID:       p.User.ID.String(),
			Username: p.User.Username,
			FullName: strings.TrimSpace(p.User.FirstName + " " + p.User.LastName),
			Role:     string(p.User.Role),
			Support:  p.Support,
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
	var replyToID *uuid.UUID
	if raw := strings.TrimSpace(req.ReplyToID); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid reply_to_id")
		}
		replyToID = &parsed
	}
	created, err := h.service.SendMessage(c.Context(), service.SendMessageInput{
		SenderID:    senderID,
		RecipientID: recipientID,
		Subject:     req.Subject,
		Body:        req.Body,
		ImageURL:    req.ImageURL,
		FileURL:     req.FileURL,
		FileName:    req.FileName,
		GifURL:      req.GifURL,
		ReplyToID:   replyToID,
	})
	if err != nil {
		if errors.Is(err, service.ErrMessageSubjectBodyRequired) ||
			errors.Is(err, service.ErrMessageSelfRecipient) ||
			errors.Is(err, service.ErrMessageAttachmentNameRequired) {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		if err == domain.ErrNotFound {
			return err
		}
		return err
	}
	out, err := h.hydrateMessages(c, []domain.Message{created})
	if err != nil {
		return err
	}
	return response.Created(c, out[0])
}

// React toggles one emoji on a message for the current user.
func (h *MessageHandler) React(c *fiber.Ctx) error {
	userID, err := authUserID(c)
	if err != nil {
		return err
	}
	messageID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid message id")
	}
	var req dto.ReactToMessageRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	if err := h.service.ToggleReaction(c.Context(), messageID, userID, req.Emoji); err != nil {
		if errors.Is(err, service.ErrInvalidReaction) || errors.Is(err, service.ErrMessageDeleted) {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		return err
	}
	return response.OK(c, fiber.Map{"ok": true})
}

// summariseReactions collapses individual reactions into one row per emoji.
func summariseReactions(reactions []domain.MailboxReaction, viewerID uuid.UUID) []dto.ReactionSummary {
	if len(reactions) == 0 {
		return nil
	}
	order := make([]string, 0, len(reactions))
	byEmoji := make(map[string]*dto.ReactionSummary, len(reactions))
	for _, r := range reactions {
		summary, ok := byEmoji[r.Emoji]
		if !ok {
			summary = &dto.ReactionSummary{Emoji: r.Emoji}
			byEmoji[r.Emoji] = summary
			order = append(order, r.Emoji)
		}
		summary.Count++
		if r.UserID == viewerID {
			summary.Mine = true
		}
	}
	out := make([]dto.ReactionSummary, 0, len(order))
	for _, emoji := range order {
		out = append(out, *byEmoji[emoji])
	}
	return out
}

// UploadAttachment stores a picture or file and returns the URL to attach to a
// message. Uploading is separate from sending so the composer can show a
// preview before the message goes out.
func (h *MessageHandler) UploadAttachment(c *fiber.Ctx) error {
	senderID, err := authUserID(c)
	if err != nil {
		return err
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "file is required")
	}
	if fileHeader.Size <= 0 {
		return fiber.NewError(fiber.StatusBadRequest, "empty file")
	}

	file, err := fileHeader.Open()
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "unable to open uploaded file")
	}
	defer func() { _ = file.Close() }()

	stored, err := h.service.StoreAttachment(senderID, fileHeader.Filename, fileHeader.Size, file)
	if err != nil {
		if errors.Is(err, service.ErrAttachmentTooLarge) {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		return err
	}

	return response.Created(c, dto.AttachmentResponse{
		URL:  stored.URL,
		Name: stored.Name,
		Kind: stored.Kind,
		Size: stored.Size,
	})
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
	// The only thing a client may push is a typing hint.
	client.OnInbound(func(senderID uuid.UUID, frame []byte) {
		var in struct {
			Type    string `json:"type"`
			Payload struct {
				RecipientID string `json:"recipient_id"`
			} `json:"payload"`
		}
		if err := json.Unmarshal(frame, &in); err != nil || in.Type != wshub.TypeTyping {
			return
		}
		recipientID, err := uuid.Parse(strings.TrimSpace(in.Payload.RecipientID))
		if err != nil {
			return
		}
		h.service.RelayTyping(context.Background(), senderID, recipientID)
	})
	h.hub.Register(client)
	go client.WritePump()
	client.ReadPump()
}

// hydrateMessages attaches sender/recipient display identities in one batch
// lookup rather than one query per message.
func (h *MessageHandler) hydrateMessages(c *fiber.Ctx, msgs []domain.Message) ([]dto.MessageResponse, error) {
	out := make([]dto.MessageResponse, 0, len(msgs))
	if len(msgs) == 0 {
		return out, nil
	}

	ids := make([]uuid.UUID, 0, len(msgs)*2)
	for _, m := range msgs {
		ids = append(ids, m.SenderID, m.RecipientID)
	}
	people, err := h.service.LookupUsers(c.Context(), ids)
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
	return dto.MessageResponse{
		ID:          m.ID.String(),
		SenderID:    m.SenderID.String(),
		RecipientID: m.RecipientID.String(),
		Subject:     m.Subject,
		Body:        m.Body,
		ReadAt:      readAt,
		CreatedAt:   m.CreatedAt.UTC().Format(time.RFC3339),
		ImageURL:    m.ImageURL,
		FileURL:     m.FileURL,
		FileName:    m.FileName,
		GifURL:      m.GifURL,
		Deleted:     m.DeletedForEveryone,
		ReplyTo:     toMessageQuote(m.ReplyTo),
	}
}

func toMessageQuote(p *domain.MessagePreview) *dto.MessageQuote {
	if p == nil {
		return nil
	}
	return &dto.MessageQuote{
		ID:       p.ID,
		SenderID: p.SenderID.String(),
		Body:     p.Body,
		Deleted:  p.Deleted,
	}
}
