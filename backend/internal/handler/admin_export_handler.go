package handler

import (
	"bufio"
	"context"

	"github.com/gofiber/fiber/v2"

	"nexustickets/internal/service"
)

type AdminExportHandler struct {
	svc *service.CatalogExportService
}

func NewAdminExportHandler(svc *service.CatalogExportService) *AdminExportHandler {
	return &AdminExportHandler{svc: svc}
}

func (h *AdminExportHandler) ExportXML(c *fiber.Ctx) error {
	c.Set("Content-Type", "application/xml; charset=utf-8")
	c.Set("Content-Disposition", `attachment; filename="events.xml"`)

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		ctx := c.UserContext()
		if ctx == nil {
			ctx = context.Background()
		}
		_ = h.svc.ExportCatalogXML(ctx, w)
	})
	return nil
}

func (h *AdminExportHandler) ExportJSON(c *fiber.Ctx) error {
	c.Set("Content-Type", "application/json; charset=utf-8")
	c.Set("Content-Disposition", `attachment; filename="events.json"`)

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		ctx := c.UserContext()
		if ctx == nil {
			ctx = context.Background()
		}
		_ = h.svc.ExportCatalogJSON(ctx, w)
	})
	return nil
}
