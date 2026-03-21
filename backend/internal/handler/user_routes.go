package handler

import (
	"github.com/gofiber/fiber/v2"

	"nexustickets/internal/domain"
	"nexustickets/internal/middleware"
)

func RegisterUserRoutes(router fiber.Router, userHandler *UserHandler, jwtSecret string) {
	users := router.Group("/users")
	users.Use(middleware.JWTAuth(jwtSecret))

	users.Get("/me", userHandler.Me)
	users.Patch("/me", userHandler.UpdateMe)

	admin := users.Group("/admin")
	admin.Use(middleware.RequireRole(domain.UserRoleAdmin))
	admin.Get("/", userHandler.AdminListUsers)
	admin.Get("/:id", userHandler.AdminGetUser)
	admin.Patch("/:id/approve", userHandler.AdminApproveUser)
	admin.Patch("/:id/reject", userHandler.AdminRejectUser)
}
