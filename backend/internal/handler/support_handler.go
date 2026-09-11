package handler

import (
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"nexustickets/internal/domain"
	"nexustickets/internal/dto"
	"nexustickets/internal/service"
	"nexustickets/pkg/response"
)

// SupportHandler serves support tickets: users open requests to the
// administration, administrators work the queue.
type SupportHandler struct {
	service *service.SupportService
}

func NewSupportHandler(support *service.SupportService) *SupportHandler {
	return &SupportHandler{service: support}
}

func (h *SupportHandler) Open(c *fiber.Ctx) error {
	userID, err := authUserID(c)
	if err != nil {
		return err
	}
	var req dto.OpenSupportTicketRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	ticket, err := h.service.Open(c.Context(), userID, req.Subject, req.Body)
	if err != nil {
		return mapSupportError(err)
	}
	out, err := h.hydrateTickets(c, []domain.SupportTicket{ticket})
	if err != nil {
		return err
	}
	return response.Created(c, out[0])
}

func (h *SupportHandler) ListMine(c *fiber.Ctx) error {
	userID, err := authUserID(c)
	if err != nil {
		return err
	}
	limit, offset, err := parsePage(c.Query("limit"), c.Query("offset"))
	if err != nil {
		return err
	}
	page, err := h.service.ListMine(c.Context(), userID, limit, offset)
	if err != nil {
		return err
	}
	out, err := h.hydrateTickets(c, page.Tickets)
	if err != nil {
		return err
	}
	return response.Paginated(c, out, dto.SupportListMeta{Total: page.Total, Limit: limit, Offset: offset})
}

// AdminList is the administration's queue; `status` narrows it.
func (h *SupportHandler) AdminList(c *fiber.Ctx) error {
	limit, offset, err := parsePage(c.Query("limit"), c.Query("offset"))
	if err != nil {
		return err
	}
	var status *domain.SupportTicketStatus
	if raw := strings.TrimSpace(c.Query("status")); raw != "" {
		st := domain.SupportTicketStatus(raw)
		status = &st
	}
	page, err := h.service.ListAll(c.Context(), status, limit, offset)
	if err != nil {
		return err
	}
	out, err := h.hydrateTickets(c, page.Tickets)
	if err != nil {
		return err
	}
	return response.Paginated(c, out, dto.SupportListMeta{Total: page.Total, Limit: limit, Offset: offset})
}

func (h *SupportHandler) AdminCounts(c *fiber.Ctx) error {
	counts, err := h.service.Counts(c.Context())
	if err != nil {
		return err
	}
	return response.OK(c, dto.SupportCountsResponse{
		Open:     counts[domain.SupportTicketOpen],
		Answered: counts[domain.SupportTicketAnswered],
		Closed:   counts[domain.SupportTicketClosed],
	})
}

func (h *SupportHandler) Get(c *fiber.Ctx) error {
	userID, role, ticketID, err := supportCallContext(c)
	if err != nil {
		return err
	}
	thread, err := h.service.Get(c.Context(), userID, role, ticketID)
	if err != nil {
		return err
	}
	return response.OK(c, h.toThread(c, thread))
}

func (h *SupportHandler) Reply(c *fiber.Ctx) error {
	userID, role, ticketID, err := supportCallContext(c)
	if err != nil {
		return err
	}
	var req dto.SupportReplyRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if _, err := h.service.Reply(c.Context(), userID, role, ticketID, req.Body); err != nil {
		return mapSupportError(err)
	}
	thread, err := h.service.Get(c.Context(), userID, role, ticketID)
	if err != nil {
		return err
	}
	return response.Created(c, h.toThread(c, thread))
}

func (h *SupportHandler) Close(c *fiber.Ctx) error {
	userID, role, ticketID, err := supportCallContext(c)
	if err != nil {
		return err
	}
	if _, err := h.service.Close(c.Context(), userID, role, ticketID); err != nil {
		return err
	}
	thread, err := h.service.Get(c.Context(), userID, role, ticketID)
	if err != nil {
		return err
	}
	return response.OK(c, h.toThread(c, thread))
}

func supportCallContext(c *fiber.Ctx) (uuid.UUID, domain.UserRole, uuid.UUID, error) {
	userID, err := authUserID(c)
	if err != nil {
		return uuid.Nil, "", uuid.Nil, err
	}
	role, err := authUserRole(c)
	if err != nil {
		return uuid.Nil, "", uuid.Nil, err
	}
	ticketID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return uuid.Nil, "", uuid.Nil, fiber.NewError(fiber.StatusBadRequest, "invalid ticket id")
	}
	return userID, role, ticketID, nil
}

func mapSupportError(err error) error {
	switch {
	case errors.Is(err, service.ErrSupportSubjectBodyRequired),
		errors.Is(err, service.ErrSupportTooLong):
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	case errors.Is(err, service.ErrSupportTicketClosed):
		return fiber.NewError(fiber.StatusUnprocessableEntity, err.Error())
	default:
		return err
	}
}

func (h *SupportHandler) toThread(c *fiber.Ctx, thread service.SupportThread) dto.SupportThreadResponse {
	ids := []uuid.UUID{thread.Ticket.UserID}
	for _, m := range thread.Messages {
		ids = append(ids, m.AuthorID)
	}
	people, err := h.service.LookupUsers(c.Context(), ids)
	if err != nil {
		people = nil
	}

	ticket := toSupportTicketResponse(thread.Ticket)
	if u, ok := people[thread.Ticket.UserID]; ok {
		ticket.User = toSupportParticipant(u)
	}
	msgs := make([]dto.SupportMessageResponse, 0, len(thread.Messages))
	for _, m := range thread.Messages {
		resp := dto.SupportMessageResponse{
			ID:        m.ID.String(),
			TicketID:  m.TicketID.String(),
			AuthorID:  m.AuthorID.String(),
			Body:      m.Body,
			CreatedAt: m.CreatedAt.UTC().Format(time.RFC3339),
		}
		if u, ok := people[m.AuthorID]; ok {
			resp.Author = toSupportParticipant(u)
			resp.FromAdmin = u.Role == domain.UserRoleAdmin
		}
		msgs = append(msgs, resp)
	}
	return dto.SupportThreadResponse{Ticket: ticket, Messages: msgs}
}

func (h *SupportHandler) hydrateTickets(c *fiber.Ctx, tickets []domain.SupportTicket) ([]dto.SupportTicketResponse, error) {
	out := make([]dto.SupportTicketResponse, 0, len(tickets))
	if len(tickets) == 0 {
		return out, nil
	}
	ids := make([]uuid.UUID, 0, len(tickets))
	for _, t := range tickets {
		ids = append(ids, t.UserID)
	}
	people, err := h.service.LookupUsers(c.Context(), ids)
	if err != nil {
		return nil, err
	}
	for _, t := range tickets {
		resp := toSupportTicketResponse(t)
		if u, ok := people[t.UserID]; ok {
			resp.User = toSupportParticipant(u)
		}
		out = append(out, resp)
	}
	return out, nil
}

func toSupportTicketResponse(t domain.SupportTicket) dto.SupportTicketResponse {
	return dto.SupportTicketResponse{
		ID:        t.ID.String(),
		UserID:    t.UserID.String(),
		Subject:   t.Subject,
		Status:    string(t.Status),
		CreatedAt: t.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt: t.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func toSupportParticipant(u domain.User) *dto.SupportParticipant {
	return &dto.SupportParticipant{
		ID:       u.ID.String(),
		Username: u.Username,
		FullName: strings.TrimSpace(u.FirstName + " " + u.LastName),
		Role:     string(u.Role),
	}
}
