package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
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
}

type TicketTypeInput struct {
	Name     string
	Price    float64
	Quantity int
}

type CreateEventInput struct {
	Title       string
	Description string
	Venue       string
	FeaturedImageURL *string
	Address     *string
	City        string
	Country     *string
	Latitude    *float64
	Longitude   *float64
	StartAt     time.Time
	EndAt       time.Time
	Capacity    int
	Categories  []string
	TicketTypes []TicketTypeInput
}

type UpdateEventInput struct {
	Title       *string
	Description *string
	Venue       *string
	FeaturedImageURL *string
	Address     *string
	City        *string
	Country     *string
	Latitude    *float64
	Longitude   *float64
	StartAt     *time.Time
	EndAt       *time.Time
	Capacity    *int
	Categories  *[]string
	TicketTypes *[]TicketTypeInput
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

func (s *EventService) Create(ctx context.Context, organizerID uuid.UUID, in CreateEventInput) (domain.Event, []domain.Category, error) {
	if err := validateCreateEvent(in); err != nil {
		return domain.Event{}, nil, err
	}
	if err := validateTicketCapacity(in.Capacity, in.TicketTypes); err != nil {
		return domain.Event{}, nil, err
	}

	created, err := s.events.Create(ctx, domain.Event{
		OrganizerID: organizerID,
		Title:       strings.TrimSpace(in.Title),
		Description: strings.TrimSpace(in.Description),
		Venue:       strings.TrimSpace(in.Venue),
		FeaturedImageURL: in.FeaturedImageURL,
		Address:     in.Address,
		City:        strings.TrimSpace(in.City),
		Country:     in.Country,
		Latitude:    in.Latitude,
		Longitude:   in.Longitude,
		StartAt:     in.StartAt.UTC(),
		EndAt:       in.EndAt.UTC(),
		Capacity:    in.Capacity,
		Status:      domain.EventStatusDraft,
	})
	if err != nil {
		return domain.Event{}, nil, err
	}

	if err := s.events.SetTicketTypes(ctx, created.ID, toTicketTypes(created.ID, in.TicketTypes)); err != nil {
		return domain.Event{}, nil, err
	}

	cats, err := s.resolveCategories(ctx, in.Categories)
	if err != nil {
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
	event.TicketTypes = ticketTypes
	return event, cats, nil
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

	if in.Title != nil {
		event.Title = strings.TrimSpace(*in.Title)
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

	var ticketTypes []domain.TicketType
	if in.TicketTypes != nil {
		if err := validateTicketCapacity(event.Capacity, *in.TicketTypes); err != nil {
			return domain.Event{}, nil, err
		}
		ticketTypes = toTicketTypes(eventID, *in.TicketTypes)
		if err := s.events.SetTicketTypes(ctx, eventID, ticketTypes); err != nil {
			return domain.Event{}, nil, err
		}
	} else {
		existingTicketTypes, getErr := s.events.GetTicketTypes(ctx, eventID)
		if getErr != nil {
			return domain.Event{}, nil, getErr
		}
		existingInput := make([]TicketTypeInput, 0, len(existingTicketTypes))
		for _, tt := range existingTicketTypes {
			existingInput = append(existingInput, TicketTypeInput{
				Name:     tt.Name,
				Price:    tt.Price,
				Quantity: tt.Quantity,
			})
		}
		if err := validateTicketCapacity(event.Capacity, existingInput); err != nil {
			return domain.Event{}, nil, err
		}
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

	created, err := s.AddPhoto(ctx, organizerID, eventID, mimeType, r)
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
	cats := make([][]domain.Category, 0, len(events))
	for i := range events {
		tts, err := s.events.GetTicketTypes(ctx, events[i].ID)
		if err != nil {
			return nil, nil, err
		}
		eventCats, err := s.events.GetCategories(ctx, events[i].ID)
		if err != nil {
			return nil, nil, err
		}
		events[i].TicketTypes = tts
		cats = append(cats, eventCats)
	}
	return events, cats, nil
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
		return fmt.Errorf("missing required event fields")
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
