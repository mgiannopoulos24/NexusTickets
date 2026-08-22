package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"nexustickets/internal/domain"
	repo "nexustickets/internal/repository"
)

type EventService struct {
	events      repo.EventRepository
	bookings    repo.BookingRepository
	categories  repo.CategoryRepository
	eventPhotos repo.EventPhotoRepository
	views       repo.UserEventViewRepository
	mediaRoot   string
	messaging   *MessagingService
	recommender Recommender
}

// Recommender scores real DB events for a user using the trained BMF model, and
// exposes a popularity fallback for cold-start. Implemented by
// RecommendationService.
type Recommender interface {
	// HasUser reports whether the model has history for this user.
	HasUser(userID uuid.UUID) bool
	// ScoreEvents returns BMF scores for the given events; unknown events are omitted.
	ScoreEvents(userID uuid.UUID, eventIDs []uuid.UUID) map[uuid.UUID]float64
	// PopularEventIDs returns the most popular event IDs, best-first.
	PopularEventIDs(limit int) []uuid.UUID
}

type TicketTypeInput struct {
	// ID identifies an existing ticket type to update in place. Nil means
	// "create a new one". Matching by ID is what lets an organizer edit a
	// published event without destroying the rows its bookings point at.
	ID       *uuid.UUID
	Name     string
	Price    float64
	Quantity int
}

type CreateEventInput struct {
	Title            string
	Description      string
	Venue            string
	EventType        string
	FeaturedImageURL *string
	Address          *string
	City             string
	Country          *string
	Latitude         *float64
	Longitude        *float64
	StartAt          time.Time
	EndAt            time.Time
	Capacity         int
	Categories       []string
	TicketTypes      []TicketTypeInput
	EventDetail      *domain.EventDetail
}

type UpdateEventInput struct {
	Title            *string
	Description      *string
	Venue            *string
	EventType        *string
	FeaturedImageURL *string
	Address          *string
	City             *string
	Country          *string
	Latitude         *float64
	Longitude        *float64
	StartAt          *time.Time
	EndAt            *time.Time
	Capacity         *int
	Categories       *[]string
	TicketTypes      *[]TicketTypeInput
	EventDetail      *domain.EventDetail
}

type SearchEventsInput struct {
	CategoryIDs []uuid.UUID
	Title       string
	Query       string
	City        string
	StartAt     *time.Time
	EndAt       *time.Time
	MinPrice    *float64
	MaxPrice    *float64

	AfterStartAt *time.Time
	AfterID      *uuid.UUID
}

type AdminUpdateEventInput struct {
	Title            *string
	Description      *string
	Venue            *string
	EventType        *string
	Address          *string
	City             *string
	Country          *string
	Latitude         *float64
	Longitude        *float64
	StartAt          *time.Time
	EndAt            *time.Time
	Capacity         *int
	Categories       *[]string
	FeaturedImageURL *string
	EventDetail      *domain.EventDetail
	Status           *domain.EventStatus
}

func NewEventService(
	events repo.EventRepository,
	bookings repo.BookingRepository,
	categories repo.CategoryRepository,
	eventPhotos repo.EventPhotoRepository,
	views repo.UserEventViewRepository,
	mediaRoot string,
	messaging *MessagingService,
) *EventService {
	return &EventService{
		events:      events,
		bookings:    bookings,
		categories:  categories,
		eventPhotos: eventPhotos,
		views:       views,
		mediaRoot:   strings.TrimSpace(mediaRoot),
		messaging:   messaging,
	}
}

// SetRecommender attaches the BMF recommendation engine used by Recommended.
// It is optional; when unset, Recommended falls back to popular DB events.
func (s *EventService) SetRecommender(r Recommender) {
	s.recommender = r
}

func (s *EventService) Create(ctx context.Context, organizerID uuid.UUID, in CreateEventInput) (domain.Event, []domain.Category, error) {
	if err := validateCreateEvent(in); err != nil {
		return domain.Event{}, nil, err
	}
	if err := validateTicketCapacity(in.Capacity, in.TicketTypes); err != nil {
		return domain.Event{}, nil, err
	}

	// The export DTD requires Category+ and TicketType+ (one or more of each),
	// so an event that satisfies neither could never be exported validly.
	cats, err := s.resolveCategories(ctx, in.Categories)
	if err != nil {
		return domain.Event{}, nil, err
	}
	if len(cats) == 0 {
		return domain.Event{}, nil, domain.ErrEventNeedsCategory
	}
	if len(in.TicketTypes) == 0 {
		return domain.Event{}, nil, domain.ErrEventNeedsTicketType
	}

	detail := domain.EventDetail{}
	if in.EventDetail != nil {
		detail = *in.EventDetail
	}

	created, err := s.events.Create(ctx, domain.Event{
		OrganizerID:      organizerID,
		Title:            strings.TrimSpace(in.Title),
		Description:      strings.TrimSpace(in.Description),
		Venue:            strings.TrimSpace(in.Venue),
		EventType:        strings.TrimSpace(in.EventType),
		FeaturedImageURL: in.FeaturedImageURL,
		Detail:           detail,
		Address:          in.Address,
		City:             strings.TrimSpace(in.City),
		Country:          in.Country,
		Latitude:         in.Latitude,
		Longitude:        in.Longitude,
		StartAt:          in.StartAt.UTC(),
		EndAt:            in.EndAt.UTC(),
		Capacity:         in.Capacity,
		Status:           domain.EventStatusDraft,
	})
	if err != nil {
		return domain.Event{}, nil, err
	}

	if err := s.events.SetTicketTypes(ctx, created.ID, toTicketTypes(created.ID, in.TicketTypes)); err != nil {
		return domain.Event{}, nil, err
	}
	if err := s.events.SetCategories(ctx, created.ID, categoryIDs(cats)); err != nil {
		return domain.Event{}, nil, err
	}

	return s.Get(ctx, created.ID)
}

func (s *EventService) Get(ctx context.Context, eventID uuid.UUID) (domain.Event, []domain.Category, error) {
	event, err := s.events.GetByID(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}
	ticketTypes, err := s.events.GetTicketTypes(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}
	cats, err := s.events.GetCategories(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}
	photos, err := s.events.GetPhotos(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}
	event.TicketTypes = ticketTypes
	event.Photos = photos
	return event, cats, nil
}

// GetForViewer is Get with visibility rules applied: an event that is not
// published is only readable by its organizer or an administrator. Without
// this, a DRAFT event leaked to anyone who knew (or guessed) its id.
func (s *EventService) GetForViewer(
	ctx context.Context,
	eventID uuid.UUID,
	viewerID uuid.UUID,
	viewerRole domain.UserRole,
) (domain.Event, []domain.Category, error) {
	event, cats, err := s.Get(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}

	switch event.Status {
	case domain.EventStatusPublished, domain.EventStatusCompleted, domain.EventStatusCancelled:
		// Publicly visible: a cancelled or finished event still needs a detail
		// page for the people who booked it.
		return event, cats, nil
	default:
		if viewerRole == domain.UserRoleAdmin || (viewerID != uuid.Nil && event.OrganizerID == viewerID) {
			return event, cats, nil
		}
		return domain.Event{}, nil, domain.ErrNotFound
	}
}

func (s *EventService) List(ctx context.Context, limit, offset int) ([]domain.Event, [][]domain.Category, error) {
	events, err := s.events.ListPublic(ctx, limit, offset)
	if err != nil {
		return nil, nil, err
	}
	return s.hydrateMany(ctx, events)
}

func (s *EventService) Search(ctx context.Context, in SearchEventsInput, limit, offset int) ([]domain.Event, [][]domain.Category, bool, error) {
	events, hasMore, err := s.events.Search(ctx, repo.SearchEventsParams{
		CategoryIDs:  in.CategoryIDs,
		Title:        strings.TrimSpace(in.Title),
		FullText:     strings.TrimSpace(in.Query),
		City:         strings.TrimSpace(in.City),
		StartAt:      in.StartAt,
		EndAt:        in.EndAt,
		MinPrice:     in.MinPrice,
		MaxPrice:     in.MaxPrice,
		AfterStartAt: in.AfterStartAt,
		AfterID:      in.AfterID,
		Status:       domain.EventStatusPublished,
	}, limit, offset)
	if err != nil {
		return nil, nil, false, err
	}
	ev, cats, err := s.hydrateMany(ctx, events)
	if err != nil {
		return nil, nil, false, err
	}
	return ev, cats, hasMore, nil
}

func (s *EventService) RecordEventView(ctx context.Context, userID, eventID uuid.UUID) error {
	return s.views.Record(ctx, userID, eventID)
}

// recommendCandidatePool is how many published events we rank over before
// trimming to the requested limit.
const recommendCandidatePool = 200

// Recommended returns published events for a user's "recommended" section,
// personalized with the Biased Matrix Factorization model (Requirement 13).
//
// We take a pool of published events, drop the ones the user has already booked,
// and rank the rest by the BMF score predicted for this user. The model is
// trained on the user's real interaction history (confirmed bookings + event
// views). When there is no personalized signal — a guest (uuid.Nil), no trained
// recommender, or a user the model has not learned yet — we fall back to the
// popularity order. See docs/recommendation.md.
func (s *EventService) Recommended(ctx context.Context, userID uuid.UUID, limit int) ([]domain.Event, [][]domain.Category, error) {
	if limit <= 0 {
		limit = 20
	}

	candidates, err := s.events.ListPublic(ctx, recommendCandidatePool, 0)
	if err != nil {
		return nil, nil, err
	}

	// Cold start: guest, no model, or a user with no learned history.
	if userID == uuid.Nil || s.recommender == nil || !s.recommender.HasUser(userID) {
		return s.hydrateMany(ctx, s.coldStart(candidates, limit))
	}

	booked, err := s.bookedByUser(ctx, userID)
	if err != nil {
		return nil, nil, err
	}

	ids := make([]uuid.UUID, len(candidates))
	for i, ev := range candidates {
		ids[i] = ev.ID
	}
	scores := s.recommender.ScoreEvents(userID, ids)

	type ranked struct {
		event domain.Event
		score float64
		pos   int
	}
	pool := make([]ranked, 0, len(candidates))
	for i, ev := range candidates {
		if booked[ev.ID] {
			continue // don't recommend what they've already booked
		}
		pool = append(pool, ranked{event: ev, score: scores[ev.ID], pos: i})
	}

	// Highest predicted score first; ties keep the original popularity order.
	sort.SliceStable(pool, func(i, j int) bool {
		if pool[i].score != pool[j].score {
			return pool[i].score > pool[j].score
		}
		return pool[i].pos < pool[j].pos
	})

	out := make([]domain.Event, 0, limit)
	for i := 0; i < len(pool) && i < limit; i++ {
		out = append(out, pool[i].event)
	}
	return s.hydrateMany(ctx, out)
}

// coldStart orders candidates by global popularity when a recommender is
// available, otherwise keeps the ListPublic order. Result is trimmed to limit.
func (s *EventService) coldStart(candidates []domain.Event, limit int) []domain.Event {
	if s.recommender == nil {
		return trimEvents(candidates, limit)
	}
	rank := make(map[uuid.UUID]int)
	for i, id := range s.recommender.PopularEventIDs(0) {
		rank[id] = i
	}
	ordered := make([]domain.Event, len(candidates))
	copy(ordered, candidates)
	sort.SliceStable(ordered, func(i, j int) bool {
		ri, iok := rank[ordered[i].ID]
		rj, jok := rank[ordered[j].ID]
		switch {
		case iok && jok:
			return ri < rj
		case iok != jok:
			return iok // popular events sort ahead of unranked ones
		default:
			return false // preserve ListPublic order for the rest
		}
	})
	return trimEvents(ordered, limit)
}

// bookedByUser returns the set of events the user has already booked.
func (s *EventService) bookedByUser(ctx context.Context, userID uuid.UUID) (map[uuid.UUID]bool, error) {
	bookings, err := s.bookings.ListByUser(ctx, userID, recommendCandidatePool, 0)
	if err != nil {
		return nil, err
	}
	booked := make(map[uuid.UUID]bool, len(bookings))
	for _, b := range bookings {
		booked[b.EventID] = true
	}
	return booked, nil
}

func trimEvents(events []domain.Event, limit int) []domain.Event {
	if limit > 0 && len(events) > limit {
		return events[:limit]
	}
	return events
}

func (s *EventService) GetOrganizerEvents(ctx context.Context, organizerID uuid.UUID, limit, offset int) ([]domain.Event, [][]domain.Category, error) {
	events, err := s.events.ListOrganizer(ctx, organizerID, limit, offset)
	if err != nil {
		return nil, nil, err
	}
	return s.hydrateMany(ctx, events)
}

func (s *EventService) Update(ctx context.Context, organizerID, eventID uuid.UUID, in UpdateEventInput) (domain.Event, []domain.Category, error) {
	event, err := s.events.GetByID(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}
	if event.OrganizerID != organizerID {
		return domain.Event{}, nil, domain.ErrForbidden
	}
	// A cancelled or finished event is a historical record: the people holding
	// tickets for it must keep seeing what they actually booked.
	if event.Status == domain.EventStatusCancelled || event.Status == domain.EventStatusCompleted {
		return domain.Event{}, nil, domain.ErrEventLocked
	}

	if in.Title != nil {
		event.Title = strings.TrimSpace(*in.Title)
	}
	if in.EventType != nil {
		event.EventType = strings.TrimSpace(*in.EventType)
	}
	if in.Description != nil {
		event.Description = strings.TrimSpace(*in.Description)
	}
	if in.Venue != nil {
		event.Venue = strings.TrimSpace(*in.Venue)
	}
	if in.FeaturedImageURL != nil {
		event.FeaturedImageURL = in.FeaturedImageURL
	}
	if in.Address != nil {
		event.Address = in.Address
	}
	if in.City != nil {
		event.City = strings.TrimSpace(*in.City)
	}
	if in.Country != nil {
		event.Country = in.Country
	}
	if in.Latitude != nil {
		event.Latitude = in.Latitude
	}
	if in.Longitude != nil {
		event.Longitude = in.Longitude
	}
	if in.EventDetail != nil {
		event.Detail = *in.EventDetail
	}
	if in.StartAt != nil {
		event.StartAt = in.StartAt.UTC()
	}
	if in.EndAt != nil {
		event.EndAt = in.EndAt.UTC()
	}
	if in.Capacity != nil {
		event.Capacity = *in.Capacity
	}
	if event.EndAt.Before(event.StartAt) || event.Capacity < 0 {
		return domain.Event{}, nil, domain.ErrInvalidEventState
	}

	existingTicketTypes, err := s.events.GetTicketTypes(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}

	if in.TicketTypes != nil {
		merged, mergeErr := s.mergeTicketTypes(ctx, eventID, existingTicketTypes, *in.TicketTypes)
		if mergeErr != nil {
			return domain.Event{}, nil, mergeErr
		}
		if len(merged) == 0 {
			return domain.Event{}, nil, domain.ErrEventNeedsTicketType
		}
		if err := validateTicketTypeCapacity(event.Capacity, merged); err != nil {
			return domain.Event{}, nil, err
		}
		if err := s.events.SetTicketTypes(ctx, eventID, merged); err != nil {
			return domain.Event{}, nil, err
		}
	} else if err := validateTicketTypeCapacity(event.Capacity, existingTicketTypes); err != nil {
		// Capacity may have been lowered; the existing allocation must still fit.
		return domain.Event{}, nil, err
	}

	if _, err := s.events.Update(ctx, event); err != nil {
		return domain.Event{}, nil, err
	}

	if in.Categories != nil {
		cats, resolveErr := s.resolveCategories(ctx, *in.Categories)
		if resolveErr != nil {
			return domain.Event{}, nil, resolveErr
		}
		if err := s.events.SetCategories(ctx, eventID, categoryIDs(cats)); err != nil {
			return domain.Event{}, nil, err
		}
	}

	return s.Get(ctx, eventID)
}

// mergeTicketTypes reconciles the caller's desired ticket types against what is
// already stored, preserving seats that have been sold.
//
// Each stored row carries `sold = Quantity - Available`. An incoming entry that
// names an existing row by ID keeps that row's identity (so bookings continue to
// reference it) and gets `Available = Quantity - sold`; its Quantity may not drop
// below what has already been sold. An entry with no ID is a new row. A stored
// row the caller omitted is removed, but only if nothing has booked it — the FK
// from bookings is ON DELETE RESTRICT, so removing a booked row would otherwise
// fail as an opaque 500 at the database.
func (s *EventService) mergeTicketTypes(
	ctx context.Context,
	eventID uuid.UUID,
	existing []domain.TicketType,
	desired []TicketTypeInput,
) ([]domain.TicketType, error) {
	byID := make(map[uuid.UUID]domain.TicketType, len(existing))
	for _, tt := range existing {
		byID[tt.ID] = tt
	}

	out := make([]domain.TicketType, 0, len(desired))
	kept := make(map[uuid.UUID]struct{}, len(desired))

	for _, in := range desired {
		if strings.TrimSpace(in.Name) == "" || in.Price < 0 || in.Quantity < 0 {
			return nil, domain.ErrInvalidEventState
		}

		if in.ID == nil {
			out = append(out, domain.TicketType{
				EventID:   eventID,
				Name:      strings.TrimSpace(in.Name),
				Price:     in.Price,
				Quantity:  in.Quantity,
				Available: in.Quantity,
			})
			continue
		}

		prev, ok := byID[*in.ID]
		if !ok {
			return nil, domain.ErrNotFound
		}
		sold := prev.Quantity - prev.Available
		if sold < 0 {
			sold = 0
		}
		if in.Quantity < sold {
			// Would leave fewer seats than have already been sold.
			return nil, domain.ErrCapacityExceeded
		}

		kept[prev.ID] = struct{}{}
		out = append(out, domain.TicketType{
			ID:        prev.ID,
			EventID:   eventID,
			Name:      strings.TrimSpace(in.Name),
			Price:     in.Price,
			Quantity:  in.Quantity,
			Available: in.Quantity - sold,
			CreatedAt: prev.CreatedAt,
		})
	}

	for _, prev := range existing {
		if _, ok := kept[prev.ID]; ok {
			continue
		}
		count, err := s.bookings.CountByTicketType(ctx, prev.ID)
		if err != nil {
			return nil, err
		}
		if count > 0 {
			return nil, domain.ErrTicketTypeLocked
		}
	}

	return out, nil
}

func (s *EventService) AdminList(ctx context.Context, limit, offset int) ([]domain.Event, [][]domain.Category, error) {
	events, err := s.events.ListForExport(ctx, limit, offset)
	if err != nil {
		return nil, nil, err
	}
	return s.hydrateMany(ctx, events)
}

func (s *EventService) AdminGet(ctx context.Context, eventID uuid.UUID) (domain.Event, []domain.Category, error) {
	return s.Get(ctx, eventID)
}

func (s *EventService) AdminUpdate(ctx context.Context, eventID uuid.UUID, in AdminUpdateEventInput) (domain.Event, []domain.Category, error) {
	event, err := s.events.GetByID(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}

	if in.Title != nil {
		event.Title = strings.TrimSpace(*in.Title)
	}
	if in.Description != nil {
		event.Description = strings.TrimSpace(*in.Description)
	}
	if in.Venue != nil {
		event.Venue = strings.TrimSpace(*in.Venue)
	}
	if in.EventType != nil {
		event.EventType = strings.TrimSpace(*in.EventType)
	}
	if in.FeaturedImageURL != nil {
		event.FeaturedImageURL = in.FeaturedImageURL
	}
	if in.Address != nil {
		event.Address = in.Address
	}
	if in.City != nil {
		event.City = strings.TrimSpace(*in.City)
	}
	if in.Country != nil {
		event.Country = in.Country
	}
	if in.Latitude != nil {
		event.Latitude = in.Latitude
	}
	if in.Longitude != nil {
		event.Longitude = in.Longitude
	}
	if in.EventDetail != nil {
		event.Detail = *in.EventDetail
	}
	if in.Status != nil {
		if !domain.ValidEventStatus(*in.Status) {
			return domain.Event{}, nil, domain.ErrInvalidEventState
		}
		event.Status = *in.Status
	}
	if in.StartAt != nil {
		event.StartAt = in.StartAt.UTC()
	}
	if in.EndAt != nil {
		event.EndAt = in.EndAt.UTC()
	}
	if in.Capacity != nil {
		event.Capacity = *in.Capacity
	}

	if strings.TrimSpace(event.Title) == "" ||
		strings.TrimSpace(event.Description) == "" ||
		strings.TrimSpace(event.Venue) == "" ||
		strings.TrimSpace(event.City) == "" ||
		event.Capacity < 0 ||
		event.EndAt.Before(event.StartAt) {
		return domain.Event{}, nil, domain.ErrInvalidEventState
	}

	if _, err := s.events.Update(ctx, event); err != nil {
		return domain.Event{}, nil, err
	}

	if in.Categories != nil {
		cats, err := s.resolveCategories(ctx, *in.Categories)
		if err != nil {
			return domain.Event{}, nil, err
		}
		if err := s.events.SetCategories(ctx, eventID, categoryIDs(cats)); err != nil {
			return domain.Event{}, nil, err
		}
	}

	return s.Get(ctx, eventID)
}

func (s *EventService) Delete(ctx context.Context, organizerID, eventID uuid.UUID) error {
	event, err := s.events.GetByID(ctx, eventID)
	if err != nil {
		return err
	}
	if event.OrganizerID != organizerID {
		return domain.ErrForbidden
	}

	switch event.Status {
	case domain.EventStatusDraft:
		return s.events.Delete(ctx, eventID)
	case domain.EventStatusPublished:
		bookings, listErr := s.bookings.ListByEvent(ctx, eventID, 1, 0)
		if listErr != nil {
			return listErr
		}
		if len(bookings) > 0 {
			return domain.ErrEventNotDeletable
		}
		return s.events.Delete(ctx, eventID)
	default:
		return domain.ErrEventNotDeletable
	}
}

func (s *EventService) Publish(ctx context.Context, organizerID, eventID uuid.UUID) (domain.Event, []domain.Category, error) {
	event, err := s.events.GetByID(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}
	if event.OrganizerID != organizerID {
		return domain.Event{}, nil, domain.ErrForbidden
	}
	if event.Status != domain.EventStatusDraft {
		return domain.Event{}, nil, domain.ErrInvalidEventState
	}

	ticketTypes, err := s.events.GetTicketTypes(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}
	if len(ticketTypes) == 0 {
		return domain.Event{}, nil, domain.ErrEventNeedsTicketType
	}
	cats, err := s.events.GetCategories(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}
	if len(cats) == 0 {
		return domain.Event{}, nil, domain.ErrEventNeedsCategory
	}

	if err := s.events.SetStatus(ctx, eventID, domain.EventStatusPublished); err != nil {
		return domain.Event{}, nil, err
	}
	return s.Get(ctx, eventID)
}

func (s *EventService) Cancel(ctx context.Context, organizerID, eventID uuid.UUID) (domain.Event, []domain.Category, error) {
	event, err := s.events.GetByID(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}
	if event.OrganizerID != organizerID {
		return domain.Event{}, nil, domain.ErrForbidden
	}
	if event.Status != domain.EventStatusPublished {
		return domain.Event{}, nil, domain.ErrEventNotCancellable
	}
	if err := s.events.SetStatus(ctx, eventID, domain.EventStatusCancelled); err != nil {
		return domain.Event{}, nil, err
	}
	if s.messaging != nil {
		_ = s.messaging.NotifyEventCancellation(ctx, eventID)
	}
	return s.Get(ctx, eventID)
}

func (s *EventService) AddTicketType(ctx context.Context, organizerID, eventID uuid.UUID, in TicketTypeInput) (domain.Event, []domain.Category, error) {
	event, err := s.events.GetByID(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}
	if event.OrganizerID != organizerID {
		return domain.Event{}, nil, domain.ErrForbidden
	}
	if event.Status == domain.EventStatusCancelled || event.Status == domain.EventStatusCompleted {
		return domain.Event{}, nil, domain.ErrEventLocked
	}
	if strings.TrimSpace(in.Name) == "" || in.Price < 0 || in.Quantity < 0 {
		return domain.Event{}, nil, domain.ErrInvalidEventState
	}

	existing, err := s.events.GetTicketTypes(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}
	total := in.Quantity
	for _, tt := range existing {
		total += tt.Quantity
	}
	if total > event.Capacity {
		return domain.Event{}, nil, domain.ErrCapacityExceeded
	}

	ticketTypes := make([]domain.TicketType, 0, len(existing)+1)
	ticketTypes = append(ticketTypes, existing...)
	ticketTypes = append(ticketTypes, domain.TicketType{
		EventID:   eventID,
		Name:      strings.TrimSpace(in.Name),
		Price:     in.Price,
		Quantity:  in.Quantity,
		Available: in.Quantity,
	})
	if err := s.events.SetTicketTypes(ctx, eventID, ticketTypes); err != nil {
		return domain.Event{}, nil, err
	}
	return s.Get(ctx, eventID)
}

func (s *EventService) UpdateTicketType(ctx context.Context, organizerID, eventID, ticketTypeID uuid.UUID, in TicketTypeInput) (domain.Event, []domain.Category, error) {
	event, err := s.events.GetByID(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}
	if event.OrganizerID != organizerID {
		return domain.Event{}, nil, domain.ErrForbidden
	}
	if event.Status == domain.EventStatusCancelled || event.Status == domain.EventStatusCompleted {
		return domain.Event{}, nil, domain.ErrEventLocked
	}
	if strings.TrimSpace(in.Name) == "" || in.Price < 0 || in.Quantity < 0 {
		return domain.Event{}, nil, domain.ErrInvalidEventState
	}

	existing, err := s.events.GetTicketTypes(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}

	found := false
	total := 0
	for _, tt := range existing {
		if tt.ID == ticketTypeID {
			found = true
			continue
		}
		total += tt.Quantity
	}
	if !found {
		return domain.Event{}, nil, domain.ErrNotFound
	}
	total += in.Quantity
	if total > event.Capacity {
		return domain.Event{}, nil, domain.ErrCapacityExceeded
	}

	bookingCount, err := s.bookings.CountByTicketType(ctx, ticketTypeID)
	if err != nil {
		return domain.Event{}, nil, err
	}
	if bookingCount > 0 {
		return domain.Event{}, nil, domain.ErrTicketTypeLocked
	}

	updated := make([]domain.TicketType, 0, len(existing))
	for _, tt := range existing {
		if tt.ID == ticketTypeID {
			tt.Name = strings.TrimSpace(in.Name)
			tt.Price = in.Price
			tt.Quantity = in.Quantity
			tt.Available = in.Quantity
		}
		updated = append(updated, tt)
	}
	if err := s.events.SetTicketTypes(ctx, eventID, updated); err != nil {
		return domain.Event{}, nil, err
	}
	return s.Get(ctx, eventID)
}

func (s *EventService) DeleteTicketType(ctx context.Context, organizerID, eventID, ticketTypeID uuid.UUID) (domain.Event, []domain.Category, error) {
	event, err := s.events.GetByID(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}
	if event.OrganizerID != organizerID {
		return domain.Event{}, nil, domain.ErrForbidden
	}
	if event.Status == domain.EventStatusCancelled || event.Status == domain.EventStatusCompleted {
		return domain.Event{}, nil, domain.ErrEventLocked
	}

	bookingCount, err := s.bookings.CountByTicketType(ctx, ticketTypeID)
	if err != nil {
		return domain.Event{}, nil, err
	}
	if bookingCount > 0 {
		return domain.Event{}, nil, domain.ErrTicketTypeLocked
	}

	existing, err := s.events.GetTicketTypes(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}

	updated := make([]domain.TicketType, 0, len(existing))
	found := false
	for _, tt := range existing {
		if tt.ID == ticketTypeID {
			found = true
			continue
		}
		updated = append(updated, tt)
	}
	if !found {
		return domain.Event{}, nil, domain.ErrNotFound
	}
	if len(updated) == 0 {
		return domain.Event{}, nil, domain.ErrEventNeedsTicketType
	}
	if err := s.events.SetTicketTypes(ctx, eventID, updated); err != nil {
		return domain.Event{}, nil, err
	}
	return s.Get(ctx, eventID)
}

func (s *EventService) AddPhoto(ctx context.Context, organizerID, eventID uuid.UUID, mimeType string, r io.Reader) (domain.EventPhoto, error) {
	event, err := s.events.GetByID(ctx, eventID)
	if err != nil {
		return domain.EventPhoto{}, err
	}
	if event.OrganizerID != organizerID {
		return domain.EventPhoto{}, domain.ErrForbidden
	}
	return s.saveEventImage(ctx, eventID, mimeType, r)
}

func (s *EventService) saveEventImage(ctx context.Context, eventID uuid.UUID, mimeType string, r io.Reader) (domain.EventPhoto, error) {
	if strings.TrimSpace(s.mediaRoot) == "" {
		return domain.EventPhoto{}, fmt.Errorf("media storage path is not configured")
	}

	photos, err := s.eventPhotos.ListByEvent(ctx, eventID)
	if err != nil {
		return domain.EventPhoto{}, err
	}
	nextPosition := len(photos)

	eventDir := filepath.Join(s.mediaRoot, eventID.String())
	if err := os.MkdirAll(eventDir, 0o755); err != nil {
		return domain.EventPhoto{}, fmt.Errorf("create media directory: %w", err)
	}

	ext := extForImageMIME(mimeType)
	safeName := uuid.NewString() + ext
	relativePath := filepath.ToSlash(filepath.Join(eventID.String(), safeName))
	absolutePath := filepath.Join(s.mediaRoot, relativePath)

	out, err := os.Create(absolutePath)
	if err != nil {
		return domain.EventPhoto{}, fmt.Errorf("create media file: %w", err)
	}
	if _, err := io.Copy(out, r); err != nil {
		_ = out.Close()
		_ = os.Remove(absolutePath)
		return domain.EventPhoto{}, fmt.Errorf("write media file: %w", err)
	}
	if err := out.Close(); err != nil {
		_ = os.Remove(absolutePath)
		return domain.EventPhoto{}, fmt.Errorf("close media file: %w", err)
	}

	created, err := s.eventPhotos.Add(ctx, domain.EventPhoto{
		EventID:     eventID,
		StoragePath: relativePath,
		Position:    nextPosition,
	})
	if err != nil {
		_ = os.Remove(absolutePath)
		return domain.EventPhoto{}, err
	}
	return created, nil
}

func (s *EventService) DeletePhoto(ctx context.Context, organizerID, eventID, photoID uuid.UUID) error {
	event, err := s.events.GetByID(ctx, eventID)
	if err != nil {
		return err
	}
	if event.OrganizerID != organizerID {
		return domain.ErrForbidden
	}

	photos, err := s.eventPhotos.ListByEvent(ctx, eventID)
	if err != nil {
		return err
	}
	var target *domain.EventPhoto
	for i := range photos {
		if photos[i].ID == photoID {
			target = &photos[i]
			break
		}
	}
	if target == nil {
		return domain.ErrNotFound
	}

	if err := s.eventPhotos.Delete(ctx, photoID); err != nil {
		return err
	}
	if strings.TrimSpace(s.mediaRoot) == "" {
		return nil
	}
	_ = os.Remove(filepath.Join(s.mediaRoot, filepath.FromSlash(target.StoragePath)))
	return nil
}

func (s *EventService) SetFeaturedImage(ctx context.Context, organizerID, eventID uuid.UUID, mimeType string, r io.Reader) (domain.Event, []domain.Category, error) {
	event, err := s.events.GetByID(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}
	if event.OrganizerID != organizerID {
		return domain.Event{}, nil, domain.ErrForbidden
	}

	created, err := s.saveEventImage(ctx, eventID, mimeType, r)
	if err != nil {
		return domain.Event{}, nil, err
	}

	url := "/uploads/media/" + filepath.ToSlash(created.StoragePath)
	event.FeaturedImageURL = &url
	if _, err := s.events.Update(ctx, event); err != nil {
		return domain.Event{}, nil, err
	}
	return s.Get(ctx, eventID)
}

func (s *EventService) AdminSetFeaturedImage(ctx context.Context, eventID uuid.UUID, mimeType string, r io.Reader) (domain.Event, []domain.Category, error) {
	event, err := s.events.GetByID(ctx, eventID)
	if err != nil {
		return domain.Event{}, nil, err
	}

	created, err := s.saveEventImage(ctx, eventID, mimeType, r)
	if err != nil {
		return domain.Event{}, nil, err
	}

	url := "/uploads/media/" + filepath.ToSlash(created.StoragePath)
	event.FeaturedImageURL = &url
	if _, err := s.events.Update(ctx, event); err != nil {
		return domain.Event{}, nil, err
	}
	return s.Get(ctx, eventID)
}

func DetectImageMIME(header []byte) (string, bool) {
	mime := http.DetectContentType(header)
	switch mime {
	case "image/jpeg", "image/png", "image/gif", "image/webp":
		return mime, true
	default:
		return mime, false
	}
}

func extForImageMIME(mime string) string {
	switch mime {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	default:
		return ".bin"
	}
}

func (s *EventService) hydrateMany(ctx context.Context, events []domain.Event) ([]domain.Event, [][]domain.Category, error) {
	if len(events) == 0 {
		return events, [][]domain.Category{}, nil
	}

	ids := make([]uuid.UUID, len(events))
	for i := range events {
		ids[i] = events[i].ID
	}

	// Batched lookups: the per-event loop this replaces issued 2N queries.
	ttByEvent, err := s.events.ListTicketTypesByEventIDs(ctx, ids)
	if err != nil {
		return nil, nil, err
	}
	catByEvent, err := s.events.ListCategoriesByEventIDs(ctx, ids)
	if err != nil {
		return nil, nil, err
	}
	photoByEvent, err := s.events.ListPhotosByEventIDs(ctx, ids)
	if err != nil {
		return nil, nil, err
	}

	cats := make([][]domain.Category, 0, len(events))
	for i := range events {
		events[i].TicketTypes = ttByEvent[events[i].ID]
		events[i].Photos = photoByEvent[events[i].ID]
		eventCats := catByEvent[events[i].ID]
		if eventCats == nil {
			eventCats = []domain.Category{}
		}
		cats = append(cats, eventCats)
	}
	return events, cats, nil
}

// SweepCompleted moves published events whose end time has passed into the
// COMPLETED state (assignment §7). main runs it on a ticker.
func (s *EventService) SweepCompleted(ctx context.Context) (int64, error) {
	return s.events.MarkCompleted(ctx, time.Now().UTC())
}

func (s *EventService) resolveCategories(ctx context.Context, names []string) ([]domain.Category, error) {
	seen := make(map[string]struct{}, len(names))
	out := make([]domain.Category, 0, len(names))
	for _, rawName := range names {
		name := strings.TrimSpace(rawName)
		if name == "" {
			continue
		}
		key := strings.ToLower(name)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}

		cat, err := s.categories.GetByName(ctx, name)
		if err != nil {
			if !errors.Is(err, domain.ErrNotFound) {
				return nil, err
			}
			cat, err = s.categories.Create(ctx, domain.Category{Name: name})
			if err != nil {
				return nil, err
			}
		}
		out = append(out, cat)
	}
	return out, nil
}

func validateCreateEvent(in CreateEventInput) error {
	if strings.TrimSpace(in.Title) == "" ||
		strings.TrimSpace(in.Description) == "" ||
		strings.TrimSpace(in.Venue) == "" ||
		strings.TrimSpace(in.City) == "" {
		return domain.Invalid("missing required event fields")
	}
	if in.Capacity < 0 || in.EndAt.Before(in.StartAt) {
		return domain.ErrInvalidEventState
	}
	return nil
}

func validateTicketCapacity(capacity int, ticketTypes []TicketTypeInput) error {
	sum := 0
	for _, tt := range ticketTypes {
		if strings.TrimSpace(tt.Name) == "" || tt.Price < 0 || tt.Quantity < 0 {
			return domain.ErrInvalidEventState
		}
		sum += tt.Quantity
	}
	if sum > capacity {
		return domain.ErrCapacityExceeded
	}
	return nil
}

// validateTicketTypeCapacity enforces the assignment's capacity rule against
// already-materialised ticket types: the sum of all quantities may not exceed
// the event's total capacity.
func validateTicketTypeCapacity(capacity int, ticketTypes []domain.TicketType) error {
	sum := 0
	for _, tt := range ticketTypes {
		if strings.TrimSpace(tt.Name) == "" || tt.Price < 0 || tt.Quantity < 0 {
			return domain.ErrInvalidEventState
		}
		sum += tt.Quantity
	}
	if sum > capacity {
		return domain.ErrCapacityExceeded
	}
	return nil
}

func toTicketTypes(eventID uuid.UUID, in []TicketTypeInput) []domain.TicketType {
	out := make([]domain.TicketType, 0, len(in))
	for _, tt := range in {
		out = append(out, domain.TicketType{
			EventID:   eventID,
			Name:      strings.TrimSpace(tt.Name),
			Price:     tt.Price,
			Quantity:  tt.Quantity,
			Available: tt.Quantity,
		})
	}
	return out
}

func categoryIDs(cats []domain.Category) []uuid.UUID {
	ids := make([]uuid.UUID, 0, len(cats))
	for _, c := range cats {
		ids = append(ids, c.ID)
	}
	return ids
}
