package middleware

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"nexustickets/internal/domain"
	"nexustickets/pkg/response"
)

func ErrorHandler(log *zap.Logger) fiber.ErrorHandler {
	return func(c *fiber.Ctx, err error) error {
		var fe *fiber.Error
		if errors.As(err, &fe) {
			return response.Error(c, fe.Code, "request_error", fe.Message)
		}

		var ve *domain.ValidationError
		if errors.As(err, &ve) {
			return response.Error(c, fiber.StatusBadRequest, "validation_error", ve.Message)
		}

		switch {
		case errors.Is(err, domain.ErrUnauthorized):
			return response.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
		case errors.Is(err, domain.ErrForbidden):
			return response.Error(c, fiber.StatusForbidden, "forbidden", err.Error())
		case errors.Is(err, domain.ErrNotFound):
			return response.Error(c, fiber.StatusNotFound, "not_found", err.Error())
		case errors.Is(err, domain.ErrUsernameTaken), errors.Is(err, domain.ErrEmailTaken):
			return response.Error(c, fiber.StatusConflict, "conflict", err.Error())
		case errors.Is(err, domain.ErrInvalidRole):
			return response.Error(c, fiber.StatusBadRequest, "invalid_role", err.Error())
		case errors.Is(err, domain.ErrMessagingNotAllowed):
			return response.Error(c, fiber.StatusForbidden, "messaging_not_allowed", err.Error())
		case errors.Is(err, domain.ErrEventNotBookable),
			errors.Is(err, domain.ErrEventNotDeletable),
			errors.Is(err, domain.ErrEventNotCancellable),
			errors.Is(err, domain.ErrInvalidEventState),
			errors.Is(err, domain.ErrTicketTypeLocked),
			errors.Is(err, domain.ErrEventEnded),
			errors.Is(err, domain.ErrEventLocked),
			errors.Is(err, domain.ErrEventNeedsCategory),
			errors.Is(err, domain.ErrEventNeedsTicketType):
			return response.Error(c, fiber.StatusUnprocessableEntity, "business_rule_violation", err.Error())
		case errors.Is(err, domain.ErrCapacityExceeded):
			return response.Error(c, fiber.StatusConflict, "capacity_exceeded", err.Error())
		default:
			log.Error("unhandled error", zap.Error(err))
			return response.Error(c, fiber.StatusInternalServerError, "internal_error", "internal server error")
		}
	}
}
