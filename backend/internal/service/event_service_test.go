package service

import (
	"context"
	"errors"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"nexustickets/internal/domain"
	repo "nexustickets/internal/repository"
)

type mockEventRepo struct {
	events      map[uuid.UUID]domain.Event
	ticketTypes map[uuid.UUID][]domain.TicketType
	categories  map[uuid.UUID][]domain.Category
	photos      map[uuid.UUID][]domain.EventPhoto
}

func newMockEventRepo() *mockEventRepo {
	return &mockEventRepo{
		events:      make(map[uuid.UUID]domain.Event),
		ticketTypes: make(map[uuid.UUID][]domain.TicketType),
		categories:  make(map[uuid.UUID][]domain.Category),
		photos:      make(map[uuid.UUID][]domain.EventPhoto),
	}
}

func (m *mockEventRepo) Create(_ context.Context, event domain.Event) (domain.Event, error) {
	event.ID = uuid.New()
	event.CreatedAt = time.Now().UTC()
	event.UpdatedAt = time.Now().UTC()
	event.Status = domain.EventStatusDraft
	m.events[event.ID] = event
	return event, nil
}

func (m *mockEventRepo) GetByID(_ context.Context, id uuid.UUID) (domain.Event, error) {
	e, ok := m.events[id]
	if !ok {
		return domain.Event{}, domain.ErrNotFound
	}
	return e, nil
}

func (m *mockEventRepo) ListOrganizer(_ context.Context, orgID uuid.UUID, limit, offset int) ([]domain.Event, error) {
	var out []domain.Event
	for _, e := range m.events {
		if e.OrganizerID == orgID {
			out = append(out, e)
		}
	}
	return out, nil
}

func (m *mockEventRepo) ListPublic(_ context.Context, limit, offset int) ([]domain.Event, error) {
	var out []domain.Event
	for _, e := range m.events {
		if e.Status == domain.EventStatusPublished {
			out = append(out, e)
		}
	}
	return out, nil
}

func (m *mockEventRepo) Search(_ context.Context, params repo.SearchEventsParams, limit, offset int) ([]domain.Event, bool, error) {
	var out []domain.Event
	for _, e := range m.events {
		if params.Status != "" && e.Status != params.Status {
			continue
		}
		out = append(out, e)
	}
	hasMore := len(out) > limit
	if hasMore {
		out = out[:limit]
	}
	return out, hasMore, nil
}

func (m *mockEventRepo) Update(_ context.Context, event domain.Event) (domain.Event, error) {
	e, ok := m.events[event.ID]
	if !ok {
		return domain.Event{}, domain.ErrNotFound
	}
	event.CreatedAt = e.CreatedAt
	event.UpdatedAt = time.Now().UTC()
	m.events[event.ID] = event
	return event, nil
}

func (m *mockEventRepo) Delete(_ context.Context, id uuid.UUID) error {
	if _, ok := m.events[id]; !ok {
		return domain.ErrNotFound
	}
	delete(m.events, id)
	return nil
}

func (m *mockEventRepo) SetStatus(_ context.Context, id uuid.UUID, status domain.EventStatus) error {
	e, ok := m.events[id]
	if !ok {
		return domain.ErrNotFound
	}
	e.Status = status
	m.events[id] = e
	return nil
}

func (m *mockEventRepo) MarkCompleted(_ context.Context, before time.Time) (int64, error) {
	var n int64
	for id, ev := range m.events {
		if ev.Status == domain.EventStatusPublished && ev.EndAt.Before(before) {
			ev.Status = domain.EventStatusCompleted
			m.events[id] = ev
			n++
		}
	}
	return n, nil
}

func (m *mockEventRepo) SetCategories(_ context.Context, eid uuid.UUID, cids []uuid.UUID) error {
	var cats []domain.Category
	for _, cid := range cids {
		cats = append(cats, domain.Category{ID: cid, Name: "music"})
	}
	m.categories[eid] = cats
	return nil
}

func (m *mockEventRepo) GetCategories(_ context.Context, eid uuid.UUID) ([]domain.Category, error) {
	return m.categories[eid], nil
}

func (m *mockEventRepo) SetTicketTypes(_ context.Context, eid uuid.UUID, tts []domain.TicketType) error {
	// Mirror the real repository: rows arriving without an ID get one, and rows
	// that name an existing ID keep it. Without this every ticket type shared
	// uuid.Nil and any lookup by ID matched all of them.
	cp := make([]domain.TicketType, len(tts))
	copy(cp, tts)
	for i := range cp {
		if cp[i].ID == uuid.Nil {
			cp[i].ID = uuid.New()
		}
		cp[i].EventID = eid
	}
	m.ticketTypes[eid] = cp
	return nil
}

func (m *mockEventRepo) GetTicketTypes(_ context.Context, eid uuid.UUID) ([]domain.TicketType, error) {
	return m.ticketTypes[eid], nil
}

func (m *mockEventRepo) GetPhotos(_ context.Context, eid uuid.UUID) ([]domain.EventPhoto, error) {
	return m.photos[eid], nil
}

func (m *mockEventRepo) ListAdmin(_ context.Context, q string, status *domain.EventStatus, limit, offset int) ([]domain.Event, int, error) {
	var all []domain.Event
	for _, ev := range m.events {
		if status != nil && ev.Status != *status {
			continue
		}
		if q != "" && !strings.Contains(strings.ToLower(ev.Title+" "+ev.Venue+" "+ev.City), strings.ToLower(q)) {
			continue
		}
		all = append(all, ev)
	}
	sort.Slice(all, func(i, j int) bool { return all[i].ID.String() < all[j].ID.String() })
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

func (m *mockEventRepo) ListForExport(_ context.Context, limit, offset int) ([]domain.Event, error) {
	var out []domain.Event
	for _, e := range m.events {
		out = append(out, e)
	}
	return out, nil
}

func (m *mockEventRepo) ListTicketTypesByEventIDs(_ context.Context, eids []uuid.UUID) (map[uuid.UUID][]domain.TicketType, error) {
	out := make(map[uuid.UUID][]domain.TicketType)
	for _, eid := range eids {
		out[eid] = m.ticketTypes[eid]
	}
	return out, nil
}

func (m *mockEventRepo) ListCategoriesByEventIDs(_ context.Context, eids []uuid.UUID) (map[uuid.UUID][]domain.Category, error) {
	out := make(map[uuid.UUID][]domain.Category)
	for _, eid := range eids {
		out[eid] = m.categories[eid]
	}
	return out, nil
}

func (m *mockEventRepo) ListPhotosByEventIDs(_ context.Context, eids []uuid.UUID) (map[uuid.UUID][]domain.EventPhoto, error) {
	out := make(map[uuid.UUID][]domain.EventPhoto)
	for _, eid := range eids {
		out[eid] = m.photos[eid]
	}
	return out, nil
}

type mockCategoryRepo struct {
	cats    map[uuid.UUID]domain.Category
	byName  map[string]domain.Category
	autoInc int
}

func newMockCategoryRepo() *mockCategoryRepo {
	return &mockCategoryRepo{
		cats:   make(map[uuid.UUID]domain.Category),
		byName: make(map[string]domain.Category),
	}
}

func (m *mockCategoryRepo) Create(_ context.Context, c domain.Category) (domain.Category, error) {
	c.ID = uuid.New()
	c.CreatedAt = time.Now().UTC()
	m.cats[c.ID] = c
	m.byName[c.Name] = c
	return c, nil
}

func (m *mockCategoryRepo) GetByID(_ context.Context, id uuid.UUID) (domain.Category, error) {
	c, ok := m.cats[id]
	if !ok {
		return domain.Category{}, domain.ErrNotFound
	}
	return c, nil
}

func (m *mockCategoryRepo) GetByName(_ context.Context, name string) (domain.Category, error) {
	c, ok := m.byName[name]
	if !ok {
		return domain.Category{}, domain.ErrNotFound
	}
	return c, nil
}

func (m *mockCategoryRepo) ListAll(_ context.Context) ([]domain.Category, error) {
	var out []domain.Category
	for _, c := range m.cats {
		out = append(out, c)
	}
	return out, nil
}

type mockViewsRepo struct {
	views map[string]struct{}
}

func newMockViewsRepo() *mockViewsRepo {
	return &mockViewsRepo{views: make(map[string]struct{})}
}

func (m *mockViewsRepo) Record(_ context.Context, userID, eventID uuid.UUID) error {
	m.views[userID.String()+":"+eventID.String()] = struct{}{}
	return nil
}

func (m *mockViewsRepo) CountByEvent(_ context.Context, eventID uuid.UUID) (int, error) {
	return len(m.views), nil
}

func (m *mockViewsRepo) ListAll(_ context.Context) ([]domain.UserEventView, error) {
	out := make([]domain.UserEventView, 0, len(m.views))
	for key := range m.views {
		parts := strings.SplitN(key, ":", 2)
		if len(parts) != 2 {
			continue
		}
		userID, err := uuid.Parse(parts[0])
		if err != nil {
			continue
		}
		eventID, err := uuid.Parse(parts[1])
		if err != nil {
			continue
		}
		out = append(out, domain.UserEventView{UserID: userID, EventID: eventID})
	}
	return out, nil
}

type mockEventPhotoRepo struct {
	photos map[uuid.UUID]domain.EventPhoto
}

func newMockEventPhotoRepo() *mockEventPhotoRepo {
	return &mockEventPhotoRepo{photos: make(map[uuid.UUID]domain.EventPhoto)}
}

func (m *mockEventPhotoRepo) Add(_ context.Context, p domain.EventPhoto) (domain.EventPhoto, error) {
	p.ID = uuid.New()
	p.CreatedAt = time.Now().UTC()
	m.photos[p.ID] = p
	return p, nil
}

func (m *mockEventPhotoRepo) ListByEvent(_ context.Context, eid uuid.UUID) ([]domain.EventPhoto, error) {
	var out []domain.EventPhoto
	for _, p := range m.photos {
		if p.EventID == eid {
			out = append(out, p)
		}
	}
	return out, nil
}

func (m *mockEventPhotoRepo) Delete(_ context.Context, pid uuid.UUID) error {
	delete(m.photos, pid)
	return nil
}

func TestEventService_Create(t *testing.T) {
	events := newMockEventRepo()
	bookings := newMockBookingRepo()
	categories := newMockCategoryRepo()
	photos := newMockEventPhotoRepo()
	views := newMockViewsRepo()

	svc := NewEventService(events, bookings, categories, photos, views, "", nil)

	orgID := uuid.New()
	startAt := time.Now().Add(24 * time.Hour)
	endAt := startAt.Add(2 * time.Hour)

	t.Run("success", func(t *testing.T) {
		ev, cats, err := svc.Create(context.Background(), orgID, CreateEventInput{
			Title:       "Test Event",
			Description: "A test event",
			Venue:       "Test Venue",
			City:        "Athens",
			StartAt:     startAt,
			EndAt:       endAt,
			Capacity:    100,
			Categories:  []string{"General"},
			TicketTypes: []TicketTypeInput{{Name: "General", Price: 10, Quantity: 100}},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ev.Title != "Test Event" {
			t.Fatalf("expected 'Test Event', got %s", ev.Title)
		}
		if ev.Status != domain.EventStatusDraft {
			t.Fatalf("expected draft status, got %s", ev.Status)
		}
		if ev.OrganizerID != orgID {
			t.Fatalf("expected organizer %s, got %s", orgID, ev.OrganizerID)
		}
		if len(cats) != 1 {
			t.Fatalf("expected 1 category, got %d", len(cats))
		}
	})

	t.Run("missing required fields", func(t *testing.T) {
		_, _, err := svc.Create(context.Background(), orgID, CreateEventInput{
			Title:   "",
			Venue:   "Venue",
			City:    "City",
			StartAt: startAt,
			EndAt:   endAt,
		})
		if err == nil {
			t.Fatal("expected error for missing fields")
		}
	})

	t.Run("capacity exceeded", func(t *testing.T) {
		_, _, err := svc.Create(context.Background(), orgID, CreateEventInput{
			Title:       "Event",
			Description: "Desc",
			Venue:       "Venue",
			City:        "City",
			StartAt:     startAt,
			EndAt:       endAt,
			Capacity:    10,
			TicketTypes: []TicketTypeInput{
				{Name: "VIP", Price: 50, Quantity: 20},
			},
			Categories: []string{"General"},
		})
		if !errors.Is(err, domain.ErrCapacityExceeded) {
			t.Fatalf("expected ErrCapacityExceeded, got %v", err)
		}
	})

	t.Run("with categories and ticket types", func(t *testing.T) {
		_, err := categories.Create(context.Background(), domain.Category{Name: "Music"})
		if err != nil {
			t.Fatal(err)
		}
		ev, cats, err := svc.Create(context.Background(), orgID, CreateEventInput{
			Title:       "Concert",
			Description: "A concert",
			Venue:       "Stage",
			City:        "Thessaloniki",
			StartAt:     startAt,
			EndAt:       endAt,
			Capacity:    200,
			Categories:  []string{"Music"},
			TicketTypes: []TicketTypeInput{
				{Name: "General", Price: 20, Quantity: 100},
				{Name: "VIP", Price: 50, Quantity: 50},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(cats) != 1 {
			t.Fatalf("expected 1 category, got %d", len(cats))
		}
		if len(ev.TicketTypes) != 2 {
			t.Fatalf("expected 2 ticket types, got %d", len(ev.TicketTypes))
		}
	})
}

func TestEventService_PublishAndCancel(t *testing.T) {
	events := newMockEventRepo()
	svc := NewEventService(events, newMockBookingRepo(), newMockCategoryRepo(), newMockEventPhotoRepo(), newMockViewsRepo(), "", nil)

	orgID := uuid.New()
	ev, _, _ := svc.Create(context.Background(), orgID, CreateEventInput{
		Title: "Test", Description: "Desc", Venue: "V", City: "C",
		StartAt: time.Now().Add(time.Hour), EndAt: time.Now().Add(2 * time.Hour),
		Capacity:    100,
		Categories:  []string{"General"},
		TicketTypes: []TicketTypeInput{{Name: "General", Price: 10, Quantity: 100}},
	})

	t.Run("publish", func(t *testing.T) {
		published, _, err := svc.Publish(context.Background(), orgID, ev.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if published.Status != domain.EventStatusPublished {
			t.Fatalf("expected published, got %s", published.Status)
		}
	})

	t.Run("publish again should fail", func(t *testing.T) {
		_, _, err := svc.Publish(context.Background(), orgID, ev.ID)
		if !errors.Is(err, domain.ErrInvalidEventState) {
			t.Fatalf("expected ErrInvalidEventState, got %v", err)
		}
	})

	t.Run("cancel", func(t *testing.T) {
		cancelled, _, err := svc.Cancel(context.Background(), orgID, ev.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if cancelled.Status != domain.EventStatusCancelled {
			t.Fatalf("expected cancelled, got %s", cancelled.Status)
		}
	})

	t.Run("cancel draft should fail", func(t *testing.T) {
		draft, _, _ := svc.Create(context.Background(), orgID, CreateEventInput{
			Title: "Draft", Description: "D", Venue: "V", City: "C",
			StartAt: time.Now().Add(time.Hour), EndAt: time.Now().Add(2 * time.Hour),
			Capacity:    100,
			Categories:  []string{"General"},
			TicketTypes: []TicketTypeInput{{Name: "General", Price: 10, Quantity: 100}},
		})
		_, _, err := svc.Cancel(context.Background(), orgID, draft.ID)
		if !errors.Is(err, domain.ErrEventNotCancellable) {
			t.Fatalf("expected ErrEventNotCancellable, got %v", err)
		}
	})

	t.Run("forbidden user", func(t *testing.T) {
		_, _, err := svc.Publish(context.Background(), uuid.New(), ev.ID)
		if !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got %v", err)
		}
	})
}

func TestEventService_Delete(t *testing.T) {
	events := newMockEventRepo()
	svc := NewEventService(events, newMockBookingRepo(), newMockCategoryRepo(), newMockEventPhotoRepo(), newMockViewsRepo(), "", nil)

	orgID := uuid.New()
	ev, _, _ := svc.Create(context.Background(), orgID, CreateEventInput{
		Title: "Test", Description: "Desc", Venue: "V", City: "C",
		StartAt: time.Now().Add(time.Hour), EndAt: time.Now().Add(2 * time.Hour),
		Capacity:    100,
		Categories:  []string{"General"},
		TicketTypes: []TicketTypeInput{{Name: "General", Price: 10, Quantity: 100}},
	})

	t.Run("delete draft", func(t *testing.T) {
		draft, _, _ := svc.Create(context.Background(), orgID, CreateEventInput{
			Title: "DraftDel", Description: "D", Venue: "V", City: "C",
			StartAt: time.Now().Add(time.Hour), EndAt: time.Now().Add(2 * time.Hour),
			Capacity:    100,
			Categories:  []string{"General"},
			TicketTypes: []TicketTypeInput{{Name: "General", Price: 10, Quantity: 100}},
		})
		err := svc.Delete(context.Background(), orgID, draft.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("delete published without bookings", func(t *testing.T) {
		svc.Publish(context.Background(), orgID, ev.ID)
		err := svc.Delete(context.Background(), orgID, ev.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("forbidden user", func(t *testing.T) {
		draft, _, _ := svc.Create(context.Background(), orgID, CreateEventInput{
			Title: "F", Description: "D", Venue: "V", City: "C",
			StartAt: time.Now().Add(time.Hour), EndAt: time.Now().Add(2 * time.Hour),
			Capacity:    100,
			Categories:  []string{"General"},
			TicketTypes: []TicketTypeInput{{Name: "General", Price: 10, Quantity: 100}},
		})
		err := svc.Delete(context.Background(), uuid.New(), draft.ID)
		if !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got %v", err)
		}
	})
}

func TestEventService_ListAndSearch(t *testing.T) {
	events := newMockEventRepo()
	svc := NewEventService(events, newMockBookingRepo(), newMockCategoryRepo(), newMockEventPhotoRepo(), newMockViewsRepo(), "", nil)

	orgID := uuid.New()

	ev1, _, _ := svc.Create(context.Background(), orgID, CreateEventInput{
		Title: "Event 1", Description: "D", Venue: "V", City: "Athens",
		StartAt: time.Now().Add(time.Hour), EndAt: time.Now().Add(2 * time.Hour),
		Capacity:    100,
		Categories:  []string{"General"},
		TicketTypes: []TicketTypeInput{{Name: "General", Price: 10, Quantity: 100}},
	})
	svc.Publish(context.Background(), orgID, ev1.ID)

	ev2, _, _ := svc.Create(context.Background(), orgID, CreateEventInput{
		Title: "Event 2", Description: "D", Venue: "V", City: "Thessaloniki",
		StartAt: time.Now().Add(time.Hour), EndAt: time.Now().Add(2 * time.Hour),
		Capacity:    100,
		Categories:  []string{"General"},
		TicketTypes: []TicketTypeInput{{Name: "General", Price: 10, Quantity: 100}},
	})
	svc.Publish(context.Background(), orgID, ev2.ID)

	t.Run("list public", func(t *testing.T) {
		result, _, err := svc.List(context.Background(), 10, 0)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(result) != 2 {
			t.Fatalf("expected 2 events, got %d", len(result))
		}
	})

	t.Run("search", func(t *testing.T) {
		result, _, _, err := svc.Search(context.Background(), SearchEventsInput{}, 10, 0)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(result) != 2 {
			t.Fatalf("expected 2 events, got %d", len(result))
		}
	})

	t.Run("get organizer events", func(t *testing.T) {
		result, _, err := svc.GetOrganizerEvents(context.Background(), orgID, 10, 0)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(result) != 2 {
			t.Fatalf("expected 2 events, got %d", len(result))
		}
	})
}

func TestEventService_AddTicketType(t *testing.T) {
	events := newMockEventRepo()
	svc := NewEventService(events, newMockBookingRepo(), newMockCategoryRepo(), newMockEventPhotoRepo(), newMockViewsRepo(), "", nil)

	orgID := uuid.New()
	ev, _, _ := svc.Create(context.Background(), orgID, CreateEventInput{
		Title: "Event", Description: "D", Venue: "V", City: "C",
		StartAt: time.Now().Add(time.Hour), EndAt: time.Now().Add(2 * time.Hour),
		Capacity:    100,
		Categories:  []string{"General"},
		TicketTypes: []TicketTypeInput{{Name: "Standard", Price: 10, Quantity: 20}},
	})

	t.Run("success", func(t *testing.T) {
		result, _, err := svc.AddTicketType(context.Background(), orgID, ev.ID, TicketTypeInput{
			Name: "General", Price: 10, Quantity: 50,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		// The seeded type survives: adding must not replace what is already there.
		if len(result.TicketTypes) != 2 {
			t.Fatalf("expected 2 ticket types, got %d", len(result.TicketTypes))
		}
	})

	t.Run("exceeding capacity", func(t *testing.T) {
		_, _, err := svc.AddTicketType(context.Background(), orgID, ev.ID, TicketTypeInput{
			Name: "Overflow", Price: 100, Quantity: 200,
		})
		if !errors.Is(err, domain.ErrCapacityExceeded) {
			t.Fatalf("expected ErrCapacityExceeded, got %v", err)
		}
	})

	t.Run("forbidden", func(t *testing.T) {
		_, _, err := svc.AddTicketType(context.Background(), uuid.New(), ev.ID, TicketTypeInput{
			Name: "Hacker", Price: 1, Quantity: 1,
		})
		if !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got %v", err)
		}
	})
}

func TestEventService_UpdateAndDeleteTicketType(t *testing.T) {
	events := newMockEventRepo()
	svc := NewEventService(events, newMockBookingRepo(), newMockCategoryRepo(), newMockEventPhotoRepo(), newMockViewsRepo(), "", nil)

	orgID := uuid.New()
	ev, _, _ := svc.Create(context.Background(), orgID, CreateEventInput{
		Title: "Event", Description: "D", Venue: "V", City: "C",
		StartAt: time.Now().Add(time.Hour), EndAt: time.Now().Add(2 * time.Hour),
		Capacity: 100,
		TicketTypes: []TicketTypeInput{
			{Name: "General", Price: 10, Quantity: 50},
			{Name: "Student", Price: 5, Quantity: 20},
		},
		Categories: []string{"General"},
	})

	// Get the auto-generated ticket type IDs
	ttID := events.ticketTypes[ev.ID][0].ID
	otherTTID := events.ticketTypes[ev.ID][1].ID

	t.Run("update", func(t *testing.T) {
		result, _, err := svc.UpdateTicketType(context.Background(), orgID, ev.ID, ttID, TicketTypeInput{
			Name: "Updated", Price: 15, Quantity: 30,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(result.TicketTypes) != 2 {
			t.Fatalf("expected 2 ticket types, got %d", len(result.TicketTypes))
		}
		var updated *domain.TicketType
		for i := range result.TicketTypes {
			if result.TicketTypes[i].ID == ttID {
				updated = &result.TicketTypes[i]
			}
		}
		if updated == nil {
			t.Fatal("updated ticket type kept its identity? it disappeared")
		}
		if updated.Name != "Updated" {
			t.Fatalf("expected 'Updated', got %s", updated.Name)
		}
	})

	t.Run("delete", func(t *testing.T) {
		result, _, err := svc.DeleteTicketType(context.Background(), orgID, ev.ID, ttID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(result.TicketTypes) != 1 {
			t.Fatalf("expected 1 ticket type, got %d", len(result.TicketTypes))
		}
	})

	t.Run("not found on second delete", func(t *testing.T) {
		_, _, err := svc.DeleteTicketType(context.Background(), orgID, ev.ID, ttID)
		if !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("expected ErrNotFound, got %v", err)
		}
	})

	t.Run("cannot delete the last ticket type", func(t *testing.T) {
		// The DTD requires TicketType+, so an event must always keep one.
		_, _, err := svc.DeleteTicketType(context.Background(), orgID, ev.ID, otherTTID)
		if !errors.Is(err, domain.ErrEventNeedsTicketType) {
			t.Fatalf("expected ErrEventNeedsTicketType, got %v", err)
		}
	})
}

func TestEventService_Get(t *testing.T) {
	events := newMockEventRepo()
	svc := NewEventService(events, newMockBookingRepo(), newMockCategoryRepo(), newMockEventPhotoRepo(), newMockViewsRepo(), "", nil)

	orgID := uuid.New()
	ev, _, _ := svc.Create(context.Background(), orgID, CreateEventInput{
		Title: "GetTest", Description: "D", Venue: "V", City: "C",
		StartAt: time.Now().Add(time.Hour), EndAt: time.Now().Add(2 * time.Hour),
		Capacity:    100,
		Categories:  []string{"General"},
		TicketTypes: []TicketTypeInput{{Name: "General", Price: 10, Quantity: 100}},
	})

	t.Run("found", func(t *testing.T) {
		got, _, err := svc.Get(context.Background(), ev.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.ID != ev.ID {
			t.Fatalf("expected event %s, got %s", ev.ID, got.ID)
		}
	})

	t.Run("not found", func(t *testing.T) {
		_, _, err := svc.Get(context.Background(), uuid.New())
		if !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("expected ErrNotFound, got %v", err)
		}
	})
}

func TestEventService_RecordEventView(t *testing.T) {
	views := newMockViewsRepo()
	svc := NewEventService(newMockEventRepo(), newMockBookingRepo(), newMockCategoryRepo(), newMockEventPhotoRepo(), views, "", nil)

	err := svc.RecordEventView(context.Background(), uuid.New(), uuid.New())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
