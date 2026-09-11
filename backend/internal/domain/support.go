package domain

import (
	"time"

	"github.com/google/uuid"
)

// SupportTicketStatus is the lifecycle of a support request.
type SupportTicketStatus string

const (
	// SupportTicketOpen: waiting for the administration.
	SupportTicketOpen SupportTicketStatus = "open"
	// SupportTicketAnswered: the administration replied last; the user's turn.
	SupportTicketAnswered SupportTicketStatus = "answered"
	// SupportTicketClosed: settled; no further replies.
	SupportTicketClosed SupportTicketStatus = "closed"
)

// ValidSupportTicketStatus reports whether s is one of the three states.
func ValidSupportTicketStatus(s SupportTicketStatus) bool {
	switch s {
	case SupportTicketOpen, SupportTicketAnswered, SupportTicketClosed:
		return true
	default:
		return false
	}
}

// SupportTicket is a request from a registered user to the administration.
// It is separate from the organizer/attendee mailbox: a ticket has one owner,
// is handled by whichever administrator picks it up, and carries its own
// thread of replies.
type SupportTicket struct {
	ID     uuid.UUID
	UserID uuid.UUID

	Subject string
	Status  SupportTicketStatus

	CreatedAt time.Time
	// UpdatedAt moves on every reply and status change, so lists can sort by
	// recent activity.
	UpdatedAt time.Time
}

// SupportMessage is one entry of a ticket's thread, from the user or from an
// administrator.
type SupportMessage struct {
	ID       uuid.UUID
	TicketID uuid.UUID
	AuthorID uuid.UUID

	Body string

	CreatedAt time.Time
}
