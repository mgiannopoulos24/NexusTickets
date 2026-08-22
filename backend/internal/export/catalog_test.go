package export

import (
	"encoding/json"
	"encoding/xml"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"nexustickets/internal/domain"
)

func strPtr(s string) *string   { return &s }
func f64Ptr(f float64) *float64 { return &f }

func TestCatalogRootElement(t *testing.T) {
	if got := CatalogRootElement(); got != "Events" {
		t.Fatalf("CatalogRootElement() = %q, want %q", got, "Events")
	}
}

func TestBuildEventExportXML_Full(t *testing.T) {
	orgID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	eventID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	ttID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	bookingID := uuid.MustParse("44444444-4444-4444-4444-444444444444")
	attendeeID := uuid.MustParse("55555555-5555-5555-5555-555555555555")
	catID := uuid.MustParse("66666666-6666-6666-6666-666666666666")

	startAt := time.Date(2026, 6, 1, 18, 0, 0, 0, time.UTC)
	endAt := time.Date(2026, 6, 1, 21, 0, 0, 0, time.UTC)
	bookedAt := time.Date(2026, 5, 20, 11, 42, 10, 0, time.UTC)

	ev := domain.Event{
		ID:               eventID,
		OrganizerID:      orgID,
		Title:            "Test Event",
		Description:      "A test event for export",
		Venue:            "Main Hall",
		City:             "Athens",
		Country:          strPtr("Greece"),
		Address:          strPtr("123 Test St"),
		Latitude:         f64Ptr(37.9838),
		Longitude:        f64Ptr(23.7275),
		StartAt:          startAt,
		EndAt:            endAt,
		Capacity:         100,
		Status:           domain.EventStatusPublished,
		FeaturedImageURL: strPtr("cover.jpg"),
		TicketTypes: []domain.TicketType{
			{ID: ttID, EventID: eventID, Name: "VIP", Price: 49.99, Quantity: 50, Available: 25},
		},
		Bookings: []domain.Booking{
			{
				ID: bookingID, UserID: attendeeID, EventID: eventID, TicketTypeID: ttID,
				Quantity: 2, TotalCost: 99.98, Status: domain.BookingStatusConfirmed,
				CreatedAt: bookedAt,
			},
		},
	}

	categories := []domain.Category{{ID: catID, Name: "Music"}}
	photos := []domain.EventPhoto{{StoragePath: "hall.jpg"}}

	got := BuildEventExportXML(ev, categories, photos)

	if got.EventID != eventID.String() {
		t.Fatalf("EventID = %q", got.EventID)
	}
	if got.Title != "Test Event" {
		t.Fatalf("Title = %q", got.Title)
	}
	if got.EventType != "Music" {
		t.Fatalf("EventType = %q, want first category %q", got.EventType, "Music")
	}
	if got.StartDateTime != "2026-06-01T18:00:00" {
		t.Fatalf("StartDateTime = %q", got.StartDateTime)
	}
	if got.EndDateTime != "2026-06-01T21:00:00" {
		t.Fatalf("EndDateTime = %q", got.EndDateTime)
	}
	if got.Country != "Greece" || got.Address != "123 Test St" {
		t.Fatalf("Country/Address = %q/%q", got.Country, got.Address)
	}

	// TicketType: children with 2-decimal price string.
	tt := got.TicketTypes.Items[0]
	if tt.Name != "VIP" || tt.Price != "49.99" || tt.Quantity != 50 || tt.Available != 25 {
		t.Fatalf("TicketType = %+v", tt)
	}

	// Booking: DTD child fields.
	b := got.Bookings.Items[0]
	if b.Attendee.UserID != attendeeID.String() {
		t.Fatalf("Attendee.UserID = %q", b.Attendee.UserID)
	}
	if b.Time != "2026-05-20T11:42:10" {
		t.Fatalf("Time = %q", b.Time)
	}
	if b.TicketTypeRef != ttID.String() {
		t.Fatalf("TicketTypeRef = %q", b.TicketTypeRef)
	}
	if b.NumberOfTickets != 2 {
		t.Fatalf("NumberOfTickets = %d", b.NumberOfTickets)
	}
	if b.TotalCost != "99.98" {
		t.Fatalf("TotalCost = %q", b.TotalCost)
	}
	if b.BookingStatus != "CONFIRMED" {
		t.Fatalf("BookingStatus = %q", b.BookingStatus)
	}

	// Media: featured image then gallery photo.
	if got.Media == nil || len(got.Media.Photos) != 2 ||
		got.Media.Photos[0] != "cover.jpg" || got.Media.Photos[1] != "hall.jpg" {
		t.Fatalf("Media = %+v", got.Media)
	}
}

// TestBuildEventExportXML_DTDElementOrder marshals a full event and asserts the
// serialized element order matches the assignment DTD content model exactly.
func TestBuildEventExportXML_DTDElementOrder(t *testing.T) {
	ev := domain.Event{
		ID:               uuid.New(),
		OrganizerID:      uuid.New(),
		Title:            "T",
		Description:      "D",
		Venue:            "V",
		City:             "C",
		Country:          strPtr("GR"),
		Address:          strPtr("A"),
		Latitude:         f64Ptr(1),
		Longitude:        f64Ptr(2),
		StartAt:          time.Now(),
		EndAt:            time.Now().Add(time.Hour),
		Capacity:         10,
		Status:           domain.EventStatusPublished,
		FeaturedImageURL: strPtr("p.jpg"),
		TicketTypes:      []domain.TicketType{{ID: uuid.New(), Name: "N", Price: 1, Quantity: 1, Available: 1}},
		Bookings:         []domain.Booking{{ID: uuid.New(), UserID: uuid.New(), TicketTypeID: uuid.New(), Quantity: 1, TotalCost: 1, Status: domain.BookingStatusConfirmed}},
	}
	got := BuildEventExportXML(ev, []domain.Category{{Name: "Cat"}}, nil)

	data, err := xml.Marshal(got)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	xmlStr := string(data)

	// DTD order for Event content model.
	order := []string{
		"<Title>", "<Category>", "<EventType>", "<Venue>", "<Address>",
		"<City>", "<Country>", "<GeoLocation", "<StartDateTime>", "<EndDateTime>",
		"<Capacity>", "<TicketTypes>", "<Bookings>", "<Organizer", "<Status>",
		"<Description>", "<Media>",
	}
	prev := -1
	for _, tag := range order {
		idx := strings.Index(xmlStr, tag)
		if idx == -1 {
			t.Fatalf("element %s missing from XML:\n%s", tag, xmlStr)
		}
		if idx < prev {
			t.Fatalf("element %s out of DTD order in XML:\n%s", tag, xmlStr)
		}
		prev = idx
	}

	// TicketType child order + Booking child order.
	for _, tag := range []string{"<Name>", "<Price>", "<Quantity>", "<Available>"} {
		if !strings.Contains(xmlStr, tag) {
			t.Fatalf("TicketType missing %s", tag)
		}
	}
	for _, tag := range []string{"<Attendee", "<Time>", "<TicketTypeRef>", "<NumberOfTickets>", "<TotalCost>", "<BookingStatus>"} {
		if !strings.Contains(xmlStr, tag) {
			t.Fatalf("Booking missing %s", tag)
		}
	}
}

func TestBuildEventExportXML_EventTypeUsesOwnField(t *testing.T) {
	ev := domain.Event{
		ID: uuid.New(), OrganizerID: uuid.New(), Title: "E",
		EventType: "concert",
		StartAt:   time.Now(), EndAt: time.Now(),
	}
	// The event's own EventType wins over its categories.
	got := BuildEventExportXML(ev, []domain.Category{{Name: "Music"}}, nil)
	if got.EventType != "concert" {
		t.Fatalf("EventType = %q, want %q", got.EventType, "concert")
	}
}

func TestBuildEventExportXML_EventTypeFallback(t *testing.T) {
	ev := domain.Event{ID: uuid.New(), OrganizerID: uuid.New(), Title: "E", StartAt: time.Now(), EndAt: time.Now()}

	// No EventType and no categories: a generic value, never empty, because the
	// DTD requires the element.
	if got := BuildEventExportXML(ev, nil, nil); got.EventType != "event" {
		t.Fatalf("EventType fallback = %q, want %q", got.EventType, "event")
	}

	// No EventType but a category: the first category name stands in.
	got := BuildEventExportXML(ev, []domain.Category{{Name: "Theatre"}}, nil)
	if got.EventType != "Theatre" {
		t.Fatalf("EventType category fallback = %q, want %q", got.EventType, "Theatre")
	}
}

func TestBuildEventExportXML_StatusIsUppercased(t *testing.T) {
	ev := domain.Event{
		ID: uuid.New(), OrganizerID: uuid.New(), Title: "E",
		StartAt: time.Now(), EndAt: time.Now(), Status: domain.EventStatusCompleted,
	}
	if got := BuildEventExportXML(ev, nil, nil); got.Status != "COMPLETED" {
		t.Fatalf("Status = %q, want %q", got.Status, "COMPLETED")
	}
}

func TestBuildEventExportXML_NilGeoAndNoMedia(t *testing.T) {
	ev := domain.Event{
		ID: uuid.New(), OrganizerID: uuid.New(), Title: "E",
		StartAt: time.Now(), EndAt: time.Now(), Status: domain.EventStatusDraft,
	}
	got := BuildEventExportXML(ev, nil, nil)
	if got.GeoLocation != nil {
		t.Fatal("expected nil GeoLocation")
	}
	if got.Media != nil {
		t.Fatal("expected nil Media when no photos and no featured image")
	}
	if got.Organizer.UserID != ev.OrganizerID.String() {
		t.Fatalf("Organizer.UserID = %q", got.Organizer.UserID)
	}
}

func TestBuildEventExportXML_EmptySlices(t *testing.T) {
	ev := domain.Event{
		ID: uuid.New(), OrganizerID: uuid.New(), Title: "E",
		StartAt: time.Now(), EndAt: time.Now(), Status: domain.EventStatusDraft,
	}
	got := BuildEventExportXML(ev, []domain.Category{}, nil)

	// The DTD demands Category+ and TicketType+, so an event with neither still
	// exports one placeholder of each rather than an invalid document.
	if len(got.Category) != 1 || got.Category[0] != "Uncategorized" {
		t.Fatalf("Category = %v, want one placeholder", got.Category)
	}
	if len(got.TicketTypes.Items) != 1 || got.TicketTypes.Items[0].Name != "Unallocated" {
		t.Fatalf("TicketTypes = %+v, want one placeholder", got.TicketTypes.Items)
	}
	// Bookings is Booking* — zero is valid there.
	if len(got.Bookings.Items) != 0 {
		t.Fatalf("expected no bookings, got %d", len(got.Bookings.Items))
	}
}

func TestBuildEventJSON_Full(t *testing.T) {
	orgID := uuid.New()
	eventID := uuid.New()
	ttID := uuid.New()
	attendeeID := uuid.New()

	ev := domain.Event{
		ID:          eventID,
		OrganizerID: orgID,
		Title:       "Test Event JSON",
		Description: "JSON export test",
		Venue:       "Big Hall",
		City:        "Thessaloniki",
		Country:     strPtr("Greece"),
		Latitude:    f64Ptr(40.6401),
		Longitude:   f64Ptr(22.9444),
		StartAt:     time.Date(2026, 6, 1, 18, 0, 0, 0, time.UTC),
		EndAt:       time.Date(2026, 6, 1, 21, 0, 0, 0, time.UTC),
		Capacity:    200,
		Status:      domain.EventStatusPublished,
		TicketTypes: []domain.TicketType{
			{ID: ttID, EventID: eventID, Name: "Standard", Price: 19.99, Quantity: 100, Available: 80},
		},
		Bookings: []domain.Booking{
			{ID: uuid.New(), UserID: attendeeID, EventID: eventID, TicketTypeID: ttID, Quantity: 3, TotalCost: 59.97, Status: domain.BookingStatusConfirmed},
		},
	}

	categories := []domain.Category{{Name: "Sports"}, {Name: "Outdoor"}}

	got := BuildEventJSON(ev, categories, nil)

	if got.EventType != "Sports" {
		t.Fatalf("EventType = %q", got.EventType)
	}
	if got.StartDateTime != "2026-06-01T18:00:00" {
		t.Fatalf("StartDateTime = %q", got.StartDateTime)
	}
	if len(got.TicketTypes) != 1 || got.TicketTypes[0].Name != "Standard" {
		t.Fatalf("TicketTypes = %+v", got.TicketTypes)
	}
	if len(got.Bookings) != 1 || got.Bookings[0].NumberOfTickets != 3 {
		t.Fatalf("Bookings = %+v", got.Bookings)
	}
	if got.Bookings[0].TicketTypeRef != ttID.String() {
		t.Fatalf("TicketTypeRef = %q", got.Bookings[0].TicketTypeRef)
	}
	if got.Organizer.UserID != orgID.String() {
		t.Fatalf("Organizer.UserID = %q", got.Organizer.UserID)
	}
}

func TestMarshalEventJSON(t *testing.T) {
	ej := EventJSON{
		EventID:       "evt-1",
		Title:         "JSON Marshal Test",
		Status:        "published",
		StartDateTime: "2026-06-01T18:00:00",
		EndDateTime:   "2026-06-01T21:00:00",
		Capacity:      50,
		City:          "Athens",
		Venue:         "Venue",
		Description:   "Desc",
		Organizer:     OrganizerJSON{UserID: "usr-1"},
		Categories:    []string{"Tech"},
	}

	data, err := MarshalEventJSON(ej)
	if err != nil {
		t.Fatalf("MarshalEventJSON error: %v", err)
	}
	var decoded EventJSON
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("json.Unmarshal error: %v", err)
	}
	if decoded.Title != "JSON Marshal Test" || decoded.City != "Athens" {
		t.Fatalf("decoded = %+v", decoded)
	}
}
