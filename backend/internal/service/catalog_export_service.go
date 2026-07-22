package service

import (
	"bufio"
	"context"
	"encoding/xml"
	"io"

	"github.com/google/uuid"

	"nexustickets/internal/domain"
	"nexustickets/internal/export"
	repo "nexustickets/internal/repository"
)

const exportBatchSize = 100

// CatalogExportService streams the full event catalogue for admin export (Requirement 12).
type CatalogExportService struct {
	events   repo.EventRepository
	bookings repo.BookingRepository
	users    repo.UserRepository
}

func NewCatalogExportService(
	events repo.EventRepository,
	bookings repo.BookingRepository,
	users repo.UserRepository,
) *CatalogExportService {
	return &CatalogExportService{
		events:   events,
		bookings: bookings,
		users:    users,
	}
}

// ExportCatalogXML streams UTF-8 XML in batches without buffering the full catalogue in memory.
func (s *CatalogExportService) ExportCatalogXML(ctx context.Context, w io.Writer) error {
	if _, err := w.Write([]byte(xml.Header)); err != nil {
		return err
	}
	if _, err := io.WriteString(w, "<"+export.CatalogRootElement()+">\n"); err != nil {
		return err
	}

	enc := xml.NewEncoder(w)
	enc.Indent("", "  ")

	offset := 0
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		events, err := s.events.ListForExport(ctx, exportBatchSize, offset)
		if err != nil {
			return err
		}
		if len(events) == 0 {
			break
		}

		if err := s.encodeExportBatchXML(ctx, enc, events); err != nil {
			return err
		}
		if err := flushWriter(w); err != nil {
			return err
		}

		offset += len(events)
	}

	_, err := io.WriteString(w, "</"+export.CatalogRootElement()+">\n")
	return err
}

func (s *CatalogExportService) encodeExportBatchXML(ctx context.Context, enc *xml.Encoder, events []domain.Event) error {
	ids := make([]uuid.UUID, len(events))
	for i := range events {
		ids[i] = events[i].ID
	}

	ttByEvent, err := s.events.ListTicketTypesByEventIDs(ctx, ids)
	if err != nil {
		return err
	}
	catByEvent, err := s.events.ListCategoriesByEventIDs(ctx, ids)
	if err != nil {
		return err
	}
	photoByEvent, err := s.events.ListPhotosByEventIDs(ctx, ids)
	if err != nil {
		return err
	}
	allBookings, err := s.bookings.ListByEventIDs(ctx, ids)
	if err != nil {
		return err
	}
	byEvent := groupBookingsByEvent(allBookings)

	for i := range events {
		ev := events[i]
		ev.TicketTypes = ttByEvent[ev.ID]
		ev.Bookings = byEvent[ev.ID]
		cats := catByEvent[ev.ID]
		node := export.BuildEventExportXML(ev, cats, photoByEvent[ev.ID])
		if err := enc.Encode(node); err != nil {
			return err
		}
	}
	return nil
}

// ExportCatalogJSON streams a single JSON object with an "events" array; elements are written per batch.
func (s *CatalogExportService) ExportCatalogJSON(ctx context.Context, w io.Writer) error {
	if _, err := io.WriteString(w, `{"events":[`); err != nil {
		return err
	}

	first := true
	offset := 0
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		events, err := s.events.ListForExport(ctx, exportBatchSize, offset)
		if err != nil {
			return err
		}
		if len(events) == 0 {
			break
		}

		ids := make([]uuid.UUID, len(events))
		for i := range events {
			ids[i] = events[i].ID
		}

		ttByEvent, err := s.events.ListTicketTypesByEventIDs(ctx, ids)
		if err != nil {
			return err
		}
		catByEvent, err := s.events.ListCategoriesByEventIDs(ctx, ids)
		if err != nil {
			return err
		}
		photoByEvent, err := s.events.ListPhotosByEventIDs(ctx, ids)
		if err != nil {
			return err
		}
		allBookings, err := s.bookings.ListByEventIDs(ctx, ids)
		if err != nil {
			return err
		}
		byEvent := groupBookingsByEvent(allBookings)

		for i := range events {
			ev := events[i]
			ev.TicketTypes = ttByEvent[ev.ID]
			ev.Bookings = byEvent[ev.ID]
			cats := catByEvent[ev.ID]
			j := export.BuildEventJSON(ev, cats, photoByEvent[ev.ID])
			b, err := export.MarshalEventJSON(j)
			if err != nil {
				return err
			}
			if !first {
				if _, err := w.Write([]byte(",")); err != nil {
					return err
				}
			}
			first = false
			if _, err := w.Write(b); err != nil {
				return err
			}
		}

		if err := flushWriter(w); err != nil {
			return err
		}
		offset += len(events)
	}

	_, err := io.WriteString(w, `]}`)
	return err
}

func groupBookingsByEvent(bookings []domain.Booking) map[uuid.UUID][]domain.Booking {
	out := make(map[uuid.UUID][]domain.Booking)
	for _, b := range bookings {
		out[b.EventID] = append(out[b.EventID], b)
	}
	return out
}

func flushWriter(w io.Writer) error {
	if bw, ok := w.(*bufio.Writer); ok {
		return bw.Flush()
	}
	return nil
}
