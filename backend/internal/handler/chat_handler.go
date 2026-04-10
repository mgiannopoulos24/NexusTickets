package handler

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"nexustickets/internal/domain"
	"nexustickets/internal/dto"
	"nexustickets/internal/service"
	"nexustickets/pkg/response"
)

type ChatHandler struct {
	service *service.ChatService
}

func NewChatHandler(chatService *service.ChatService) *ChatHandler {
	return &ChatHandler{service: chatService}
}

func (h *ChatHandler) GetConversations(c *fiber.Ctx) error {
	userID, err := uuid.Parse(c.Locals("user_id").(string))
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid user")
	}

	convos, err := h.service.ListUserRooms(c.Context(), userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	res := make([]dto.ConversationResponse, len(convos))
	for i, cnv := range convos {
		res[i] = dto.ConversationResponse{
			ID:          cnv.ID,
			UnreadCount: cnv.UnreadCount,
			IsOnline:    cnv.IsOnline,
		}
		if cnv.OtherUser != nil {
			res[i].OtherUser = &dto.UserResponseChat{
				ID:        cnv.OtherUser.ID,
				Username:  cnv.OtherUser.Username,
				FirstName: cnv.OtherUser.FirstName,
				LastName:  cnv.OtherUser.LastName,
				PhotoURL:  cnv.OtherUser.PhotoURL,
			}
		}
		if cnv.LastMessage != nil {
			m := cnv.LastMessage
			res[i].LastMessage = &dto.ChatMessageResponse{
				ID:        m.ID,
				RoomID:    m.RoomID,
				SenderID:  m.SenderID,
				Content:   m.Content,
				ImageURL:  m.ImageURL,
				FileURL:   m.FileURL,
				FileName:  m.FileName,
				GifURL:    m.GifURL,
				CreatedAt: m.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			}
			if m.Sender != nil {
				res[i].LastMessage.Sender = &dto.UserResponseChat{
					ID:        m.Sender.ID,
					Username:  m.Sender.Username,
					FirstName: m.Sender.FirstName,
					LastName:  m.Sender.LastName,
					PhotoURL:  m.Sender.PhotoURL,
				}
			}
		}
	}

	return response.OK(c, res)
}

func (h *ChatHandler) GetOrCreateRoom(c *fiber.Ctx) error {
	currentUserID, err := uuid.Parse(c.Locals("user_id").(string))
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid user")
	}

	var req dto.CreateChatRoomRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request")
	}

	var room domain.ChatRoom
	if req.UserID != nil {
		room, err = h.service.CreateOrGetDirectRoom(c.Context(), currentUserID, *req.UserID)
	} else if req.EventID != nil {
		room, err = h.service.GetRoomByEvent(c.Context(), *req.EventID)
	} else {
		return fiber.NewError(fiber.StatusBadRequest, "user_id or event_id required")
	}
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	return response.OK(c, dto.ChatRoomResponse{
		ID:         room.ID,
		IsGroup:    room.IsGroup,
		Name:       room.Name,
		EventID:    room.EventID,
		IsReadOnly: room.IsReadOnly,
	})
}

func (h *ChatHandler) GetMessages(c *fiber.Ctx) error {
	roomID, err := uuid.Parse(c.Params("roomId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid room id")
	}

	messages, err := h.service.GetMessages(c.Context(), roomID, 50, 0)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	res := make([]dto.ChatMessageResponse, len(messages))
	for i, m := range messages {
		res[i] = h.msgToResp(m)
	}

	return response.OK(c, res)
}

func (h *ChatHandler) SendMessage(c *fiber.Ctx) error {
	roomID, err := uuid.Parse(c.Params("roomId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid room id")
	}

	senderID, err := uuid.Parse(c.Locals("user_id").(string))
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid user")
	}

	var req dto.ChatMessageRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request")
	}

	msg, err := h.service.SendMessage(c.Context(), roomID, senderID, req.Content, req.ImageURL, req.FileURL, req.FileName, req.GifURL)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	return response.Created(c, h.msgToResp(msg))
}

func (h *ChatHandler) ReactToMessage(c *fiber.Ctx) error {
	msgID, err := uuid.Parse(c.Params("messageId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid message id")
	}

	userID, err := uuid.Parse(c.Locals("user_id").(string))
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid user")
	}

	var req dto.ReactRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request")
	}

	reactionType := strings.TrimSpace(req.ReactionType)
	if reactionType == "" {
		return fiber.NewError(fiber.StatusBadRequest, "reaction_type required")
	}

	rxn, err := h.service.AddReaction(c.Context(), msgID, userID, reactionType)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	return response.Created(c, dto.MessageReactionResponse{
		ID:           rxn.ID,
		UserID:       rxn.UserID,
		ReactionType: rxn.ReactionType,
	})
}

func (h *ChatHandler) RemoveReaction(c *fiber.Ctx) error {
	msgID, err := uuid.Parse(c.Params("messageId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid message id")
	}

	userID, err := uuid.Parse(c.Locals("user_id").(string))
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid user")
	}

	reactionType := c.Query("type")
	if reactionType == "" {
		return fiber.NewError(fiber.StatusBadRequest, "query param 'type' required")
	}

	if err := h.service.RemoveReaction(c.Context(), msgID, userID, reactionType); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	return response.OK(c, fiber.Map{"removed": true})
}

func (h *ChatHandler) msgToResp(m domain.ChatMessage) dto.ChatMessageResponse {
	res := dto.ChatMessageResponse{
		ID:        m.ID,
		RoomID:    m.RoomID,
		SenderID:  m.SenderID,
		Content:   m.Content,
		ImageURL:  m.ImageURL,
		FileURL:   m.FileURL,
		FileName:  m.FileName,
		GifURL:    m.GifURL,
		CreatedAt: m.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if m.Sender != nil {
		res.Sender = &dto.UserResponseChat{
			ID:        m.Sender.ID,
			Username:  m.Sender.Username,
			FirstName: m.Sender.FirstName,
			LastName:  m.Sender.LastName,
			PhotoURL:  m.Sender.PhotoURL,
		}
	}
	return res
}
