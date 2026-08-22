package export

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"strings"

	"nexustickets/internal/domain"
)

// catalogRootElement is the XML root that wraps all exported events.
// Per the assignment DTD (docs/assignment.pdf §7): <!ELEMENT Events (Event*)>.
const catalogRootElement = "Events"

// exportTimeLayout matches the DTD example format (e.g. 2025-07-12T20:30:00),
// with no timezone suffix.
const exportTimeLayout = "2006-01-02T15:04:05"

// catalogDoctype declares the external DTD the exported catalogue conforms to.
// docs/events-catalog.dtd is the copy shipped with the source.
const catalogDoctype = `<!DOCTYPE Events SYSTEM "events-catalog.dtd">`

// fallbackCategory keeps the document valid against `<!ELEMENT Event (Title,
// Category+, ...)>` for legacy rows created before a category was mandatory.
const fallbackCategory = "Uncategorized"

// fallbackEventType is used when an event predates the EventType column.
const fallbackEventType = "event"

// CatalogDoctype returns the DOCTYPE line for the exported catalogue.
func CatalogDoctype() string { return catalogDoctype }

// EventExportXML mirrors the assignment event export DTD exactly. Field order is
// significant: encoding/xml emits elements in declaration order, and the DTD
// content model is:
//
//	Event(EventID) -> Title, Category+, EventType, Venue, Address, City, Country,
//	                  GeoLocation?, StartDateTime, EndDateTime, Capacity,
//	                  TicketTypes, Bookings, Organizer, Status, Description, Media?
type EventExportXML struct {
	XMLName       xml.Name              `xml:"Event"`
	EventID       string                `xml:"EventID,attr"`
	Title         string                `xml:"Title"`
	Category      []string              `xml:"Category"`
	EventType     string                `xml:"EventType"`
	Venue         string                `xml:"Venue"`
	Address       string                `xml:"Address"`
	City          string                `xml:"City"`
	Country       string                `xml:"Country"`
	GeoLocation   *GeoLocationExportXML `xml:"GeoLocation,omitempty"`
	StartDateTime string                `xml:"StartDateTime"`
	EndDateTime   string                `xml:"EndDateTime"`
	Capacity      int                   `xml:"Capacity"`
	TicketTypes   TicketTypesExportXML  `xml:"TicketTypes"`
	Bookings      BookingsExportXML     `xml:"Bookings"`
	Organizer     OrganizerExportXML    `xml:"Organizer"`
	Status        string                `xml:"Status"`
	Description   string                `xml:"Description"`
	Media         *MediaExportXML       `xml:"Media,omitempty"`
}

// OrganizerExportXML is an EMPTY element carrying the organizer's UserID.
// DTD: <!ELEMENT Organizer EMPTY> <!ATTLIST Organizer UserID CDATA #REQUIRED>.
type OrganizerExportXML struct {
	UserID string `xml:"UserID,attr"`
}

// GeoLocationExportXML uses Latitude/Longitude attributes per DTD.
type GeoLocationExportXML struct {
	Latitude  float64 `xml:"Latitude,attr"`
	Longitude float64 `xml:"Longitude,attr"`
}

// TicketTypesExportXML wraps one-or-more TicketType elements (DTD: TicketType+).
type TicketTypesExportXML struct {
	Items []TicketTypeExportXML `xml:"TicketType"`
}

// TicketTypeExportXML: TicketTypeID attribute + Name, Price, Quantity, Available children.
type TicketTypeExportXML struct {
	TicketTypeID string `xml:"TicketTypeID,attr"`
	Name         string `xml:"Name"`
	Price        string `xml:"Price"`
	Quantity     int    `xml:"Quantity"`
	Available    int    `xml:"Available"`
}

// BookingsExportXML wraps zero-or-more Booking elements (DTD: Booking*).
type BookingsExportXML struct {
	Items []BookingExportXML `xml:"Booking"`
}

// BookingExportXML: BookingID attribute + Attendee, Time, TicketTypeRef,
// NumberOfTickets, TotalCost, BookingStatus children (DTD order).
type BookingExportXML struct {
	BookingID       string            `xml:"BookingID,attr"`
	Attendee        AttendeeExportXML `xml:"Attendee"`
	Time            string            `xml:"Time"`
	TicketTypeRef   string            `xml:"TicketTypeRef"`
	NumberOfTickets int               `xml:"NumberOfTickets"`
	TotalCost       string            `xml:"TotalCost"`
	BookingStatus   string            `xml:"BookingStatus"`
}

// AttendeeExportXML is an EMPTY element carrying the attendee's UserID.
type AttendeeExportXML struct {
	UserID string `xml:"UserID,attr"`
}

// MediaExportXML wraps zero-or-more Photo elements (DTD: Media (Photo*)).
type MediaExportXML struct {
	Photos []string `xml:"Photo"`
}

// EventJSON is the JSON export shape for one event (logical mirror of the DTD).
type EventJSON struct {
	EventID       string           `json:"event_id"`
	Title         string           `json:"title"`
	Categories    []string         `json:"categories"`
	EventType     string           `json:"event_type"`
	Venue         string           `json:"venue"`
	Address       *string          `json:"address,omitempty"`
	City          string           `json:"city"`
	Country       *string          `json:"country,omitempty"`
	GeoLocation   *GeoLocationJSON `json:"geo_location,omitempty"`
	StartDateTime string           `json:"start_date_time"`
	EndDateTime   string           `json:"end_date_time"`
	Capacity      int              `json:"capacity"`
	TicketTypes   []TicketTypeJSON `json:"ticket_types"`
	Bookings      []BookingJSON    `json:"bookings"`
	Organizer     OrganizerJSON    `json:"organizer"`
	Status        string           `json:"status"`
	Description   string           `json:"description"`
	Media         []string         `json:"media,omitempty"`
}

type OrganizerJSON struct {
	UserID string `json:"user_id"`
}

type GeoLocationJSON struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type TicketTypeJSON struct {
	TicketTypeID string  `json:"ticket_type_id"`
	Name         string  `json:"name"`
	Price        float64 `json:"price"`
	Quantity     int     `json:"quantity"`
	Available    int     `json:"available"`
}

type BookingJSON struct {
	BookingID       string       `json:"booking_id"`
	Attendee        AttendeeJSON `json:"attendee"`
	Time            string       `json:"time"`
	TicketTypeRef   string       `json:"ticket_type_ref"`
	NumberOfTickets int          `json:"number_of_tickets"`
	TotalCost       float64      `json:"total_cost"`
	BookingStatus   string       `json:"booking_status"`
}

type AttendeeJSON struct {
	UserID string `json:"user_id"`
}

// CatalogRootElement returns the XML root element name for the export catalogue.
func CatalogRootElement() string { return catalogRootElement }

// eventTypeFor returns the event's own EventType. Events created before the
// column existed fall back to their first category, then to a generic value,
// so the required <EventType> element is never empty.
func eventTypeFor(ev domain.Event, categories []domain.Category) string {
	if t := strings.TrimSpace(ev.EventType); t != "" {
		return t
	}
	if len(categories) > 0 {
		return categories[0].Name
	}
	return fallbackEventType
}

// categoryNames returns the export names for an event's categories, guaranteeing
// the DTD's `Category+` (one or more).
func categoryNames(categories []domain.Category) []string {
	out := make([]string, 0, len(categories))
	for _, c := range categories {
		if name := strings.TrimSpace(c.Name); name != "" {
			out = append(out, name)
		}
	}
	if len(out) == 0 {
		out = append(out, fallbackCategory)
	}
	return out
}

// fallbackTicketTypeName labels the placeholder emitted for legacy events with
// no ticket types, so the document still satisfies `<!ELEMENT TicketTypes
// (TicketType+)>`. New events cannot reach this state: EventService.Create and
// Publish both require at least one ticket type.
const fallbackTicketTypeName = "Unallocated"

// exportStatus renders a lifecycle value the way the DTD sample does: uppercase
// (DRAFT / PUBLISHED / COMPLETED / CANCELLED, CONFIRMED / PENDING / CANCELLED).
func exportStatus(v string) string {
	return strings.ToUpper(strings.TrimSpace(v))
}

func derefOr(s *string, fallback string) string {
	if s != nil {
		return *s
	}
	return fallback
}

// mediaPhotos returns the photo references for an event's Media block: the
// featured image (if any) followed by gallery photos by storage path.
func mediaPhotos(ev domain.Event, photos []domain.EventPhoto) []string {
	out := make([]string, 0, len(photos)+1)
	if ev.FeaturedImageURL != nil && *ev.FeaturedImageURL != "" {
		out = append(out, *ev.FeaturedImageURL)
	}
	for _, p := range photos {
		out = append(out, p.StoragePath)
	}
	return out
}

// BuildEventExportXML maps a hydrated domain event to the DTD-aligned XML struct.
func BuildEventExportXML(ev domain.Event, categories []domain.Category, photos []domain.EventPhoto) EventExportXML {
	catNames := categoryNames(categories)

	var geo *GeoLocationExportXML
	if ev.Latitude != nil && ev.Longitude != nil {
		geo = &GeoLocationExportXML{Latitude: *ev.Latitude, Longitude: *ev.Longitude}
	}

	tts := make([]TicketTypeExportXML, 0, len(ev.TicketTypes))
	for _, tt := range ev.TicketTypes {
		tts = append(tts, TicketTypeExportXML{
			TicketTypeID: tt.ID.String(),
			Name:         tt.Name,
			Price:        formatMoney(tt.Price),
			Quantity:     tt.Quantity,
			Available:    tt.Available,
		})
	}

	bks := make([]BookingExportXML, 0, len(ev.Bookings))
	for _, b := range ev.Bookings {
		bks = append(bks, BookingExportXML{
			BookingID:       b.ID.String(),
			Attendee:        AttendeeExportXML{UserID: b.UserID.String()},
			Time:            b.CreatedAt.UTC().Format(exportTimeLayout),
			TicketTypeRef:   b.TicketTypeID.String(),
			NumberOfTickets: b.Quantity,
			TotalCost:       formatMoney(b.TotalCost),
			BookingStatus:   exportStatus(string(b.Status)),
		})
	}

	if len(tts) == 0 {
		tts = append(tts, TicketTypeExportXML{
			TicketTypeID: ev.ID.String() + "-none",
			Name:         fallbackTicketTypeName,
			Price:        formatMoney(0),
			Quantity:     0,
			Available:    0,
		})
	}

	var media *MediaExportXML
	if refs := mediaPhotos(ev, photos); len(refs) > 0 {
		media = &MediaExportXML{Photos: refs}
	}

	return EventExportXML{
		XMLName:       xml.Name{Local: "Event"},
		EventID:       ev.ID.String(),
		Title:         ev.Title,
		Category:      catNames,
		EventType:     eventTypeFor(ev, categories),
		Venue:         ev.Venue,
		Address:       derefOr(ev.Address, ""),
		City:          ev.City,
		Country:       derefOr(ev.Country, ""),
		GeoLocation:   geo,
		StartDateTime: ev.StartAt.UTC().Format(exportTimeLayout),
		EndDateTime:   ev.EndAt.UTC().Format(exportTimeLayout),
		Capacity:      ev.Capacity,
		TicketTypes:   TicketTypesExportXML{Items: tts},
		Bookings:      BookingsExportXML{Items: bks},
		Organizer:     OrganizerExportXML{UserID: ev.OrganizerID.String()},
		Status:        exportStatus(string(ev.Status)),
		Description:   ev.Description,
		Media:         media,
	}
}

// BuildEventJSON maps a hydrated domain event to the JSON export struct.
func BuildEventJSON(ev domain.Event, categories []domain.Category, photos []domain.EventPhoto) EventJSON {
	catNames := categoryNames(categories)

	var geo *GeoLocationJSON
	if ev.Latitude != nil && ev.Longitude != nil {
		geo = &GeoLocationJSON{Latitude: *ev.Latitude, Longitude: *ev.Longitude}
	}

	tts := make([]TicketTypeJSON, 0, len(ev.TicketTypes))
	for _, tt := range ev.TicketTypes {
		tts = append(tts, TicketTypeJSON{
			TicketTypeID: tt.ID.String(),
			Name:         tt.Name,
			Price:        tt.Price,
			Quantity:     tt.Quantity,
			Available:    tt.Available,
		})
	}

	bks := make([]BookingJSON, 0, len(ev.Bookings))
	for _, b := range ev.Bookings {
		bks = append(bks, BookingJSON{
			BookingID:       b.ID.String(),
			Attendee:        AttendeeJSON{UserID: b.UserID.String()},
			Time:            b.CreatedAt.UTC().Format(exportTimeLayout),
			TicketTypeRef:   b.TicketTypeID.String(),
			NumberOfTickets: b.Quantity,
			TotalCost:       b.TotalCost,
			BookingStatus:   exportStatus(string(b.Status)),
		})
	}

	return EventJSON{
		EventID:       ev.ID.String(),
		Title:         ev.Title,
		Categories:    catNames,
		EventType:     eventTypeFor(ev, categories),
		Venue:         ev.Venue,
		Address:       ev.Address,
		City:          ev.City,
		Country:       ev.Country,
		GeoLocation:   geo,
		StartDateTime: ev.StartAt.UTC().Format(exportTimeLayout),
		EndDateTime:   ev.EndAt.UTC().Format(exportTimeLayout),
		Capacity:      ev.Capacity,
		TicketTypes:   tts,
		Bookings:      bks,
		Organizer:     OrganizerJSON{UserID: ev.OrganizerID.String()},
		Status:        exportStatus(string(ev.Status)),
		Description:   ev.Description,
		Media:         mediaPhotos(ev, photos),
	}
}

// formatMoney renders a monetary value with two decimals (DTD Price/TotalCost,
// e.g. "36.00").
func formatMoney(v float64) string {
	return fmt.Sprintf("%.2f", v)
}

// MarshalEventJSON returns compact JSON for one event (no outer wrapper).
func MarshalEventJSON(ev EventJSON) ([]byte, error) {
	return json.Marshal(ev)
}
