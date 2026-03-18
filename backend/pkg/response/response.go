package response

import "github.com/gofiber/fiber/v2"

type Envelope[T any] struct {
	Data  T         `json:"data"`
	Error *APIError `json:"error"`
	Meta  any       `json:"meta"`
}

type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func OK[T any](c *fiber.Ctx, data T) error {
	return c.Status(fiber.StatusOK).JSON(Envelope[T]{Data: data, Error: nil, Meta: nil})
}

func Created[T any](c *fiber.Ctx, data T) error {
	return c.Status(fiber.StatusCreated).JSON(Envelope[T]{Data: data, Error: nil, Meta: nil})
}

func Paginated[T any](c *fiber.Ctx, data T, meta any) error {
	return c.Status(fiber.StatusOK).JSON(Envelope[T]{Data: data, Error: nil, Meta: meta})
}

func Error(c *fiber.Ctx, status int, code, message string) error {
	return c.Status(status).JSON(Envelope[any]{Data: nil, Error: &APIError{Code: code, Message: message}, Meta: nil})
}
