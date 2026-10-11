package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	redisv9 "github.com/redis/go-redis/v9"

	"nexustickets/internal/domain"
	wshub "nexustickets/internal/handler/ws"
	repo "nexustickets/internal/repository"
)

const redisUnreadKeyPrefix = "nexustickets:unread:"

const (
	maxSubjectLength = 200
	maxBodyLength    = 10_000
)

var (
	ErrMessageSubjectBodyRequired = errors.New("subject and body are required")
	ErrMessageTooLong             = errors.New("subject or body is too long")
	ErrMessageSelfRecipient       = errors.New("cannot send a message to yourself")
	ErrMessageNoRecipients        = errors.New("nobody has booked this event yet")
)

func unreadRedisKey(userID uuid.UUID) string {
	return redisUnreadKeyPrefix + userID.String()
}

// MessagingService is the mailbox of assignment §10: organizer/attendee
// messages filed under inbox and sent, an unread counter pushed over the
// WebSocket, per-folder deletion, and the organizer's notice to everyone who
// booked an event.
type MessagingService struct {
	messages repo.MessageRepository
	users    repo.UserRepository
	bookings repo.BookingRepository
	events   repo.EventRepository
	redis    *redisv9.Client
	hub      *wshub.Hub
}

func NewMessagingService(
	messages repo.MessageRepository,
	users repo.UserRepository,
	bookings repo.BookingRepository,
	events repo.EventRepository,
	redis *redisv9.Client,
	hub *wshub.Hub,
) *MessagingService {
	return &MessagingService{
		messages: messages,
		users:    users,
		bookings: bookings,
		events:   events,
		redis:    redis,
		hub:      hub,
	}
}

type SendMessageInput struct {
	SenderID    uuid.UUID
	RecipientID uuid.UUID
	// EventID optionally ties the message to the event it is about.
	EventID *uuid.UUID
	Subject string
	Body    string
}

// Mailbox is one page of a folder plus the folder's total, for pagination.
type Mailbox struct {
	Messages []domain.Message
	Total    int
}

func validateSubjectBody(subject, body string) error {
	if subject == "" || body == "" {
		return ErrMessageSubjectBodyRequired
	}
	if len([]rune(subject)) > maxSubjectLength || len([]rune(body)) > maxBodyLength {
		return ErrMessageTooLong
	}
	return nil
}

func (s *MessagingService) SendMessage(ctx context.Context, in SendMessageInput) (domain.Message, error) {
	subject := strings.TrimSpace(in.Subject)
	body := strings.TrimSpace(in.Body)
	if err := validateSubjectBody(subject, body); err != nil {
		return domain.Message{}, err
	}
	if in.SenderID == in.RecipientID {
		return domain.Message{}, ErrMessageSelfRecipient
	}

	recipient, err := s.users.GetByID(ctx, in.RecipientID)
	if err != nil {
		return domain.Message{}, err
	}
	sender, err := s.users.GetByID(ctx, in.SenderID)
	if err != nil {
		return domain.Message{}, err
	}

	allowed, err := s.canCorrespond(ctx, sender, recipient)
	if err != nil {
		return domain.Message{}, err
	}
	if !allowed {
		return domain.Message{}, domain.ErrMessagingNotAllowed
	}

	if in.EventID != nil {
		// The event only has to exist; either party may reference it. A bogus
		// id is a client error rather than something to silently drop.
		if _, err := s.events.GetByID(ctx, *in.EventID); err != nil {
			return domain.Message{}, err
		}
	}

	created, err := s.messages.Create(ctx, domain.Message{
		SenderID:    in.SenderID,
		RecipientID: in.RecipientID,
		EventID:     in.EventID,
		Subject:     subject,
		Body:        body,
	})
	if err != nil {
		return domain.Message{}, err
	}

	if err := s.deliver(ctx, created); err != nil {
		return domain.Message{}, err
	}
	return created, nil
}

// deliver refreshes the recipient's unread counter after a message was stored
// and pushes both the message and the counter to their open connections.
func (s *MessagingService) deliver(ctx context.Context, msg domain.Message) error {
	count, err := s.syncUnread(ctx, msg.RecipientID)
	if err != nil {
		return err
	}
	s.broadcastNewMessage(msg.RecipientID, msg)
	s.broadcastUnreadCount(msg.RecipientID, count)
	return nil
}

// syncUnread recomputes the user's unread count from the database and caches
// it in Redis, which is what the navbar badge is served from.
func (s *MessagingService) syncUnread(ctx context.Context, userID uuid.UUID) (int, error) {
	count, err := s.messages.GetUnreadCount(ctx, userID)
	if err != nil {
		return 0, err
	}
	if err := s.redis.Set(ctx, unreadRedisKey(userID), count, 0).Err(); err != nil {
		return 0, fmt.Errorf("redis set unread: %w", err)
	}
	return count, nil
}

// canCorrespond implements the assignment's §10 rule: organizer/attendee
// messaging opens up once a booking exists between them, and only then.
// Requests to the administrators go through support tickets instead.
//
// An administrator is also a user who can attend any event, so they may write
// to the organizer of any event still open for booking without holding a
// ticket, and that organizer may write back.
func (s *MessagingService) canCorrespond(ctx context.Context, sender, recipient domain.User) (bool, error) {
	if ok, err := s.adminToOrganizer(ctx, sender, recipient); ok || err != nil {
		return ok, err
	}
	if ok, err := s.adminToOrganizer(ctx, recipient, sender); ok || err != nil {
		return ok, err
	}

	// Either direction: the sender booked one of the recipient's events, or the
	// recipient booked one of the sender's.
	booked, err := s.bookings.ExistsBetweenAttendeeAndOrganizer(ctx, sender.ID, recipient.ID)
	if err != nil {
		return false, err
	}
	if booked {
		return true, nil
	}
	return s.bookings.ExistsBetweenAttendeeAndOrganizer(ctx, recipient.ID, sender.ID)
}

// adminToOrganizer reports whether admin is an administrator and organizer
// runs an event the administrator could still attend.
func (s *MessagingService) adminToOrganizer(ctx context.Context, admin, organizer domain.User) (bool, error) {
	if admin.Role != domain.UserRoleAdmin || admin.ID == organizer.ID {
		return false, nil
	}
	return s.events.OrganizesBookableEvent(ctx, organizer.ID, time.Now())
}

// ListRecipients returns everyone the user may currently write to: the people
// they share a booking with, in either direction, and for an administrator
// also the organizers of every event still open for booking.
func (s *MessagingService) ListRecipients(ctx context.Context, userID uuid.UUID) ([]domain.User, error) {
	ids, err := s.bookings.ListCorrespondentIDs(ctx, userID)
	if err != nil {
		return nil, err
	}

	me, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if me.Role == domain.UserRoleAdmin {
		organizers, err := s.events.ListBookableOrganizerIDs(ctx, time.Now())
		if err != nil {
			return nil, err
		}
		ids = append(ids, organizers...)
	}

	byID, err := s.users.ListByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}

	out := make([]domain.User, 0, len(byID))
	seen := make(map[uuid.UUID]struct{}, len(byID))
	for _, id := range ids {
		u, ok := byID[id]
		if !ok || u.ID == userID {
			continue
		}
		if _, dup := seen[u.ID]; dup {
			continue
		}
		seen[u.ID] = struct{}{}
		out = append(out, u)
	}
	return out, nil
}

// LookupUsers resolves user identities in one batch, for rendering mailboxes.
func (s *MessagingService) LookupUsers(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]domain.User, error) {
	return s.users.ListByIDs(ctx, ids)
}

// LookupEvents resolves the events a page of messages refers to, once each.
func (s *MessagingService) LookupEvents(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]domain.Event, error) {
	out := make(map[uuid.UUID]domain.Event, len(ids))
	for _, id := range ids {
		if _, done := out[id]; done {
			continue
		}
		ev, err := s.events.GetByID(ctx, id)
		if err != nil {
			// A message may outlive its event only through the FK's SET NULL,
			// so a miss here is a race worth tolerating, not an error.
			if errors.Is(err, domain.ErrNotFound) {
				continue
			}
			return nil, err
		}
		out[id] = ev
	}
	return out, nil
}

// GetInbox lists received messages, newest first. Listing has no read
// side-effects: a message stays "new" until it is opened.
func (s *MessagingService) GetInbox(ctx context.Context, userID uuid.UUID, limit, offset int) (Mailbox, error) {
	msgs, total, err := s.messages.ListInbox(ctx, userID, limit, offset)
	if err != nil {
		return Mailbox{}, err
	}
	return Mailbox{Messages: msgs, Total: total}, nil
}

func (s *MessagingService) GetSent(ctx context.Context, userID uuid.UUID, limit, offset int) (Mailbox, error) {
	msgs, total, err := s.messages.ListSent(ctx, userID, limit, offset)
	if err != nil {
		return Mailbox{}, err
	}
	return Mailbox{Messages: msgs, Total: total}, nil
}

// GetMessage opens one message. Only its two parties may read it, and only
// while it is still in their folder. Opening a received message marks it read
// and refreshes the unread counter.
func (s *MessagingService) GetMessage(ctx context.Context, messageID, userID uuid.UUID) (domain.Message, error) {
	msg, err := s.messages.GetByID(ctx, messageID)
	if err != nil {
		return domain.Message{}, err
	}
	switch userID {
	case msg.RecipientID:
		if msg.DeletedByRecipient {
			return domain.Message{}, domain.ErrNotFound
		}
	case msg.SenderID:
		if msg.DeletedBySender {
			return domain.Message{}, domain.ErrNotFound
		}
		return msg, nil
	default:
		return domain.Message{}, domain.ErrForbidden
	}

	if msg.ReadAt != nil {
		return msg, nil
	}
	changed, err := s.messages.MarkAsRead(ctx, messageID, userID)
	if err != nil {
		return domain.Message{}, err
	}
	if changed {
		now := time.Now().UTC()
		msg.ReadAt = &now
		count, err := s.syncUnread(ctx, userID)
		if err != nil {
			return domain.Message{}, err
		}
		s.broadcastUnreadCount(userID, count)
	}
	return msg, nil
}

// DeleteForUser removes a message from the caller's own folder. The other
// party's copy is untouched, so the inbox and the sent list are independent.
func (s *MessagingService) DeleteForUser(ctx context.Context, messageID, userID uuid.UUID) error {
	existing, err := s.messages.GetByID(ctx, messageID)
	if err != nil {
		return err
	}
	if existing.SenderID != userID && existing.RecipientID != userID {
		return domain.ErrForbidden
	}
	if err := s.messages.DeleteForUser(ctx, messageID, userID); err != nil {
		return err
	}

	// Deleting an unread message from the inbox also takes it off the badge.
	if existing.RecipientID == userID && existing.ReadAt == nil {
		count, err := s.syncUnread(ctx, userID)
		if err != nil {
			return err
		}
		s.broadcastUnreadCount(userID, count)
	}
	return nil
}

func (s *MessagingService) GetUnreadCount(ctx context.Context, userID uuid.UUID) (int, error) {
	n, err := s.redis.Get(ctx, unreadRedisKey(userID)).Int()
	if err == nil {
		return n, nil
	}
	if !errors.Is(err, redisv9.Nil) {
		return 0, fmt.Errorf("redis get unread: %w", err)
	}
	return s.syncUnread(ctx, userID)
}

// NotifyEventAttendees sends one message from the organizer to every user
// with a confirmed booking on the event (§10: the organizer's notice to all
// who booked). Only the event's own organizer may do this.
func (s *MessagingService) NotifyEventAttendees(ctx context.Context, organizerID, eventID uuid.UUID, subject, body string) (int, error) {
	subject = strings.TrimSpace(subject)
	body = strings.TrimSpace(body)
	if err := validateSubjectBody(subject, body); err != nil {
		return 0, err
	}

	event, err := s.events.GetByID(ctx, eventID)
	if err != nil {
		return 0, err
	}
	if event.OrganizerID != organizerID {
		return 0, domain.ErrForbidden
	}

	sent, err := s.broadcastToAttendees(ctx, event, subject, body)
	if err != nil {
		return 0, err
	}
	if sent == 0 {
		return 0, ErrMessageNoRecipients
	}
	return sent, nil
}

// NotifyEventCancellation is the automatic notice sent, in the organizer's
// name, when an event is cancelled. Attendees see it in their inbox like any
// other message.
func (s *MessagingService) NotifyEventCancellation(ctx context.Context, eventID uuid.UUID) error {
	event, err := s.events.GetByID(ctx, eventID)
	if err != nil {
		return err
	}
	subject := fmt.Sprintf("Ακύρωση εκδήλωσης: %s", event.Title)
	body := fmt.Sprintf(
		"Η εκδήλωση «%s» (%s) ακυρώθηκε από τον διοργανωτή. Οι κρατήσεις σας για την εκδήλωση δεν είναι πλέον ενεργές.",
		event.Title, event.StartAt.Format("02/01/2006 15:04"),
	)
	_, err = s.broadcastToAttendees(ctx, event, subject, body)
	return err
}

// broadcastToAttendees stores one copy of the message per distinct confirmed
// booker (the organizer excluded) and delivers each. Returns how many went out.
func (s *MessagingService) broadcastToAttendees(ctx context.Context, event domain.Event, subject, body string) (int, error) {
	userIDs, err := s.bookings.ListDistinctConfirmedUserIDsByEvent(ctx, event.ID)
	if err != nil {
		return 0, err
	}

	eventID := event.ID
	msgs := make([]domain.Message, 0, len(userIDs))
	for _, uid := range userIDs {
		if uid == event.OrganizerID {
			continue
		}
		msgs = append(msgs, domain.Message{
			SenderID:    event.OrganizerID,
			RecipientID: uid,
			EventID:     &eventID,
			Subject:     subject,
			Body:        body,
		})
	}
	if len(msgs) == 0 {
		return 0, nil
	}

	created, err := s.messages.CreateBatch(ctx, msgs)
	if err != nil {
		return 0, err
	}
	for _, msg := range created {
		if err := s.deliver(ctx, msg); err != nil {
			return 0, err
		}
	}
	return len(created), nil
}

func (s *MessagingService) broadcastNewMessage(recipientID uuid.UUID, msg domain.Message) {
	var eventID *string
	if msg.EventID != nil {
		id := msg.EventID.String()
		eventID = &id
	}
	payload, err := json.Marshal(map[string]any{
		"id":           msg.ID.String(),
		"sender_id":    msg.SenderID.String(),
		"recipient_id": msg.RecipientID.String(),
		"event_id":     eventID,
		"subject":      msg.Subject,
		"body":         msg.Body,
		"created_at":   msg.CreatedAt.UTC().Format(time.RFC3339),
	})
	if err != nil {
		return
	}
	s.push(recipientID, wshub.TypeNewMessage, payload)
}

func (s *MessagingService) broadcastUnreadCount(recipientID uuid.UUID, count int) {
	payload, err := json.Marshal(map[string]int{"count": count})
	if err != nil {
		return
	}
	s.push(recipientID, wshub.TypeUnreadCount, payload)
}

func (s *MessagingService) push(to uuid.UUID, typ string, payload json.RawMessage) {
	if s.hub == nil {
		return
	}
	out, err := json.Marshal(wsOutbound{Type: typ, Payload: payload})
	if err != nil {
		return
	}
	s.hub.SendToUser(to, out)
}

type wsOutbound struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}
