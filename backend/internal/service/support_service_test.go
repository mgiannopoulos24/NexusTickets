package service

import (
	"context"
	"errors"
	"sort"
	"testing"
	"time"

	"github.com/google/uuid"

	"nexustickets/internal/domain"
	wshub "nexustickets/internal/handler/ws"
)

type mockSupportRepo struct {
	tickets  map[uuid.UUID]domain.SupportTicket
	messages map[uuid.UUID][]domain.SupportMessage
	seq      int
}

func newMockSupportRepo() *mockSupportRepo {
	return &mockSupportRepo{
		tickets:  make(map[uuid.UUID]domain.SupportTicket),
		messages: make(map[uuid.UUID][]domain.SupportMessage),
	}
}

func (m *mockSupportRepo) tick() time.Time {
	m.seq++
	return time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC).Add(time.Duration(m.seq) * time.Minute)
}

func (m *mockSupportRepo) CreateTicket(_ context.Context, t domain.SupportTicket, opening domain.SupportMessage) (domain.SupportTicket, error) {
	now := m.tick()
	t.ID = uuid.New()
	t.CreatedAt, t.UpdatedAt = now, now
	m.tickets[t.ID] = t
	opening.ID = uuid.New()
	opening.TicketID = t.ID
	opening.CreatedAt = now
	m.messages[t.ID] = append(m.messages[t.ID], opening)
	return t, nil
}

func (m *mockSupportRepo) GetTicket(_ context.Context, id uuid.UUID) (domain.SupportTicket, error) {
	t, ok := m.tickets[id]
	if !ok {
		return domain.SupportTicket{}, domain.ErrNotFound
	}
	return t, nil
}

func (m *mockSupportRepo) list(keep func(domain.SupportTicket) bool, limit, offset int) ([]domain.SupportTicket, int, error) {
	var all []domain.SupportTicket
	for _, t := range m.tickets {
		if keep(t) {
			all = append(all, t)
		}
	}
	sort.Slice(all, func(i, j int) bool { return all[i].UpdatedAt.After(all[j].UpdatedAt) })
	total := len(all)
	if offset > total {
		offset = total
	}
	end := offset + limit
	if limit < 1 || end > total {
		end = total
	}
	return all[offset:end], total, nil
}

func (m *mockSupportRepo) ListTicketsByUser(_ context.Context, uid uuid.UUID, limit, offset int) ([]domain.SupportTicket, int, error) {
	return m.list(func(t domain.SupportTicket) bool { return t.UserID == uid }, limit, offset)
}

func (m *mockSupportRepo) ListTickets(_ context.Context, status *domain.SupportTicketStatus, limit, offset int) ([]domain.SupportTicket, int, error) {
	return m.list(func(t domain.SupportTicket) bool { return status == nil || t.Status == *status }, limit, offset)
}

func (m *mockSupportRepo) CountTicketsByStatus(_ context.Context) (map[domain.SupportTicketStatus]int, error) {
	out := map[domain.SupportTicketStatus]int{}
	for _, t := range m.tickets {
		out[t.Status]++
	}
	return out, nil
}

func (m *mockSupportRepo) AddMessage(_ context.Context, msg domain.SupportMessage, status domain.SupportTicketStatus) (domain.SupportMessage, error) {
	t, ok := m.tickets[msg.TicketID]
	if !ok {
		return domain.SupportMessage{}, domain.ErrNotFound
	}
	msg.ID = uuid.New()
	msg.CreatedAt = m.tick()
	m.messages[msg.TicketID] = append(m.messages[msg.TicketID], msg)
	t.Status = status
	t.UpdatedAt = msg.CreatedAt
	m.tickets[msg.TicketID] = t
	return msg, nil
}

func (m *mockSupportRepo) ListMessages(_ context.Context, id uuid.UUID) ([]domain.SupportMessage, error) {
	return m.messages[id], nil
}

func (m *mockSupportRepo) SetTicketStatus(_ context.Context, id uuid.UUID, status domain.SupportTicketStatus) error {
	t, ok := m.tickets[id]
	if !ok {
		return domain.ErrNotFound
	}
	t.Status = status
	t.UpdatedAt = m.tick()
	m.tickets[id] = t
	return nil
}

type supportFixture struct {
	svc   *SupportService
	repo  *mockSupportRepo
	user  domain.User
	admin domain.User
	other domain.User
}

func newSupportFixture(t *testing.T) supportFixture {
	t.Helper()
	users := newMockUserRepo()
	repo := newMockSupportRepo()
	return supportFixture{
		svc:   NewSupportService(repo, users, wshub.NewHub()),
		repo:  repo,
		user:  mustUser(t, users, domain.UserRoleAttendee),
		admin: mustUser(t, users, domain.UserRoleAdmin),
		other: mustUser(t, users, domain.UserRoleOrganizer),
	}
}

func TestSupportService_OpenValidation(t *testing.T) {
	f := newSupportFixture(t)
	ctx := context.Background()
	if _, err := f.svc.Open(ctx, f.user.ID, "", "body"); !errors.Is(err, ErrSupportSubjectBodyRequired) {
		t.Fatalf("empty subject: expected ErrSupportSubjectBodyRequired, got %v", err)
	}
	if _, err := f.svc.Open(ctx, f.user.ID, "subject", "  "); !errors.Is(err, ErrSupportSubjectBodyRequired) {
		t.Fatalf("empty body: expected ErrSupportSubjectBodyRequired, got %v", err)
	}
}

func TestSupportService_OpenAndThread(t *testing.T) {
	f := newSupportFixture(t)
	ctx := context.Background()

	ticket, err := f.svc.Open(ctx, f.user.ID, "  Login problem  ", "  I cannot sign in.  ")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if ticket.Subject != "Login problem" || ticket.Status != domain.SupportTicketOpen {
		t.Fatalf("unexpected ticket %+v", ticket)
	}

	thread, err := f.svc.Get(ctx, f.user.ID, domain.UserRoleAttendee, ticket.ID)
	if err != nil {
		t.Fatalf("get as owner: %v", err)
	}
	if len(thread.Messages) != 1 || thread.Messages[0].Body != "I cannot sign in." || thread.Messages[0].AuthorID != f.user.ID {
		t.Fatalf("expected the opening message from the owner, got %+v", thread.Messages)
	}

	if _, err := f.svc.Get(ctx, f.admin.ID, domain.UserRoleAdmin, ticket.ID); err != nil {
		t.Fatalf("get as admin: %v", err)
	}
	if _, err := f.svc.Get(ctx, f.other.ID, domain.UserRoleOrganizer, ticket.ID); !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("get as stranger: expected ErrForbidden, got %v", err)
	}
	if _, err := f.svc.Get(ctx, f.user.ID, domain.UserRoleAttendee, uuid.New()); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("unknown ticket: expected ErrNotFound, got %v", err)
	}
}

func TestSupportService_ReplyMovesStatus(t *testing.T) {
	f := newSupportFixture(t)
	ctx := context.Background()
	ticket, _ := f.svc.Open(ctx, f.user.ID, "Q", "A question")

	// Admin answers → answered.
	if _, err := f.svc.Reply(ctx, f.admin.ID, domain.UserRoleAdmin, ticket.ID, "Here is the answer."); err != nil {
		t.Fatalf("admin reply: %v", err)
	}
	if got, _ := f.repo.GetTicket(ctx, ticket.ID); got.Status != domain.SupportTicketAnswered {
		t.Fatalf("expected answered after admin reply, got %s", got.Status)
	}

	// User follows up → back to open.
	if _, err := f.svc.Reply(ctx, f.user.ID, domain.UserRoleAttendee, ticket.ID, "One more thing."); err != nil {
		t.Fatalf("user reply: %v", err)
	}
	if got, _ := f.repo.GetTicket(ctx, ticket.ID); got.Status != domain.SupportTicketOpen {
		t.Fatalf("expected open after user reply, got %s", got.Status)
	}

	thread, _ := f.svc.Get(ctx, f.user.ID, domain.UserRoleAttendee, ticket.ID)
	if len(thread.Messages) != 3 {
		t.Fatalf("expected 3 messages in the thread, got %d", len(thread.Messages))
	}

	// Strangers and empty replies are refused.
	if _, err := f.svc.Reply(ctx, f.other.ID, domain.UserRoleOrganizer, ticket.ID, "hi"); !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("stranger reply: expected ErrForbidden, got %v", err)
	}
	if _, err := f.svc.Reply(ctx, f.user.ID, domain.UserRoleAttendee, ticket.ID, " "); !errors.Is(err, ErrSupportSubjectBodyRequired) {
		t.Fatalf("empty reply: expected ErrSupportSubjectBodyRequired, got %v", err)
	}
}

func TestSupportService_CloseIsFinal(t *testing.T) {
	f := newSupportFixture(t)
	ctx := context.Background()
	ticket, _ := f.svc.Open(ctx, f.user.ID, "Q", "A question")

	if _, err := f.svc.Close(ctx, f.other.ID, domain.UserRoleOrganizer, ticket.ID); !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("stranger close: expected ErrForbidden, got %v", err)
	}
	closed, err := f.svc.Close(ctx, f.admin.ID, domain.UserRoleAdmin, ticket.ID)
	if err != nil {
		t.Fatalf("close: %v", err)
	}
	if closed.Status != domain.SupportTicketClosed {
		t.Fatalf("expected closed, got %s", closed.Status)
	}
	// Idempotent, and no more replies from either side.
	if _, err := f.svc.Close(ctx, f.user.ID, domain.UserRoleAttendee, ticket.ID); err != nil {
		t.Fatalf("second close: %v", err)
	}
	if _, err := f.svc.Reply(ctx, f.user.ID, domain.UserRoleAttendee, ticket.ID, "still there?"); !errors.Is(err, ErrSupportTicketClosed) {
		t.Fatalf("reply on closed: expected ErrSupportTicketClosed, got %v", err)
	}
}

func TestSupportService_Lists(t *testing.T) {
	f := newSupportFixture(t)
	ctx := context.Background()
	t1, _ := f.svc.Open(ctx, f.user.ID, "first", "…")
	t2, _ := f.svc.Open(ctx, f.other.ID, "second", "…")
	_, _ = f.svc.Reply(ctx, f.admin.ID, domain.UserRoleAdmin, t1.ID, "answer")

	mine, err := f.svc.ListMine(ctx, f.user.ID, 20, 0)
	if err != nil {
		t.Fatalf("list mine: %v", err)
	}
	if mine.Total != 1 || mine.Tickets[0].ID != t1.ID {
		t.Fatalf("expected only the user's own ticket, got %+v", mine)
	}

	all, err := f.svc.ListAll(ctx, nil, 20, 0)
	if err != nil {
		t.Fatalf("list all: %v", err)
	}
	if all.Total != 2 || all.Tickets[0].ID != t1.ID {
		t.Fatalf("expected both tickets, most recently active first, got %+v", all)
	}

	open := domain.SupportTicketOpen
	onlyOpen, _ := f.svc.ListAll(ctx, &open, 20, 0)
	if onlyOpen.Total != 1 || onlyOpen.Tickets[0].ID != t2.ID {
		t.Fatalf("expected only the unanswered ticket, got %+v", onlyOpen)
	}
	bogus := domain.SupportTicketStatus("weird")
	if _, err := f.svc.ListAll(ctx, &bogus, 20, 0); err == nil {
		t.Fatalf("expected an error for an unknown status")
	}

	counts, _ := f.svc.Counts(ctx)
	if counts[domain.SupportTicketOpen] != 1 || counts[domain.SupportTicketAnswered] != 1 {
		t.Fatalf("unexpected counts %+v", counts)
	}
}
