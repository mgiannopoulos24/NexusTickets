package handler

import (
	"context"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"nexustickets/internal/domain"
	"nexustickets/internal/dto"
	"nexustickets/internal/service"
	"nexustickets/pkg/response"
)

type BookingHandler struct {
	service *service.BookingService
}

func NewBookingHandler(bookingService *service.BookingService) *BookingHandler {
	return &BookingHandler{service: bookingService}
}

func (h *BookingHandler) Create(c *fiber.Ctx) error {
	userID, err := authUserID(c)
	if err != nil {
		return err
	}
	role, err := authUserRole(c)
	if err != nil {
		return err
	}

	var req dto.CreateBookingRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	eventID, err := uuid.Parse(strings.TrimSpace(req.EventID))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid event_id")
	}
	ticketTypeID, err := uuid.Parse(strings.TrimSpace(req.TicketTypeID))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid ticket_type_id")
	}

	booking, err := h.service.CreateBooking(c.Context(), userID, role, service.CreateBookingInput{
		EventID:      eventID,
		TicketTypeID: ticketTypeID,
		Quantity:     req.Quantity,
	})
	if err != nil {
		return err
	}
	out, err := h.hydrate(c, []domain.Booking{booking})
	if err != nil {
		return err
	}
	return response.Created(c, out[0])
}

func (h *BookingHandler) Get(c *fiber.Ctx) error {
	userID, err := authUserID(c)
	if err != nil {
		return err
	}
	role, err := authUserRole(c)
	if err != nil {
		return err
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid booking id")
	}
	booking, err := h.service.GetBooking(c.Context(), userID, role, id)
	if err != nil {
		return err
	}
	out, err := h.hydrate(c, []domain.Booking{booking})
	if err != nil {
		return err
	}
	return response.OK(c, out[0])
}

// Confirm finalises the caller's pending booking (§9: confirmed bookings are
// not reversible).
func (h *BookingHandler) Confirm(c *fiber.Ctx) error {
	return h.transition(c, h.service.ConfirmBooking)
}

// Cancel drops the caller's pending booking and releases its seats.
func (h *BookingHandler) Cancel(c *fiber.Ctx) error {
	return h.transition(c, h.service.CancelBooking)
}

func (h *BookingHandler) transition(
	c *fiber.Ctx,
	apply func(ctx context.Context, userID, bookingID uuid.UUID) (domain.Booking, error),
) error {
	userID, err := authUserID(c)
	if err != nil {
		return err
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid booking id")
	}
	booking, err := apply(c.Context(), userID, id)
	if err != nil {
		return err
	}
	out, err := h.hydrate(c, []domain.Booking{booking})
	if err != nil {
		return err
	}
	return response.OK(c, out[0])
}

func (h *BookingHandler) GetMyBookings(c *fiber.Ctx) error {
	userID, err := authUserID(c)
	if err != nil {
		return err
	}
	limit, offset, err := parsePage(c.Query("limit"), c.Query("offset"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	bookings, err := h.service.GetMyBookings(c.Context(), userID, limit, offset)
	if err != nil {
		return err
	}
	out, err := h.hydrate(c, bookings)
	if err != nil {
		return err
	}
	return response.OK(c, out)
}

func (h *BookingHandler) GetEventBookings(c *fiber.Ctx) error {
	organizerID, err := authUserID(c)
	if err != nil {
		return err
	}
	eventID, err := uuid.Parse(c.Params("eventId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid event id")
	}
	limit, offset, err := parsePage(c.Query("limit"), c.Query("offset"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	bookings, err := h.service.GetEventBookings(c.Context(), organizerID, eventID, limit, offset)
	if err != nil {
		return err
	}
	out, err := h.hydrate(c, bookings)
	if err != nil {
		return err
	}
	return response.OK(c, out)
}

// hydrate attaches the event, ticket type and attendee each booking refers to.
// Both booking screens need those names; without them the UI could only show
// raw UUIDs.
func (h *BookingHandler) hydrate(c *fiber.Ctx, bookings []domain.Booking) ([]dto.BookingResponse, error) {
	out := make([]dto.BookingResponse, 0, len(bookings))
	if len(bookings) == 0 {
		return out, nil
	}

	refs, err := h.service.HydrateBookings(c.Context(), bookings)
	if err != nil {
		return nil, err
	}

	for _, b := range bookings {
		resp := toBookingResponse(b)
		if ev, ok := refs.Events[b.EventID]; ok {
			resp.Event = &dto.BookingEventSummary{
				ID:          ev.ID.String(),
				OrganizerID: ev.OrganizerID.String(),
				Title:       ev.Title,
				Venue:       ev.Venue,
				City:        ev.City,
				StartAt:     ev.StartAt.UTC().Format(time.RFC3339),
				EndAt:       ev.EndAt.UTC().Format(time.RFC3339),
				Status:      string(ev.Status),
			}
		}
		if tt, ok := refs.TicketTypes[b.TicketTypeID]; ok {
			resp.TicketType = &dto.BookingTicketType{
				ID:    tt.ID.String(),
				Name:  tt.Name,
				Price: tt.Price,
			}
		}
		if u, ok := refs.Attendees[b.UserID]; ok {
			resp.Attendee = &dto.BookingAttendee{
				ID:       u.ID.String(),
				Username: u.Username,
				FullName: strings.TrimSpace(u.FirstName + " " + u.LastName),
				Email:    u.Email,
			}
		}
		out = append(out, resp)
	}
	return out, nil
}

func toBookingResponse(b domain.Booking) dto.BookingResponse {
	resp := dto.BookingResponse{
		ID:           b.ID.String(),
		UserID:       b.UserID.String(),
		EventID:      b.EventID.String(),
		TicketTypeID: b.TicketTypeID.String(),
		Quantity:     b.Quantity,
		TotalCost:    b.TotalCost,
		Status:       string(b.Status),
		CreatedAt:    b.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:    b.UpdatedAt.UTC().Format(time.RFC3339),
	}
	if b.ConfirmedAt != nil {
		v := b.ConfirmedAt.UTC().Format(time.RFC3339)
		resp.ConfirmedAt = &v
	}
	if b.Status == domain.BookingStatusPending {
		v := b.HoldExpiresAt().UTC().Format(time.RFC3339)
		resp.HoldExpiresAt = &v
	}
	return resp
}
