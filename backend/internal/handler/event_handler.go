package handler

import (
	"bytes"
	"io"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"nexustickets/internal/domain"
	"nexustickets/internal/dto"
	"nexustickets/internal/service"
	"nexustickets/pkg/response"
)

const maxPhotoUploadBytes = 5 * 1024 * 1024

type EventHandler struct {
	service *service.EventService
}

func NewEventHandler(eventService *service.EventService) *EventHandler {
	return &EventHandler{service: eventService}
}

func (h *EventHandler) Create(c *fiber.Ctx) error {
	organizerID, err := authUserID(c)
	if err != nil {
		return err
	}

	var req dto.CreateEventRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	startAt, err := time.Parse(time.RFC3339, strings.TrimSpace(req.StartAt))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid start_at (expected RFC3339)")
	}
	endAt, err := time.Parse(time.RFC3339, strings.TrimSpace(req.EndAt))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid end_at (expected RFC3339)")
	}

	event, cats, err := h.service.Create(c.Context(), organizerID, service.CreateEventInput{
		Title:            req.Title,
		Description:      req.Description,
		Venue:            req.Venue,
		EventType:        req.EventType,
		FeaturedImageURL: req.FeaturedImageURL,
		EventDetail:      req.EventDetail,
		Address:          req.Address,
		City:             req.City,
		Country:          req.Country,
		Latitude:         req.Latitude,
		Longitude:        req.Longitude,
		StartAt:          startAt,
		EndAt:            endAt,
		Capacity:         req.Capacity,
		Categories:       req.Categories,
		TicketTypes:      toTicketTypeInputs(req.TicketTypes),
	})
	if err != nil {
		return err
	}
	return response.Created(c, toEventResponse(event, cats))
}

func (h *EventHandler) Get(c *fiber.Ctx) error {
	eventID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid event id")
	}
	viewerID, _ := optionalAuthUserID(c)
	viewerRole, _ := c.Locals("role").(string)

	event, cats, err := h.service.GetForViewer(c.Context(), eventID, viewerID, domain.UserRole(viewerRole))
	if err != nil {
		return err
	}
	if viewerID != uuid.Nil {
		_ = h.service.RecordEventView(c.Context(), viewerID, eventID)
	}
	return response.OK(c, toEventResponse(event, cats))
}

func (h *EventHandler) List(c *fiber.Ctx) error {
	limit, offset, err := parsePage(c.Query("limit"), c.Query("offset"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	events, cats, err := h.service.List(c.Context(), limit, offset)
	if err != nil {
		return err
	}
	out := make([]dto.EventResponse, 0, len(events))
	for i := range events {
		out = append(out, toEventResponse(events[i], cats[i]))
	}
	return response.OK(c, out)
}

// Recommended returns personalized event recommendations for the current user,
// falling back to popular events for guests / cold-start users (Req 13).
func (h *EventHandler) Recommended(c *fiber.Ctx) error {
	limit, _, err := parsePage(c.Query("limit"), c.Query("offset"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	// Optional auth: a signed-in user gets personalized results; guests get popular.
	userID, _ := optionalAuthUserID(c)

	events, cats, err := h.service.Recommended(c.Context(), userID, limit)
	if err != nil {
		return err
	}
	out := make([]dto.EventResponse, 0, len(events))
	for i := range events {
		out = append(out, toEventResponse(events[i], cats[i]))
	}
	return response.OK(c, out)
}

func (h *EventHandler) Search(c *fiber.Ctx) error {
	limit, offset, err := parsePage(c.Query("limit"), c.Query("offset"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	var afterStart *time.Time
	var afterID *uuid.UUID
	if raw := strings.TrimSpace(c.Query("after_start")); raw != "" {
		ts, parseErr := time.Parse(time.RFC3339, raw)
		if parseErr != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid after_start (expected RFC3339)")
		}
		u := ts.UTC()
		afterStart = &u
	}
	if raw := strings.TrimSpace(c.Query("after_id")); raw != "" {
		id, parseErr := uuid.Parse(raw)
		if parseErr != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid after_id")
		}
		afterID = &id
	}
	if (afterStart == nil) != (afterID == nil) {
		return fiber.NewError(fiber.StatusBadRequest, "after_start and after_id must be provided together")
	}
	if afterStart != nil {
		offset = 0
	}

	startAt, err := optionalRFC3339(c.Query("start_at"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid start_at (expected RFC3339)")
	}
	endAt, err := optionalRFC3339(c.Query("end_at"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid end_at (expected RFC3339)")
	}
	minPrice, err := optionalFloat(c.Query("min_price"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid min_price")
	}
	maxPrice, err := optionalFloat(c.Query("max_price"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid max_price")
	}

	events, cats, hasMore, err := h.service.Search(c.Context(), service.SearchEventsInput{
		CategoryIDs:  parseUUIDList(c.Query("category_ids")),
		Title:        c.Query("title"),
		Query:        c.Query("q"),
		City:         c.Query("city"),
		StartAt:      startAt,
		EndAt:        endAt,
		MinPrice:     minPrice,
		MaxPrice:     maxPrice,
		AfterStartAt: afterStart,
		AfterID:      afterID,
	}, limit, offset)
	if err != nil {
		return err
	}
	out := make([]dto.EventResponse, 0, len(events))
	for i := range events {
		out = append(out, toEventResponse(events[i], cats[i]))
	}
	meta := fiber.Map{
		"has_more": hasMore,
	}
	if hasMore && len(events) > 0 {
		last := events[len(events)-1]
		nextStart := last.StartAt.UTC().Format(time.RFC3339)
		nextID := last.ID.String()
		meta["next_after_start"] = nextStart
		meta["next_after_id"] = nextID
	}
	return response.Paginated(c, out, meta)
}

func (h *EventHandler) GetOrganizerEvents(c *fiber.Ctx) error {
	organizerID, err := authUserID(c)
	if err != nil {
		return err
	}
	limit, offset, err := parsePage(c.Query("limit"), c.Query("offset"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	events, cats, err := h.service.GetOrganizerEvents(c.Context(), organizerID, limit, offset)
	if err != nil {
		return err
	}
	out := make([]dto.EventResponse, 0, len(events))
	for i := range events {
		out = append(out, toEventResponse(events[i], cats[i]))
	}
	return response.OK(c, out)
}

func (h *EventHandler) Update(c *fiber.Ctx) error {
	organizerID, err := authUserID(c)
	if err != nil {
		return err
	}
	eventID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid event id")
	}

	var req dto.UpdateEventRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	in := service.UpdateEventInput{
		Title:            req.Title,
		Description:      req.Description,
		Venue:            req.Venue,
		EventType:        req.EventType,
		FeaturedImageURL: req.FeaturedImageURL,
		EventDetail:      req.EventDetail,
		Address:          req.Address,
		City:             req.City,
		Country:          req.Country,
		Latitude:         req.Latitude,
		Longitude:        req.Longitude,
		Capacity:         req.Capacity,
		Categories:       req.Categories,
	}
	if req.StartAt != nil {
		ts, parseErr := time.Parse(time.RFC3339, strings.TrimSpace(*req.StartAt))
		if parseErr != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid start_at (expected RFC3339)")
		}
		in.StartAt = &ts
	}
	if req.EndAt != nil {
		ts, parseErr := time.Parse(time.RFC3339, strings.TrimSpace(*req.EndAt))
		if parseErr != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid end_at (expected RFC3339)")
		}
		in.EndAt = &ts
	}
	if req.TicketTypes != nil {
		items := toTicketTypeInputs(*req.TicketTypes)
		in.TicketTypes = &items
	}

	event, cats, err := h.service.Update(c.Context(), organizerID, eventID, in)
	if err != nil {
		return err
	}
	return response.OK(c, toEventResponse(event, cats))
}

func (h *EventHandler) Delete(c *fiber.Ctx) error {
	organizerID, err := authUserID(c)
	if err != nil {
		return err
	}
	eventID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid event id")
	}
	if err := h.service.Delete(c.Context(), organizerID, eventID); err != nil {
		return err
	}
	return response.OK(c, fiber.Map{"message": "event deleted"})
}

func (h *EventHandler) Publish(c *fiber.Ctx) error {
	organizerID, err := authUserID(c)
	if err != nil {
		return err
	}
	eventID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid event id")
	}
	event, cats, err := h.service.Publish(c.Context(), organizerID, eventID)
	if err != nil {
		return err
	}
	return response.OK(c, toEventResponse(event, cats))
}

func (h *EventHandler) Cancel(c *fiber.Ctx) error {
	organizerID, err := authUserID(c)
	if err != nil {
		return err
	}
	eventID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid event id")
	}
	event, cats, err := h.service.Cancel(c.Context(), organizerID, eventID)
	if err != nil {
		return err
	}
	return response.OK(c, toEventResponse(event, cats))
}

func (h *EventHandler) AddTicketType(c *fiber.Ctx) error {
	organizerID, err := authUserID(c)
	if err != nil {
		return err
	}
	eventID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid event id")
	}

	var req dto.TicketTypeRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	event, cats, err := h.service.AddTicketType(c.Context(), organizerID, eventID, service.TicketTypeInput{
		Name:     req.Name,
		Price:    req.Price,
		Quantity: req.Quantity,
	})
	if err != nil {
		return err
	}
	return response.OK(c, toEventResponse(event, cats))
}

func (h *EventHandler) UpdateTicketType(c *fiber.Ctx) error {
	organizerID, err := authUserID(c)
	if err != nil {
		return err
	}
	eventID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid event id")
	}
	ticketTypeID, err := uuid.Parse(c.Params("ticketTypeId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid ticket type id")
	}

	var req dto.TicketTypeRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	event, cats, err := h.service.UpdateTicketType(c.Context(), organizerID, eventID, ticketTypeID, service.TicketTypeInput{
		Name:     req.Name,
		Price:    req.Price,
		Quantity: req.Quantity,
	})
	if err != nil {
		return err
	}
	return response.OK(c, toEventResponse(event, cats))
}

func (h *EventHandler) DeleteTicketType(c *fiber.Ctx) error {
	organizerID, err := authUserID(c)
	if err != nil {
		return err
	}
	eventID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid event id")
	}
	ticketTypeID, err := uuid.Parse(c.Params("ticketTypeId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid ticket type id")
	}

	event, cats, err := h.service.DeleteTicketType(c.Context(), organizerID, eventID, ticketTypeID)
	if err != nil {
		return err
	}
	return response.OK(c, toEventResponse(event, cats))
}

func (h *EventHandler) UploadPhoto(c *fiber.Ctx) error {
	organizerID, err := authUserID(c)
	if err != nil {
		return err
	}
	eventID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid event id")
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "file is required")
	}
	if fileHeader.Size <= 0 {
		return fiber.NewError(fiber.StatusBadRequest, "empty file")
	}
	if fileHeader.Size > maxPhotoUploadBytes {
		return fiber.NewError(fiber.StatusBadRequest, "file too large (max 5MB)")
	}

	file, err := fileHeader.Open()
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "unable to open uploaded file")
	}
	defer func() { _ = file.Close() }()

	sniff := make([]byte, 512)
	n, err := io.ReadFull(file, sniff)
	if err != nil && err != io.ErrUnexpectedEOF {
		return fiber.NewError(fiber.StatusBadRequest, "unable to read uploaded file")
	}
	mimeType, ok := service.DetectImageMIME(sniff[:n])
	if !ok {
		return fiber.NewError(fiber.StatusBadRequest, "unsupported image type: "+mimeType)
	}

	reader := io.MultiReader(bytes.NewReader(sniff[:n]), file)
	created, err := h.service.AddPhoto(c.Context(), organizerID, eventID, mimeType, reader)
	if err != nil {
		return err
	}

	return response.Created(c, fiber.Map{
		"id":           created.ID.String(),
		"event_id":     created.EventID.String(),
		"storage_path": created.StoragePath,
		"url":          "/uploads/media/" + filepath.ToSlash(created.StoragePath),
		"position":     created.Position,
		"created_at":   created.CreatedAt.UTC().Format(time.RFC3339),
	})
}

func (h *EventHandler) UploadFeaturedImage(c *fiber.Ctx) error {
	organizerID, err := authUserID(c)
	if err != nil {
		return err
	}
	eventID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid event id")
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "file is required")
	}
	if fileHeader.Size <= 0 {
		return fiber.NewError(fiber.StatusBadRequest, "empty file")
	}
	if fileHeader.Size > maxPhotoUploadBytes {
		return fiber.NewError(fiber.StatusBadRequest, "file too large (max 5MB)")
	}

	file, err := fileHeader.Open()
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "unable to open uploaded file")
	}
	defer func() { _ = file.Close() }()

	sniff := make([]byte, 512)
	n, err := io.ReadFull(file, sniff)
	if err != nil && err != io.ErrUnexpectedEOF {
		return fiber.NewError(fiber.StatusBadRequest, "unable to read uploaded file")
	}
	mimeType, ok := service.DetectImageMIME(sniff[:n])
	if !ok {
		return fiber.NewError(fiber.StatusBadRequest, "unsupported image type: "+mimeType)
	}

	reader := io.MultiReader(bytes.NewReader(sniff[:n]), file)
	event, cats, err := h.service.SetFeaturedImage(c.Context(), organizerID, eventID, mimeType, reader)
	if err != nil {
		return err
	}
	return response.OK(c, toEventResponse(event, cats))
}

func (h *EventHandler) AdminUploadFeaturedImage(c *fiber.Ctx) error {
	eventID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid event id")
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "file is required")
	}
	if fileHeader.Size <= 0 {
		return fiber.NewError(fiber.StatusBadRequest, "empty file")
	}
	if fileHeader.Size > maxPhotoUploadBytes {
		return fiber.NewError(fiber.StatusBadRequest, "file too large (max 5MB)")
	}

	file, err := fileHeader.Open()
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "unable to open uploaded file")
	}
	defer func() { _ = file.Close() }()

	sniff := make([]byte, 512)
	n, err := io.ReadFull(file, sniff)
	if err != nil && err != io.ErrUnexpectedEOF {
		return fiber.NewError(fiber.StatusBadRequest, "unable to read uploaded file")
	}
	mimeType, ok := service.DetectImageMIME(sniff[:n])
	if !ok {
		return fiber.NewError(fiber.StatusBadRequest, "unsupported image type: "+mimeType)
	}

	reader := io.MultiReader(bytes.NewReader(sniff[:n]), file)
	event, cats, err := h.service.AdminSetFeaturedImage(c.Context(), eventID, mimeType, reader)
	if err != nil {
		return err
	}
	return response.OK(c, toEventResponse(event, cats))
}

func (h *EventHandler) DeletePhoto(c *fiber.Ctx) error {
	organizerID, err := authUserID(c)
	if err != nil {
		return err
	}
	eventID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid event id")
	}
	photoID, err := uuid.Parse(c.Params("photoId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid photo id")
	}

	if err := h.service.DeletePhoto(c.Context(), organizerID, eventID, photoID); err != nil {
		return err
	}
	return response.OK(c, fiber.Map{"message": "photo deleted"})
}

func (h *EventHandler) AdminListEvents(c *fiber.Ctx) error {
	limit, offset, err := parsePage(c.Query("limit"), c.Query("offset"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	var status *domain.EventStatus
	if raw := strings.TrimSpace(c.Query("status")); raw != "" {
		st := domain.EventStatus(raw)
		status = &st
	}
	events, cats, total, err := h.service.AdminList(c.Context(), c.Query("q"), status, limit, offset)
	if err != nil {
		return err
	}
	out := make([]dto.EventResponse, 0, len(events))
	for i := range events {
		out = append(out, toEventResponse(events[i], cats[i]))
	}
	return response.Paginated(c, out, fiber.Map{"total": total, "limit": limit, "offset": offset})
}

func (h *EventHandler) AdminGetEvent(c *fiber.Ctx) error {
	eventID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid event id")
	}
	event, cats, err := h.service.AdminGet(c.Context(), eventID)
	if err != nil {
		return err
	}
	return response.OK(c, toEventResponse(event, cats))
}

func (h *EventHandler) AdminUpdateEvent(c *fiber.Ctx) error {
	eventID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid event id")
	}

	var req dto.UpdateEventRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	in := service.AdminUpdateEventInput{
		Title:            req.Title,
		Description:      req.Description,
		Venue:            req.Venue,
		EventType:        req.EventType,
		FeaturedImageURL: req.FeaturedImageURL,
		EventDetail:      req.EventDetail,
		Address:          req.Address,
		City:             req.City,
		Country:          req.Country,
		Latitude:         req.Latitude,
		Longitude:        req.Longitude,
		Capacity:         req.Capacity,
		Categories:       req.Categories,
	}
	if req.StartAt != nil {
		ts, parseErr := time.Parse(time.RFC3339, strings.TrimSpace(*req.StartAt))
		if parseErr != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid start_at (expected RFC3339)")
		}
		in.StartAt = &ts
	}
	if req.EndAt != nil {
		ts, parseErr := time.Parse(time.RFC3339, strings.TrimSpace(*req.EndAt))
		if parseErr != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid end_at (expected RFC3339)")
		}
		in.EndAt = &ts
	}
	if req.Status != nil {
		raw := strings.TrimSpace(*req.Status)
		if raw != "" {
			st := domain.EventStatus(strings.ToLower(raw))
			if !domain.ValidEventStatus(st) {
				return fiber.NewError(fiber.StatusBadRequest, "invalid status (use draft, published, completed, or cancelled)")
			}
			in.Status = &st
		}
	}

	event, cats, err := h.service.AdminUpdate(c.Context(), eventID, in)
	if err != nil {
		return err
	}
	return response.OK(c, toEventResponse(event, cats))
}

func toEventResponse(event domain.Event, cats []domain.Category) dto.EventResponse {
	respCats := make([]string, 0, len(cats))
	for _, c := range cats {
		respCats = append(respCats, c.Name)
	}

	respTickets := make([]dto.TicketTypeResponse, 0, len(event.TicketTypes))
	sold, remaining := 0, 0
	for _, tt := range event.TicketTypes {
		respTickets = append(respTickets, dto.TicketTypeResponse{
			ID:        tt.ID.String(),
			Name:      tt.Name,
			Price:     tt.Price,
			Quantity:  tt.Quantity,
			Available: tt.Available,
		})
		sold += tt.Quantity - tt.Available
		remaining += tt.Available
	}

	respPhotos := make([]dto.EventPhotoResponse, 0, len(event.Photos))
	for _, ph := range event.Photos {
		respPhotos = append(respPhotos, dto.EventPhotoResponse{
			ID:       ph.ID.String(),
			URL:      "/uploads/media/" + ph.StoragePath,
			Position: ph.Position,
		})
	}

	return dto.EventResponse{
		ID:               event.ID.String(),
		OrganizerID:      event.OrganizerID.String(),
		Title:            event.Title,
		Description:      event.Description,
		Venue:            event.Venue,
		EventType:        event.EventType,
		FeaturedImageURL: event.FeaturedImageURL,
		EventDetail:      event.Detail,
		Address:          event.Address,
		City:             event.City,
		Country:          event.Country,
		Latitude:         event.Latitude,
		Longitude:        event.Longitude,
		StartAt:          event.StartAt.UTC().Format(time.RFC3339),
		EndAt:            event.EndAt.UTC().Format(time.RFC3339),
		Capacity:         event.Capacity,
		Status:           string(event.Status),
		Categories:       respCats,
		TicketTypes:      respTickets,
		Photos:           respPhotos,
		TicketsSold:      sold,
		TicketsRemaining: remaining,
		CreatedAt:        event.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:        event.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func toTicketTypeInputs(in []dto.TicketTypeRequest) []service.TicketTypeInput {
	out := make([]service.TicketTypeInput, 0, len(in))
	for _, tt := range in {
		input := service.TicketTypeInput{
			Name:     tt.Name,
			Price:    tt.Price,
			Quantity: tt.Quantity,
		}
		if tt.ID != nil && strings.TrimSpace(*tt.ID) != "" {
			if id, err := uuid.Parse(strings.TrimSpace(*tt.ID)); err == nil {
				input.ID = &id
			}
		}
		out = append(out, input)
	}
	return out
}

func optionalAuthUserID(c *fiber.Ctx) (uuid.UUID, bool) {
	raw, ok := c.Locals("user_id").(string)
	if !ok || strings.TrimSpace(raw) == "" {
		return uuid.Nil, false
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, false
	}
	return id, true
}

func parseUUIDList(raw string) []uuid.UUID {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]uuid.UUID, 0, len(parts))
	for _, p := range parts {
		id, err := uuid.Parse(strings.TrimSpace(p))
		if err != nil {
			continue
		}
		out = append(out, id)
	}
	return out
}

func optionalRFC3339(raw string) (*time.Time, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}
	ts, err := time.Parse(time.RFC3339, trimmed)
	if err != nil {
		return nil, err
	}
	ts = ts.UTC()
	return &ts, nil
}

func optionalFloat(raw string) (*float64, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}
	parsed, err := strconv.ParseFloat(trimmed, 64)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}
