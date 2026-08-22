package handler

import (
	"bufio"
	"context"
	"io"
	"time"

	"github.com/gofiber/fiber/v2"

	"nexustickets/internal/service"
)

// exportTimeout bounds a single catalogue export. The work runs after the HTTP
// handler has returned, so it cannot inherit the request's deadline.
const exportTimeout = 5 * time.Minute

type AdminExportHandler struct {
	svc *service.CatalogExportService
}

func NewAdminExportHandler(svc *service.CatalogExportService) *AdminExportHandler {
	return &AdminExportHandler{svc: svc}
}

// startExport wires a streaming response.
//
// SetBodyStreamWriter invokes its callback *after* this handler returns, by
// which point Fiber has released the *fiber.Ctx back to its pool. Touching the
// Ctx from inside the callback — c.UserContext(), c.Params(), anything —
// dereferences a recycled object and panics, taking the process down with it.
// So the callback closes over nothing but a detached context and the writer.
func startExport(c *fiber.Ctx, filename, contentType string, run func(context.Context, io.Writer) error) error {
	c.Set("Content-Type", contentType)
	c.Set("Content-Disposition", `attachment; filename="`+filename+`"`)

	ctx, cancel := context.WithTimeout(context.Background(), exportTimeout)
	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		defer cancel()
		if err := run(ctx, w); err != nil {
			// The status line is already on the wire, so the only honest signal
			// left is to stop writing; the truncated body tells the client.
			return
		}
		_ = w.Flush()
	})
	return nil
}

func (h *AdminExportHandler) ExportXML(c *fiber.Ctx) error {
	return startExport(c, "events.xml", "application/xml; charset=utf-8", h.svc.ExportCatalogXML)
}

func (h *AdminExportHandler) ExportJSON(c *fiber.Ctx) error {
	return startExport(c, "events.json", "application/json; charset=utf-8", h.svc.ExportCatalogJSON)
}
