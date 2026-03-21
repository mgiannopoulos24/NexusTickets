package export

import (
	"encoding/json"
	"encoding/xml"

	"github.com/google/uuid"

	"nexustickets/internal/domain"
)

const catalogRootElement = "eventCatalog"

// EventExportXML mirrors the assignment event export DTD (see docs/events-catalog.dtd).
type EventExportXML struct {
	XMLName     xml.Name `xml:"event"`
	EventID     string   `xml:"EventID,attr"`
	Title       string   `xml:"Title,attr"`
	Status      string   `xml:"Status,attr"`
	StartTime   string   `xml:"StartTime,attr"`
	EndTime     string   `xml:"EndTime,attr"`
	Capacity    int      `xml:"Capacity,attr"`
	City        string   `xml:"City,attr"`
	Country     *string  `xml:"Country,attr,omitempty"`
	Venue       string   `xml:"Venue,attr"`
	Description string   `xml:"Description"`
	Address     *string  `xml:"Address,omitempty"`
	Organizer   OrganizerExportXML `xml:"Organizer"`
	GeoLocation *GeoLocationExportXML `xml:"GeoLocation,omitempty"`
	Category    []string `xml:"Category"`
	TicketTypes TicketTypesExportXML `xml:"ticketTypes"`
	Bookings    BookingsExportXML `xml:"bookings"`
}

// OrganizerExportXML carries organizer identity (UserID attribute per DTD).
type OrganizerExportXML struct {
	UserID    string  `xml:"UserID,attr"`
	Username  string  `xml:"Username,attr,omitempty"`
	Email     string  `xml:"Email,attr,omitempty"`
	FirstName string  `xml:"FirstName,attr,omitempty"`
	LastName  string  `xml:"LastName,attr,omitempty"`
}

// GeoLocationExportXML uses Latitude/Longitude attributes per DTD.
type GeoLocationExportXML struct {
	Latitude  float64 `xml:"Latitude,attr"`
	Longitude float64 `xml:"Longitude,attr"`
}

// TicketTypesExportXML wraps repeated ticketType elements.
type TicketTypesExportXML struct {
	Items []TicketTypeExportXML `xml:"ticketType"`
}

// TicketTypeExportXML uses TicketTypeID attribute per DTD.
type TicketTypeExportXML struct {
	TicketTypeID string  `xml:"TicketTypeID,attr"`
	Name         string  `xml:"Name,attr"`
	Price        float64 `xml:"Price,attr"`
	Quantity     int     `xml:"Quantity,attr"`
	Available    int     `xml:"Available,attr"`
}

// BookingsExportXML wraps repeated booking elements.
type BookingsExportXML struct {
	Items []BookingExportXML `xml:"booking"`
}

// BookingExportXML uses BookingID attribute and nested Attendee (UserID) per DTD.
type BookingExportXML struct {
	BookingID    string `xml:"BookingID,attr"`
	Quantity     int    `xml:"Quantity,attr"`
	TotalCost    float64 `xml:"TotalCost,attr"`
	Status       string `xml:"Status,attr"`
	TicketTypeID string `xml:"TicketTypeID,attr"`
	Attendee     AttendeeExportXML `xml:"Attendee"`
}

// AttendeeExportXML carries booking user identity (UserID attribute).
type AttendeeExportXML struct {
	UserID    string `xml:"UserID,attr"`
	Username  string `xml:"Username,attr,omitempty"`
	Email     string `xml:"Email,attr,omitempty"`
	FirstName string `xml:"FirstName,attr,omitempty"`
	LastName  string `xml:"LastName,attr,omitempty"`
}

// EventJSON is the JSON export shape for one event (logical mirror of EventExportXML).
type EventJSON struct {
	EventID     string              `json:"event_id"`
	Title       string              `json:"title"`
	Status      string              `json:"status"`
	StartTime   string              `json:"start_time"`
	EndTime     string              `json:"end_time"`
	Capacity    int                 `json:"capacity"`
	City        string              `json:"city"`
	Country     *string             `json:"country,omitempty"`
	Venue       string              `json:"venue"`
	Description string              `json:"description"`
	Address     *string             `json:"address,omitempty"`
	Organizer   OrganizerJSON       `json:"organizer"`
	GeoLocation *GeoLocationJSON    `json:"geo_location,omitempty"`
	Categories  []string            `json:"categories"`
	TicketTypes []TicketTypeJSON    `json:"ticket_types"`
	Bookings    []BookingJSON       `json:"bookings"`
}

type OrganizerJSON struct {
	UserID    string `json:"user_id"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
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
	BookingID    string       `json:"booking_id"`
	Quantity     int          `json:"quantity"`
	TotalCost    float64      `json:"total_cost"`
	Status       string       `json:"status"`
	TicketTypeID string       `json:"ticket_type_id"`
	Attendee     AttendeeJSON `json:"attendee"`
}

type AttendeeJSON struct {
	UserID    string `json:"user_id"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

// CatalogRootElement returns the XML root element name for the export catalogue.
func CatalogRootElement() string { return catalogRootElement }

// BuildEventExportXML maps a hydrated domain event to the DTD-aligned XML struct.
func BuildEventExportXML(ev domain.Event, categories []domain.Category, users map[uuid.UUID]domain.User) EventExportXML {
	catNames := make([]string, 0, len(categories))
	for _, c := range categories {
		catNames = append(catNames, c.Name)
	}

	var org OrganizerExportXML
	if u, ok := users[ev.OrganizerID]; ok {
		org = OrganizerExportXML{
			UserID:    u.ID.String(),
			Username:  u.Username,
			Email:     u.Email,
			FirstName: u.FirstName,
			LastName:  u.LastName,
		}
	} else {
		org = OrganizerExportXML{
			UserID: ev.OrganizerID.String(),
		}
	}

	var geo *GeoLocationExportXML
	if ev.Latitude != nil && ev.Longitude != nil {
		geo = &GeoLocationExportXML{
			Latitude:  *ev.Latitude,
			Longitude: *ev.Longitude,
		}
	}

	tts := make([]TicketTypeExportXML, 0, len(ev.TicketTypes))
	for _, tt := range ev.TicketTypes {
		tts = append(tts, TicketTypeExportXML{
			TicketTypeID: tt.ID.String(),
			Name:         tt.Name,
			Price:        tt.Price,
			Quantity:     tt.Quantity,
			Available:    tt.Available,
		})
	}

	bks := make([]BookingExportXML, 0, len(ev.Bookings))
	for _, b := range ev.Bookings {
		att := AttendeeExportXML{UserID: b.UserID.String()}
		if u, ok := users[b.UserID]; ok {
			att = AttendeeExportXML{
				UserID:    u.ID.String(),
				Username:  u.Username,
				Email:     u.Email,
				FirstName: u.FirstName,
				LastName:  u.LastName,
			}
		}
		bks = append(bks, BookingExportXML{
			BookingID:    b.ID.String(),
			Quantity:     b.Quantity,
			TotalCost:    b.TotalCost,
			Status:       string(b.Status),
			TicketTypeID: b.TicketTypeID.String(),
			Attendee:     att,
		})
	}

	return EventExportXML{
		XMLName:     xml.Name{Local: "event"},
		EventID:     ev.ID.String(),
		Title:       ev.Title,
		Status:      string(ev.Status),
		StartTime:   ev.StartAt.UTC().Format("2006-01-02T15:04:05Z"),
		EndTime:     ev.EndAt.UTC().Format("2006-01-02T15:04:05Z"),
		Capacity:    ev.Capacity,
		City:        ev.City,
		Country:     ev.Country,
		Venue:       ev.Venue,
		Description: ev.Description,
		Address:     ev.Address,
		Organizer:   org,
		GeoLocation: geo,
		Category:    catNames,
		TicketTypes: TicketTypesExportXML{Items: tts},
		Bookings:    BookingsExportXML{Items: bks},
	}
}

// BuildEventJSON maps a hydrated domain event to the JSON export struct.
func BuildEventJSON(ev domain.Event, categories []domain.Category, users map[uuid.UUID]domain.User) EventJSON {
	catNames := make([]string, 0, len(categories))
	for _, c := range categories {
		catNames = append(catNames, c.Name)
	}

	var org OrganizerJSON
	if u, ok := users[ev.OrganizerID]; ok {
		org = OrganizerJSON{
			UserID:    u.ID.String(),
			Username:  u.Username,
			Email:     u.Email,
			FirstName: u.FirstName,
			LastName:  u.LastName,
		}
	} else {
		org = OrganizerJSON{UserID: ev.OrganizerID.String()}
	}

	var geo *GeoLocationJSON
	if ev.Latitude != nil && ev.Longitude != nil {
		geo = &GeoLocationJSON{
			Latitude:  *ev.Latitude,
			Longitude: *ev.Longitude,
		}
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
		att := AttendeeJSON{UserID: b.UserID.String()}
		if u, ok := users[b.UserID]; ok {
			att = AttendeeJSON{
				UserID:    u.ID.String(),
				Username:  u.Username,
				Email:     u.Email,
				FirstName: u.FirstName,
				LastName:  u.LastName,
			}
		}
		bks = append(bks, BookingJSON{
			BookingID:    b.ID.String(),
			Quantity:     b.Quantity,
			TotalCost:    b.TotalCost,
			Status:       string(b.Status),
			TicketTypeID: b.TicketTypeID.String(),
			Attendee:     att,
		})
	}

	return EventJSON{
		EventID:     ev.ID.String(),
		Title:       ev.Title,
		Status:      string(ev.Status),
		StartTime:   ev.StartAt.UTC().Format("2006-01-02T15:04:05Z"),
		EndTime:     ev.EndAt.UTC().Format("2006-01-02T15:04:05Z"),
		Capacity:    ev.Capacity,
		City:        ev.City,
		Country:     ev.Country,
		Venue:       ev.Venue,
		Description: ev.Description,
		Address:     ev.Address,
		Organizer:   org,
		GeoLocation: geo,
		Categories:  catNames,
		TicketTypes: tts,
		Bookings:    bks,
	}
}

// MarshalEventJSON returns compact JSON for one event (no outer wrapper).
func MarshalEventJSON(ev EventJSON) ([]byte, error) {
	return json.Marshal(ev)
}
