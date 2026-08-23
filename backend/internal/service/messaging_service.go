package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
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
	ErrMessageSubjectBodyRequired    = errors.New("subject and body are required")
	ErrMessageSelfRecipient          = errors.New("cannot send a message to yourself")
	ErrMessageAttachmentNameRequired = errors.New("a file attachment needs a file name")
	ErrInvalidReaction               = errors.New("reaction must be a short emoji")
	ErrMessageDeleted                = errors.New("message was deleted")
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

	// mediaRoot is where message attachments are written; served back under
	// /uploads/media like every other upload.
	mediaRoot string
}

// SetMediaRoot points attachment storage at the configured media directory.
func (s *MessagingService) SetMediaRoot(path string) {
	s.mediaRoot = strings.TrimSpace(path)
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

	// At most one attachment per message; the body then acts as a caption and
	// may be empty.
	ImageURL string
	FileURL  string
	FileName string
	GifURL   string

	// ReplyToID quotes an earlier message in the same thread.
	ReplyToID *uuid.UUID
}

func (s *MessagingService) SendMessage(ctx context.Context, in SendMessageInput) (domain.Message, error) {
	subject := strings.TrimSpace(in.Subject)
	body := strings.TrimSpace(in.Body)
	imageURL := strings.TrimSpace(in.ImageURL)
	fileURL := strings.TrimSpace(in.FileURL)
	fileName := strings.TrimSpace(in.FileName)
	gifURL := strings.TrimSpace(in.GifURL)

	// A picture, a GIF or a file is a message in its own right, so the body is
	// only required when there is nothing else to deliver. A subject always is
	// (§10 keeps the mailbox semantics).
	hasAttachment := imageURL != "" || fileURL != "" || gifURL != ""
	if subject == "" || (body == "" && !hasAttachment) {
		return domain.Message{}, ErrMessageSubjectBodyRequired
	}
	if fileURL != "" && fileName == "" {
		return domain.Message{}, ErrMessageAttachmentNameRequired
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
		ImageURL:    imageURL,
		FileURL:     fileURL,
		FileName:    fileName,
		GifURL:      gifURL,
		ReplyToID:   in.ReplyToID,
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

// Attachment is a stored upload, ready to be attached to a message.
type Attachment struct {
	URL  string
	Name string
	Kind string
	Size int64
}

const (
	// AttachmentKindImage renders inline; AttachmentKindFile renders as a
	// download row.
	AttachmentKindImage = "image"
	AttachmentKindFile  = "file"

	maxAttachmentBytes = 10 << 20 // 10MB
)

var ErrAttachmentTooLarge = errors.New("attachment is larger than 10MB")

// StoreAttachment writes an upload under the sender's own directory and returns
// the URL a message can carry. Images are detected by content, not by the name
// the client supplied.
func (s *MessagingService) StoreAttachment(
	senderID uuid.UUID,
	originalName string,
	size int64,
	r io.Reader,
) (Attachment, error) {
	if strings.TrimSpace(s.mediaRoot) == "" {
		return Attachment{}, fmt.Errorf("media storage path is not configured")
	}
	if size > maxAttachmentBytes {
		return Attachment{}, ErrAttachmentTooLarge
	}

	// Sniff before writing so the stored extension matches the real content.
	sniff := make([]byte, 512)
	n, err := io.ReadFull(r, sniff)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) {
		return Attachment{}, fmt.Errorf("read attachment: %w", err)
	}
	head := sniff[:n]
	mime, isImage := DetectImageMIME(head)

	dir := filepath.Join(s.mediaRoot, "messages", senderID.String())
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return Attachment{}, fmt.Errorf("create attachment directory: %w", err)
	}

	name := sanitizeAttachmentName(originalName)
	ext := filepath.Ext(name)
	if isImage {
		ext = extForImageMIME(mime)
	}
	stored := uuid.NewString() + ext
	relative := filepath.ToSlash(filepath.Join("messages", senderID.String(), stored))
	absolute := filepath.Join(s.mediaRoot, filepath.FromSlash(relative))

	out, err := os.Create(absolute)
	if err != nil {
		return Attachment{}, fmt.Errorf("create attachment file: %w", err)
	}
	written, err := io.Copy(out, io.MultiReader(bytes.NewReader(head), r))
	if err != nil {
		_ = out.Close()
		_ = os.Remove(absolute)
		return Attachment{}, fmt.Errorf("write attachment: %w", err)
	}
	if err := out.Close(); err != nil {
		_ = os.Remove(absolute)
		return Attachment{}, fmt.Errorf("close attachment: %w", err)
	}
	if written > maxAttachmentBytes {
		_ = os.Remove(absolute)
		return Attachment{}, ErrAttachmentTooLarge
	}

	kind := AttachmentKindFile
	if isImage {
		kind = AttachmentKindImage
	}
	return Attachment{
		URL:  "/uploads/media/" + relative,
		Name: name,
		Kind: kind,
		Size: written,
	}, nil
}

// sanitizeAttachmentName keeps a readable download name without letting a
// client's path separators escape the storage directory.
func sanitizeAttachmentName(name string) string {
	name = filepath.Base(strings.TrimSpace(name))
	name = strings.ReplaceAll(name, "\\", "")
	if name == "" || name == "." || name == string(filepath.Separator) {
		return "attachment"
	}
	if len(name) > 120 {
		ext := filepath.Ext(name)
		name = name[:120-len(ext)] + ext
	}
	return name
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

// Conversation is one thread in the messenger's sidebar: who it is with, the
// most recent message either way, and how many of theirs are still unread.
type Conversation struct {
	User        domain.User
	Support     bool
	LastMessage domain.Message
	UnreadCount int
}

// ListConversations groups the user's mailbox by counterparty, most recently
// active first. Unlike GetInbox it has no read side-effects — opening the
// messenger must not mark everything read.
func (s *MessagingService) ListConversations(ctx context.Context, userID uuid.UUID) ([]Conversation, error) {
	otherIDs, err := s.messages.ListCounterpartIDs(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(otherIDs) == 0 {
		return []Conversation{}, nil
	}

	unread, err := s.messages.UnreadCountsBySender(ctx, userID)
	if err != nil {
		return nil, err
	}
	byID, err := s.users.ListByIDs(ctx, otherIDs)
	if err != nil {
		return nil, err
	}

	out := make([]Conversation, 0, len(otherIDs))
	for _, otherID := range otherIDs {
		u, ok := byID[otherID]
		if !ok {
			continue
		}
		last, err := s.messages.LastInThread(ctx, userID, otherID)
		if err != nil {
			// A thread can vanish between the two queries if the other side
			// deleted their last message; skip it rather than failing the list.
			if errors.Is(err, domain.ErrNotFound) {
				continue
			}
			return nil, err
		}
		out = append(out, Conversation{
			User:        u,
			Support:     u.Role == domain.UserRoleAdmin,
			LastMessage: last,
			UnreadCount: unread[otherID],
		})
	}
	return out, nil
}

// GetThread returns the full exchange with one person, oldest first, and marks
// what they sent as read — the messenger equivalent of opening a chat.
func (s *MessagingService) GetThread(ctx context.Context, userID, otherID uuid.UUID, limit, offset int) ([]domain.Message, error) {
	if userID == otherID {
		return nil, ErrMessageSelfRecipient
	}
	messages, err := s.messages.ListThread(ctx, userID, otherID, limit, offset)
	if err != nil {
		return nil, err
	}

	changed, err := s.messages.MarkThreadAsRead(ctx, userID, otherID)
	if err != nil {
		return nil, err
	}
	if changed == 0 {
		return messages, nil
	}

	count, err := s.messages.GetUnreadCount(ctx, userID)
	if err != nil {
		return nil, err
	}
	if err := s.redis.Set(ctx, unreadRedisKey(userID), count, 0).Err(); err != nil {
		return nil, fmt.Errorf("redis set unread on thread read: %w", err)
	}
	s.broadcastUnreadCount(userID, count)

	now := time.Now().UTC()
	for i := range messages {
		if messages[i].RecipientID == userID && messages[i].ReadAt == nil {
			readAt := now
			messages[i].ReadAt = &readAt
		}
	}
	return messages, nil
}

func (s *MessagingService) GetSent(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.Message, error) {
	return s.messages.ListSent(ctx, userID, limit, offset)
}

// DeleteForUser removes a message. Deleting one you sent withdraws it from the
// conversation entirely and leaves a tombstone both sides can see; deleting one
// you received only hides it from your own mailbox.
func (s *MessagingService) DeleteForUser(ctx context.Context, messageID, userID uuid.UUID) error {
	existing, err := s.messages.GetByID(ctx, messageID)
	if err != nil {
		return err
	}
	if existing.SenderID != userID && existing.RecipientID != userID {
		return domain.ErrForbidden
	}

	if existing.SenderID == userID {
		if err := s.messages.DeleteForEveryone(ctx, messageID); err != nil {
			return err
		}
		s.broadcastMessageDeleted(existing.RecipientID, existing)
		s.broadcastMessageDeleted(existing.SenderID, existing)
	} else if err := s.messages.DeleteForUser(ctx, messageID, userID); err != nil {
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

// RelayTyping tells `recipientID` that `senderID` is composing a message. It is
// a transient hint: nothing is stored, and it is dropped unless the two are
// allowed to correspond, so it cannot be used to probe for other users.
func (s *MessagingService) RelayTyping(ctx context.Context, senderID, recipientID uuid.UUID) {
	if senderID == recipientID {
		return
	}
	allowed, err := s.CanCorrespondWith(ctx, senderID, recipientID)
	if err != nil || !allowed {
		return
	}

	payload, err := json.Marshal(map[string]any{"user_id": senderID.String()})
	if err != nil {
		return
	}
	out, err := json.Marshal(wsOutbound{
		Type:    wshub.TypeTyping,
		Payload: payload,
	})
	if err != nil {
		return
	}
	s.hub.SendToUser(recipientID, out)
}

// ToggleReaction adds an emoji to a message, or removes it when the user
// already reacted with that emoji. Only the two people in the thread may react.
func (s *MessagingService) ToggleReaction(ctx context.Context, messageID, userID uuid.UUID, emoji string) error {
	emoji = strings.TrimSpace(emoji)
	if emoji == "" || len([]rune(emoji)) > 8 {
		return ErrInvalidReaction
	}

	msg, err := s.messages.GetByID(ctx, messageID)
	if err != nil {
		return err
	}
	if msg.SenderID != userID && msg.RecipientID != userID {
		return domain.ErrForbidden
	}
	if msg.DeletedForEveryone {
		return ErrMessageDeleted
	}

	existing, err := s.messages.ListReactions(ctx, []uuid.UUID{messageID})
	if err != nil {
		return err
	}
	for _, r := range existing[messageID] {
		if r.UserID == userID && r.Emoji == emoji {
			if err := s.messages.RemoveReaction(ctx, messageID, userID, emoji); err != nil {
				return err
			}
			s.broadcastReaction(msg, messageID)
			return nil
		}
	}

	if err := s.messages.AddReaction(ctx, messageID, userID, emoji); err != nil {
		return err
	}
	s.broadcastReaction(msg, messageID)
	return nil
}

// HydrateThread attaches the reactions and quoted previews a rendered thread
// needs, in two batch queries rather than one per message.
func (s *MessagingService) HydrateThread(ctx context.Context, msgs []domain.Message) ([]domain.Message, error) {
	if len(msgs) == 0 {
		return msgs, nil
	}

	ids := make([]uuid.UUID, 0, len(msgs))
	replyIDs := make([]uuid.UUID, 0, len(msgs))
	for _, m := range msgs {
		ids = append(ids, m.ID)
		if m.ReplyToID != nil {
			replyIDs = append(replyIDs, *m.ReplyToID)
		}
	}

	reactions, err := s.messages.ListReactions(ctx, ids)
	if err != nil {
		return nil, err
	}
	previews, err := s.messages.ListPreviews(ctx, replyIDs)
	if err != nil {
		return nil, err
	}

	for i := range msgs {
		// A withdrawn message is a tombstone: no reactions, no quoted content.
		if msgs[i].DeletedForEveryone {
			msgs[i].Reactions = nil
			continue
		}
		msgs[i].Reactions = reactions[msgs[i].ID]
		if msgs[i].ReplyToID != nil {
			if preview, ok := previews[*msgs[i].ReplyToID]; ok {
				msgs[i].ReplyTo = &preview
			}
		}
	}
	return msgs, nil
}

func (s *MessagingService) broadcastMessageDeleted(to uuid.UUID, msg domain.Message) {
	// Both party ids travel with the event: each side keys its thread cache by
	// the *other* person, so neither can resolve it from one id alone.
	payload, err := json.Marshal(map[string]any{
		"id":           msg.ID.String(),
		"sender_id":    msg.SenderID.String(),
		"recipient_id": msg.RecipientID.String(),
	})
	if err != nil {
		return
	}
	out, err := json.Marshal(wsOutbound{Type: wshub.TypeMessageDeleted, Payload: payload})
	if err != nil {
		return
	}
	s.hub.SendToUser(to, out)
}

func (s *MessagingService) broadcastReaction(msg domain.Message, messageID uuid.UUID) {
	payload, err := json.Marshal(map[string]any{
		"id":           messageID.String(),
		"sender_id":    msg.SenderID.String(),
		"recipient_id": msg.RecipientID.String(),
	})
	if err != nil {
		return
	}
	out, err := json.Marshal(wsOutbound{Type: wshub.TypeReactionChanged, Payload: payload})
	if err != nil {
		return
	}
	s.hub.SendToUser(msg.SenderID, out)
	s.hub.SendToUser(msg.RecipientID, out)
}

func (s *MessagingService) broadcastNewMessage(recipientID uuid.UUID, msg domain.Message) {
	payload, err := json.Marshal(map[string]any{
		"id":           msg.ID.String(),
		"sender_id":    msg.SenderID.String(),
		"recipient_id": msg.RecipientID.String(),
		"subject":      msg.Subject,
		"body":         msg.Body,
		"image_url":    msg.ImageURL,
		"file_url":     msg.FileURL,
		"file_name":    msg.FileName,
		"gif_url":      msg.GifURL,
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
