package middleware

import (
	"github.com/gofiber/fiber/v2"
	fiberlogger "github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/requestid"
)

func RequestID() fiber.Handler {
	return requestid.New(requestid.Config{
		Header:     "X-Request-ID",
		ContextKey: "requestid",
	})
}

func RequestLogger() fiber.Handler {
	return fiberlogger.New(fiberlogger.Config{
		Format: "[${time}] req_id=${locals:requestid} ${status} ${latency} ${method} ${path}\n",
	})
}
