package handler

import (
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
	return response.Created(c, toBookingResponse(booking))
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
	return response.OK(c, toBookingResponse(booking))
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
	out := make([]dto.BookingResponse, 0, len(bookings))
	for _, b := range bookings {
		out = append(out, toBookingResponse(b))
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
	out := make([]dto.BookingResponse, 0, len(bookings))
	for _, b := range bookings {
		out = append(out, toBookingResponse(b))
	}
	return response.OK(c, out)
}

func toBookingResponse(b domain.Booking) dto.BookingResponse {
	return dto.BookingResponse{
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
}
