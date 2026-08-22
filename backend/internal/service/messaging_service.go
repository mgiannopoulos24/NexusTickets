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

var (
	ErrMessageSubjectBodyRequired = errors.New("subject and body are required")
	ErrMessageSelfRecipient       = errors.New("cannot send a message to yourself")
)

func unreadRedisKey(userID uuid.UUID) string {
	return redisUnreadKeyPrefix + userID.String()
}

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
	Subject     string
	Body        string
}

func (s *MessagingService) SendMessage(ctx context.Context, in SendMessageInput) (domain.Message, error) {
	subject := strings.TrimSpace(in.Subject)
	body := strings.TrimSpace(in.Body)
	if subject == "" || body == "" {
		return domain.Message{}, ErrMessageSubjectBodyRequired
	}
	if in.SenderID == in.RecipientID {
		return domain.Message{}, ErrMessageSelfRecipient
	}

	recipient, err := s.users.GetByID(ctx, in.RecipientID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.Message{}, domain.ErrNotFound
		}
		return domain.Message{}, err
	}
	sender, err := s.users.GetByID(ctx, in.SenderID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.Message{}, domain.ErrNotFound
		}
		return domain.Message{}, err
	}

	allowed, err := s.canCorrespond(ctx, sender, recipient)
	if err != nil {
		return domain.Message{}, err
	}
	if !allowed {
		return domain.Message{}, domain.ErrMessagingNotAllowed
	}

	created, err := s.messages.Create(ctx, domain.Message{
		SenderID:    in.SenderID,
		RecipientID: in.RecipientID,
		Subject:     subject,
		Body:        body,
	})
	if err != nil {
		return domain.Message{}, err
	}

	if err := s.redisIncrUnreadThenReconcile(ctx, in.RecipientID); err != nil {
		return domain.Message{}, err
	}

	count, err := s.messages.GetUnreadCount(ctx, in.RecipientID)
	if err != nil {
		return domain.Message{}, err
	}

	s.broadcastNewMessage(in.RecipientID, created)
	s.broadcastUnreadCount(in.RecipientID, count)

	return created, nil
}

// canCorrespond implements the assignment's §10 rule that organizer/attendee
// messaging opens up once a booking exists between them. An administrator is
// always reachable (and can always reach anyone) so support requests and
// approval questions have a channel that does not depend on a booking.
func (s *MessagingService) canCorrespond(ctx context.Context, sender, recipient domain.User) (bool, error) {
	if sender.Role == domain.UserRoleAdmin || recipient.Role == domain.UserRoleAdmin {
		return true, nil
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

// Correspondent is someone the current user is allowed to message, along with
// why they are reachable.
type Correspondent struct {
	User domain.User
	// Support marks an administrator, reachable regardless of bookings.
	Support bool
}

// ListRecipients returns everyone the user may currently write to: the people
// they share a booking with, plus the administrators (support). Sorted with
// support last so the booking-related contacts lead.
func (s *MessagingService) ListRecipients(ctx context.Context, userID uuid.UUID) ([]Correspondent, error) {
	ids, err := s.bookings.ListCorrespondentIDs(ctx, userID)
	if err != nil {
		return nil, err
	}

	byID, err := s.users.ListByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}

	out := make([]Correspondent, 0, len(byID)+1)
	seen := make(map[uuid.UUID]struct{}, len(byID)+1)
	for _, id := range ids {
		u, ok := byID[id]
		if !ok || u.ID == userID {
			continue
		}
		if _, dup := seen[u.ID]; dup {
			continue
		}
		seen[u.ID] = struct{}{}
		out = append(out, Correspondent{User: u})
	}

	admins, err := s.users.ListByRole(ctx, domain.UserRoleAdmin)
	if err != nil {
		return nil, err
	}
	for _, a := range admins {
		if a.ID == userID {
			continue
		}
		if _, dup := seen[a.ID]; dup {
			continue
		}
		seen[a.ID] = struct{}{}
		out = append(out, Correspondent{User: a, Support: true})
	}

	return out, nil
}

// LookupUsers resolves user identities in one batch, for rendering mailboxes.
func (s *MessagingService) LookupUsers(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]domain.User, error) {
	return s.users.ListByIDs(ctx, ids)
}

// CanCorrespondWith reports whether the two users may exchange messages. The
// handler uses it to tell the UI which recipients to offer.
func (s *MessagingService) CanCorrespondWith(ctx context.Context, senderID, recipientID uuid.UUID) (bool, error) {
	if senderID == recipientID {
		return false, nil
	}
	sender, err := s.users.GetByID(ctx, senderID)
	if err != nil {
		return false, err
	}
	recipient, err := s.users.GetByID(ctx, recipientID)
	if err != nil {
		return false, err
	}
	return s.canCorrespond(ctx, sender, recipient)
}

func (s *MessagingService) redisIncrUnreadThenReconcile(ctx context.Context, recipientID uuid.UUID) error {
	key := unreadRedisKey(recipientID)
	if _, err := s.redis.Incr(ctx, key).Result(); err != nil {
		return fmt.Errorf("redis incr unread: %w", err)
	}
	count, err := s.messages.GetUnreadCount(ctx, recipientID)
	if err != nil {
		return err
	}
	if err := s.redis.Set(ctx, key, count, 0).Err(); err != nil {
		return fmt.Errorf("redis set unread: %w", err)
	}
	return nil
}

// GetInbox returns a page of received messages and marks exactly that page
// read. Earlier revisions cleared the whole mailbox on any fetch, which wiped
// the "new message" indicator for messages the user had never seen.
func (s *MessagingService) GetInbox(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.Message, error) {
	messages, err := s.messages.ListInbox(ctx, userID, limit, offset)
	if err != nil {
		return nil, err
	}

	unreadIDs := make([]uuid.UUID, 0, len(messages))
	for _, m := range messages {
		if m.ReadAt == nil {
			unreadIDs = append(unreadIDs, m.ID)
		}
	}
	if len(unreadIDs) == 0 {
		return messages, nil
	}

	if err := s.messages.MarkAsReadByIDs(ctx, userID, unreadIDs); err != nil {
		return nil, err
	}

	count, err := s.messages.GetUnreadCount(ctx, userID)
	if err != nil {
		return nil, err
	}
	if err := s.redis.Set(ctx, unreadRedisKey(userID), count, 0).Err(); err != nil {
		return nil, fmt.Errorf("redis set unread on inbox: %w", err)
	}
	s.broadcastUnreadCount(userID, count)

	// Reflect the write in what we hand back, so the caller does not have to
	// re-fetch to see the page as read.
	now := time.Now().UTC()
	marked := make(map[uuid.UUID]struct{}, len(unreadIDs))
	for _, id := range unreadIDs {
		marked[id] = struct{}{}
	}
	for i := range messages {
		if _, ok := marked[messages[i].ID]; ok {
			readAt := now
			messages[i].ReadAt = &readAt
		}
	}
	return messages, nil
}

func (s *MessagingService) GetSent(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.Message, error) {
	return s.messages.ListSent(ctx, userID, limit, offset)
}

func (s *MessagingService) DeleteForUser(ctx context.Context, messageID, userID uuid.UUID) error {
	if err := s.messages.DeleteForUser(ctx, messageID, userID); err != nil {
		return err
	}
	count, err := s.messages.GetUnreadCount(ctx, userID)
	if err != nil {
		return err
	}
	if err := s.redis.Set(ctx, unreadRedisKey(userID), count, 0).Err(); err != nil {
		return fmt.Errorf("redis set unread after delete: %w", err)
	}
	s.broadcastUnreadCount(userID, count)
	return nil
}

func (s *MessagingService) GetUnreadCount(ctx context.Context, userID uuid.UUID) (int, error) {
	key := unreadRedisKey(userID)
	n, err := s.redis.Get(ctx, key).Int()
	if err == nil {
		return n, nil
	}
	if !errors.Is(err, redisv9.Nil) {
		return 0, fmt.Errorf("redis get unread: %w", err)
	}
	count, err := s.messages.GetUnreadCount(ctx, userID)
	if err != nil {
		return 0, err
	}
	if err := s.redis.Set(ctx, key, count, 0).Err(); err != nil {
		return 0, fmt.Errorf("redis set unread from db: %w", err)
	}
	return count, nil
}

func (s *MessagingService) NotifyEventCancellation(ctx context.Context, eventID uuid.UUID) error {
	event, err := s.events.GetByID(ctx, eventID)
	if err != nil {
		return err
	}

	userIDs, err := s.bookings.ListDistinctConfirmedUserIDsByEvent(ctx, eventID)
	if err != nil {
		return err
	}
	if len(userIDs) == 0 {
		return nil
	}

	subject := "Event cancelled"
	body := fmt.Sprintf("The event %q has been cancelled by the organizer.", event.Title)

	msgs := make([]domain.Message, 0, len(userIDs))
	for _, uid := range userIDs {
		if uid == event.OrganizerID {
			continue
		}
		msgs = append(msgs, domain.Message{
			SenderID:    event.OrganizerID,
			RecipientID: uid,
			Subject:     subject,
			Body:        body,
		})
	}
	if len(msgs) == 0 {
		return nil
	}

	created, err := s.messages.CreateBatch(ctx, msgs)
	if err != nil {
		return err
	}

	for _, msg := range created {
		if err := s.redisIncrUnreadThenReconcile(ctx, msg.RecipientID); err != nil {
			return err
		}
		count, err := s.messages.GetUnreadCount(ctx, msg.RecipientID)
		if err != nil {
			return err
		}
		s.broadcastNewMessage(msg.RecipientID, msg)
		s.broadcastUnreadCount(msg.RecipientID, count)
	}

	return nil
}

func (s *MessagingService) broadcastNewMessage(recipientID uuid.UUID, msg domain.Message) {
	payload, err := json.Marshal(map[string]any{
		"id":           msg.ID.String(),
		"sender_id":    msg.SenderID.String(),
		"recipient_id": msg.RecipientID.String(),
		"subject":      msg.Subject,
		"body":         msg.Body,
		"created_at":   msg.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	})
	if err != nil {
		return
	}
	out, err := json.Marshal(wsOutbound{
		Type:    wshub.TypeNewMessage,
		Payload: payload,
	})
	if err != nil {
		return
	}
	s.hub.SendToUser(recipientID, out)
}

func (s *MessagingService) broadcastUnreadCount(recipientID uuid.UUID, count int) {
	payload, err := json.Marshal(map[string]int{"count": count})
	if err != nil {
		return
	}
	out, err := json.Marshal(wsOutbound{
		Type:    wshub.TypeUnreadCount,
		Payload: payload,
	})
	if err != nil {
		return
	}
	s.hub.SendToUser(recipientID, out)
}

type wsOutbound struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}
