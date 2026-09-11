package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/google/uuid"

	"nexustickets/internal/domain"
	wshub "nexustickets/internal/handler/ws"
	repo "nexustickets/internal/repository"
)

var (
	ErrSupportSubjectBodyRequired = errors.New("subject and body are required")
	ErrSupportTooLong             = errors.New("subject or body is too long")
	ErrSupportTicketClosed        = errors.New("ticket is closed")
)

// SupportService handles support tickets: a registered user opens a request
// to the administration, any administrator replies, either side closes it.
// Unlike the mailbox it needs no booking relationship.
type SupportService struct {
	tickets repo.SupportRepository
	users   repo.UserRepository
	hub     *wshub.Hub
}

func NewSupportService(tickets repo.SupportRepository, users repo.UserRepository, hub *wshub.Hub) *SupportService {
	return &SupportService{tickets: tickets, users: users, hub: hub}
}

// SupportUpdate is the WebSocket payload sent to whoever should react to a
// change on a ticket: the administrators for the user's actions, the owner
// for the administration's.
type SupportUpdate struct {
	TicketID string `json:"ticket_id"`
	Subject  string `json:"subject"`
	Status   string `json:"status"`
	// Action is "opened", "replied" or "closed".
	Action  string `json:"action"`
	ByAdmin bool   `json:"by_admin"`
}

// SupportThread is a ticket with its full conversation.
type SupportThread struct {
	Ticket   domain.SupportTicket
	Messages []domain.SupportMessage
}

// SupportTicketPage is one page of a ticket list plus its total.
type SupportTicketPage struct {
	Tickets []domain.SupportTicket
	Total   int
}

func (s *SupportService) Open(ctx context.Context, userID uuid.UUID, subject, body string) (domain.SupportTicket, error) {
	subject = strings.TrimSpace(subject)
	body = strings.TrimSpace(body)
	if err := validateSupportText(subject, body); err != nil {
		return domain.SupportTicket{}, err
	}
	ticket, err := s.tickets.CreateTicket(ctx,
		domain.SupportTicket{UserID: userID, Subject: subject, Status: domain.SupportTicketOpen},
		domain.SupportMessage{AuthorID: userID, Body: body},
	)
	if err != nil {
		return domain.SupportTicket{}, err
	}
	s.notify(ctx, ticket, "opened", false)
	return ticket, nil
}

func (s *SupportService) ListMine(ctx context.Context, userID uuid.UUID, limit, offset int) (SupportTicketPage, error) {
	tickets, total, err := s.tickets.ListTicketsByUser(ctx, userID, limit, offset)
	if err != nil {
		return SupportTicketPage{}, err
	}
	return SupportTicketPage{Tickets: tickets, Total: total}, nil
}

// ListAll is the administration's queue, optionally filtered by status.
func (s *SupportService) ListAll(ctx context.Context, status *domain.SupportTicketStatus, limit, offset int) (SupportTicketPage, error) {
	if status != nil && !domain.ValidSupportTicketStatus(*status) {
		return SupportTicketPage{}, domain.Invalid("unknown ticket status")
	}
	tickets, total, err := s.tickets.ListTickets(ctx, status, limit, offset)
	if err != nil {
		return SupportTicketPage{}, err
	}
	return SupportTicketPage{Tickets: tickets, Total: total}, nil
}

// Counts returns how many tickets sit in each state, for the admin dashboard.
func (s *SupportService) Counts(ctx context.Context) (map[domain.SupportTicketStatus]int, error) {
	return s.tickets.CountTicketsByStatus(ctx)
}

// Get returns the ticket and its thread. Only the owner and administrators
// may read it.
func (s *SupportService) Get(ctx context.Context, userID uuid.UUID, role domain.UserRole, ticketID uuid.UUID) (SupportThread, error) {
	ticket, err := s.authorised(ctx, userID, role, ticketID)
	if err != nil {
		return SupportThread{}, err
	}
	msgs, err := s.tickets.ListMessages(ctx, ticketID)
	if err != nil {
		return SupportThread{}, err
	}
	return SupportThread{Ticket: ticket, Messages: msgs}, nil
}

// Reply appends to the thread. An administrator's reply marks the ticket
// "answered"; the owner's reply reopens it. Closed tickets take no replies.
func (s *SupportService) Reply(ctx context.Context, userID uuid.UUID, role domain.UserRole, ticketID uuid.UUID, body string) (domain.SupportMessage, error) {
	body = strings.TrimSpace(body)
	if body == "" {
		return domain.SupportMessage{}, ErrSupportSubjectBodyRequired
	}
	if len([]rune(body)) > maxBodyLength {
		return domain.SupportMessage{}, ErrSupportTooLong
	}
	ticket, err := s.authorised(ctx, userID, role, ticketID)
	if err != nil {
		return domain.SupportMessage{}, err
	}
	if ticket.Status == domain.SupportTicketClosed {
		return domain.SupportMessage{}, ErrSupportTicketClosed
	}
	next := domain.SupportTicketOpen
	byAdmin := role == domain.UserRoleAdmin
	if byAdmin {
		next = domain.SupportTicketAnswered
	}
	msg, err := s.tickets.AddMessage(ctx, domain.SupportMessage{TicketID: ticketID, AuthorID: userID, Body: body}, next)
	if err != nil {
		return domain.SupportMessage{}, err
	}
	ticket.Status = next
	s.notify(ctx, ticket, "replied", byAdmin)
	return msg, nil
}

// Close settles the ticket. Idempotent.
func (s *SupportService) Close(ctx context.Context, userID uuid.UUID, role domain.UserRole, ticketID uuid.UUID) (domain.SupportTicket, error) {
	ticket, err := s.authorised(ctx, userID, role, ticketID)
	if err != nil {
		return domain.SupportTicket{}, err
	}
	if ticket.Status == domain.SupportTicketClosed {
		return ticket, nil
	}
	if err := s.tickets.SetTicketStatus(ctx, ticketID, domain.SupportTicketClosed); err != nil {
		return domain.SupportTicket{}, err
	}
	closed, err := s.tickets.GetTicket(ctx, ticketID)
	if err != nil {
		return domain.SupportTicket{}, err
	}
	s.notify(ctx, closed, "closed", role == domain.UserRoleAdmin)
	return closed, nil
}

// notify pushes the update over the WebSocket. A user's action goes to every
// administrator; an administrator's goes to the ticket's owner. Delivery is
// best-effort: the REST response already carries the result.
func (s *SupportService) notify(ctx context.Context, ticket domain.SupportTicket, action string, byAdmin bool) {
	if s.hub == nil {
		return
	}
	payload, err := json.Marshal(SupportUpdate{
		TicketID: ticket.ID.String(),
		Subject:  ticket.Subject,
		Status:   string(ticket.Status),
		Action:   action,
		ByAdmin:  byAdmin,
	})
	if err != nil {
		return
	}
	frame, err := json.Marshal(wsOutbound{Type: wshub.TypeSupportUpdate, Payload: payload})
	if err != nil {
		return
	}

	if byAdmin {
		s.hub.SendToUser(ticket.UserID, frame)
		return
	}
	admins, err := s.users.ListByRole(ctx, domain.UserRoleAdmin)
	if err != nil {
		return
	}
	for _, a := range admins {
		s.hub.SendToUser(a.ID, frame)
	}
}

// LookupUsers resolves ticket owners and message authors for rendering.
func (s *SupportService) LookupUsers(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]domain.User, error) {
	return s.users.ListByIDs(ctx, ids)
}

func (s *SupportService) authorised(ctx context.Context, userID uuid.UUID, role domain.UserRole, ticketID uuid.UUID) (domain.SupportTicket, error) {
	ticket, err := s.tickets.GetTicket(ctx, ticketID)
	if err != nil {
		return domain.SupportTicket{}, err
	}
	if ticket.UserID != userID && role != domain.UserRoleAdmin {
		return domain.SupportTicket{}, domain.ErrForbidden
	}
	return ticket, nil
}

func validateSupportText(subject, body string) error {
	if subject == "" || body == "" {
		return ErrSupportSubjectBodyRequired
	}
	if len([]rune(subject)) > maxSubjectLength || len([]rune(body)) > maxBodyLength {
		return ErrSupportTooLong
	}
	return nil
}
