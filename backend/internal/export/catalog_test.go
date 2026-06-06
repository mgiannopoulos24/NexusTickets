package export

import (
	"encoding/json"
	"encoding/xml"
	"testing"
	"time"

	"github.com/google/uuid"
	"nexustickets/internal/domain"
)

func strPtr(s string) *string  { return &s }
func f64Ptr(f float64) *float64 { return &f }

func TestCatalogRootElement(t *testing.T) {
	if got := CatalogRootElement(); got != "eventCatalog" {
		t.Fatalf("CatalogRootElement() = %q, want %q", got, "eventCatalog")
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

	ev := domain.Event{
		ID:           eventID,
		OrganizerID:  orgID,
		Title:        "Test Event",
		Description:  "A test event for export",
		Venue:        "Main Hall",
		City:         "Athens",
		Country:      strPtr("Greece"),
		Address:      strPtr("123 Test St"),
		Latitude:     f64Ptr(37.9838),
		Longitude:    f64Ptr(23.7275),
		StartAt:      startAt,
		EndAt:        endAt,
		Capacity:     100,
		Status:       domain.EventStatusPublished,
		FeaturedImageURL: strPtr("https://example.com/photo.jpg"),
		Detail:       domain.EventDetail{},
		CreatedAt:    startAt,
		UpdatedAt:    startAt,
		TicketTypes: []domain.TicketType{
			{ID: ttID, EventID: eventID, Name: "VIP", Price: 49.99, Quantity: 50, Available: 25},
		},
		Bookings: []domain.Booking{
			{
				ID: bookingID, UserID: attendeeID, EventID: eventID, TicketTypeID: ttID,
				Quantity: 2, TotalCost: 99.98, Status: domain.BookingStatusConfirmed,
			},
		},
	}

	users := map[uuid.UUID]domain.User{
		orgID: {
			ID: orgID, Username: "organizer1", Email: "org@example.com",
			FirstName: "John", LastName: "Doe",
		},
		attendeeID: {
			ID: attendeeID, Username: "attendee1", Email: "att@example.com",
			FirstName: "Jane", LastName: "Smith",
		},
	}

	categories := []domain.Category{
		{ID: catID, Name: "Music"},
	}

	got := BuildEventExportXML(ev, categories, users)

	// Check top-level attributes
	if got.EventID != eventID.String() {
		t.Fatalf("EventID = %q, want %q", got.EventID, eventID.String())
	}
	if got.Title != "Test Event" {
		t.Fatalf("Title = %q, want %q", got.Title, "Test Event")
	}
	if got.Status != "published" {
		t.Fatalf("Status = %q, want %q", got.Status, "published")
	}
	if got.StartTime != "2026-06-01T18:00:00Z" {
		t.Fatalf("StartTime = %q, want %q", got.StartTime, "2026-06-01T18:00:00Z")
	}
	if got.EndTime != "2026-06-01T21:00:00Z" {
		t.Fatalf("EndTime = %q, want %q", got.EndTime, "2026-06-01T21:00:00Z")
	}
	if got.Capacity != 100 {
		t.Fatalf("Capacity = %d, want %d", got.Capacity, 100)
	}
	if got.City != "Athens" {
		t.Fatalf("City = %q, want %q", got.City, "Athens")
	}
	if got.Country == nil || *got.Country != "Greece" {
		t.Fatalf("Country = %v, want %q", got.Country, "Greece")
	}
	if got.Venue != "Main Hall" {
		t.Fatalf("Venue = %q, want %q", got.Venue, "Main Hall")
	}
	if got.Description != "A test event for export" {
		t.Fatalf("Description = %q, want %q", got.Description, "A test event for export")
	}
	if got.Address == nil || *got.Address != "123 Test St" {
		t.Fatalf("Address = %v, want %q", got.Address, "123 Test St")
	}

	// Organizer
	if got.Organizer.UserID != orgID.String() {
		t.Fatalf("Organizer.UserID = %q, want %q", got.Organizer.UserID, orgID.String())
	}
	if got.Organizer.Username != "organizer1" {
		t.Fatalf("Organizer.Username = %q, want %q", got.Organizer.Username, "organizer1")
	}

	// GeoLocation
	if got.GeoLocation == nil {
		t.Fatal("expected non-nil GeoLocation")
	}
	if got.GeoLocation.Latitude != 37.9838 {
		t.Fatalf("Latitude = %f, want %f", got.GeoLocation.Latitude, 37.9838)
	}
	if got.GeoLocation.Longitude != 23.7275 {
		t.Fatalf("Longitude = %f, want %f", got.GeoLocation.Longitude, 23.7275)
	}

	// Categories
	if len(got.Category) != 1 || got.Category[0] != "Music" {
		t.Fatalf("Category = %v, want [Music]", got.Category)
	}

	// TicketTypes
	if len(got.TicketTypes.Items) != 1 {
		t.Fatalf("expected 1 ticket type, got %d", len(got.TicketTypes.Items))
	}
	tt := got.TicketTypes.Items[0]
	if tt.Name != "VIP" || tt.Price != 49.99 || tt.Quantity != 50 || tt.Available != 25 {
		t.Fatalf("TicketType = %+v", tt)
	}

	// Bookings
	if len(got.Bookings.Items) != 1 {
		t.Fatalf("expected 1 booking, got %d", len(got.Bookings.Items))
	}
	b := got.Bookings.Items[0]
	if b.Quantity != 2 || b.TotalCost != 99.98 || b.Status != "confirmed" {
		t.Fatalf("Booking = %+v", b)
	}
	if b.Attendee.UserID != attendeeID.String() {
		t.Fatalf("Attendee.UserID = %q, want %q", b.Attendee.UserID, attendeeID.String())
	}

	// Verify XML serialization
	data, err := xml.Marshal(got)
	if err != nil {
		t.Fatalf("xml.Marshal error: %v", err)
	}
	if len(data) == 0 {
		t.Fatal("expected non-empty XML output")
	}
}

func TestBuildEventExportXML_MissingOrganizerInMap(t *testing.T) {
	ev := domain.Event{
		ID:          uuid.MustParse("22222222-2222-2222-2222-222222222222"),
		OrganizerID: uuid.MustParse("11111111-1111-1111-1111-111111111111"),
		Title:       "Event",
		Description: "Desc",
		Venue:       "Venue",
		City:        "City",
		StartAt:     time.Now(),
		EndAt:       time.Now().Add(2 * time.Hour),
		Status:      domain.EventStatusDraft,
	}

	got := BuildEventExportXML(ev, nil, nil)
	if got.Organizer.UserID != ev.OrganizerID.String() {
		t.Fatalf("Organizer.UserID = %q, want %q", got.Organizer.UserID, ev.OrganizerID.String())
	}
	if got.Organizer.Username != "" || got.Organizer.Email != "" {
		t.Fatal("expected empty organizer fields when not in users map")
	}
}

func TestBuildEventExportXML_NilGeoLocation(t *testing.T) {
	ev := domain.Event{
		ID:          uuid.MustParse("22222222-2222-2222-2222-222222222222"),
		OrganizerID: uuid.MustParse("11111111-1111-1111-1111-111111111111"),
		Title:       "Event",
		Description: "Desc",
		Venue:       "Venue",
		City:        "City",
		StartAt:     time.Now(),
		EndAt:       time.Now().Add(2 * time.Hour),
		Status:      domain.EventStatusDraft,
	}

	got := BuildEventExportXML(ev, nil, nil)
	if got.GeoLocation != nil {
		t.Fatal("expected nil GeoLocation when lat/lng not set")
	}
}

func TestBuildEventExportXML_EmptySlices(t *testing.T) {
	ev := domain.Event{
		ID:          uuid.MustParse("22222222-2222-2222-2222-222222222222"),
		OrganizerID: uuid.MustParse("11111111-1111-1111-1111-111111111111"),
		Title:       "Event",
		Description: "Desc",
		Venue:       "Venue",
		City:        "City",
		StartAt:     time.Now(),
		EndAt:       time.Now().Add(2 * time.Hour),
		Status:      domain.EventStatusDraft,
	}

	got := BuildEventExportXML(ev, []domain.Category{}, nil)
	if got.Category == nil {
		t.Fatal("expected empty slice, not nil")
	}
	if len(got.Category) != 0 {
		t.Fatalf("expected 0 categories, got %d", len(got.Category))
	}
	if len(got.TicketTypes.Items) != 0 {
		t.Fatalf("expected 0 ticket types, got %d", len(got.TicketTypes.Items))
	}
	if len(got.Bookings.Items) != 0 {
		t.Fatalf("expected 0 bookings, got %d", len(got.Bookings.Items))
	}
}

func TestBuildEventJSON_Full(t *testing.T) {
	orgID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	eventID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	ttID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	bookingID := uuid.MustParse("44444444-4444-4444-4444-444444444444")
	attendeeID := uuid.MustParse("55555555-5555-5555-5555-555555555555")

	startAt := time.Date(2026, 6, 1, 18, 0, 0, 0, time.UTC)
	endAt := time.Date(2026, 6, 1, 21, 0, 0, 0, time.UTC)

	ev := domain.Event{
		ID:           eventID,
		OrganizerID:  orgID,
		Title:        "Test Event JSON",
		Description:  "JSON export test",
		Venue:        "Big Hall",
		City:         "Thessaloniki",
		Country:      strPtr("Greece"),
		Latitude:     f64Ptr(40.6401),
		Longitude:    f64Ptr(22.9444),
		StartAt:      startAt,
		EndAt:        endAt,
		Capacity:     200,
		Status:       domain.EventStatusPublished,
		TicketTypes: []domain.TicketType{
			{ID: ttID, EventID: eventID, Name: "Standard", Price: 19.99, Quantity: 100, Available: 80},
		},
		Bookings: []domain.Booking{
			{
				ID: bookingID, UserID: attendeeID, EventID: eventID, TicketTypeID: ttID,
				Quantity: 3, TotalCost: 59.97, Status: domain.BookingStatusConfirmed,
			},
		},
	}

	users := map[uuid.UUID]domain.User{
		orgID:      {ID: orgID, Username: "org", Email: "org@test.com", FirstName: "A", LastName: "B"},
		attendeeID: {ID: attendeeID, Username: "att", Email: "att@test.com", FirstName: "C", LastName: "D"},
	}

	categories := []domain.Category{
		{Name: "Sports"},
		{Name: "Outdoor"},
	}

	got := BuildEventJSON(ev, categories, users)

	if got.EventID != eventID.String() {
		t.Fatalf("EventID = %q, want %q", got.EventID, eventID.String())
	}
	if got.Title != "Test Event JSON" {
		t.Fatalf("Title = %q", got.Title)
	}
	if got.Status != "published" {
		t.Fatalf("Status = %q", got.Status)
	}
	if got.Capacity != 200 {
		t.Fatalf("Capacity = %d", got.Capacity)
	}
	if got.Organizer.Username != "org" {
		t.Fatalf("Organizer.Username = %q", got.Organizer.Username)
	}
	if got.GeoLocation == nil || got.GeoLocation.Latitude != 40.6401 {
		t.Fatalf("GeoLocation = %+v", got.GeoLocation)
	}
	if len(got.Categories) != 2 || got.Categories[0] != "Sports" {
		t.Fatalf("Categories = %v", got.Categories)
	}
	if len(got.TicketTypes) != 1 || got.TicketTypes[0].Name != "Standard" {
		t.Fatalf("TicketTypes = %+v", got.TicketTypes)
	}
	if len(got.Bookings) != 1 || got.Bookings[0].Quantity != 3 {
		t.Fatalf("Bookings = %+v", got.Bookings)
	}
}

func TestBuildEventJSON_NilGeoLocation(t *testing.T) {
	ev := domain.Event{
		ID:          uuid.MustParse("22222222-2222-2222-2222-222222222222"),
		OrganizerID: uuid.MustParse("11111111-1111-1111-1111-111111111111"),
		Title:       "Event",
		Description: "Desc",
		Venue:       "Venue",
		City:        "City",
		StartAt:     time.Now(),
		EndAt:       time.Now().Add(2 * time.Hour),
		Status:      domain.EventStatusDraft,
	}

	got := BuildEventJSON(ev, nil, nil)
	if got.GeoLocation != nil {
		t.Fatal("expected nil GeoLocation")
	}
}

func TestBuildEventJSON_MissingOrganizerInMap(t *testing.T) {
	ev := domain.Event{
		ID:          uuid.MustParse("22222222-2222-2222-2222-222222222222"),
		OrganizerID: uuid.MustParse("11111111-1111-1111-1111-111111111111"),
		Title:       "Event",
		Description: "Desc",
		Venue:       "Venue",
		City:        "City",
		StartAt:     time.Now(),
		EndAt:       time.Now().Add(2 * time.Hour),
		Status:      domain.EventStatusDraft,
	}

	got := BuildEventJSON(ev, nil, nil)
	if got.Organizer.UserID != ev.OrganizerID.String() {
		t.Fatalf("Organizer.UserID = %q, want %q", got.Organizer.UserID, ev.OrganizerID.String())
	}
	if got.Organizer.Username != "" {
		t.Fatal("expected empty organizer username when not in map")
	}
}

func TestMarshalEventJSON(t *testing.T) {
	ej := EventJSON{
		EventID:     "evt-1",
		Title:       "JSON Marshal Test",
		Status:      "published",
		StartTime:   "2026-06-01T18:00:00Z",
		EndTime:     "2026-06-01T21:00:00Z",
		Capacity:    50,
		City:        "Athens",
		Venue:       "Venue",
		Description: "Desc",
		Organizer:   OrganizerJSON{UserID: "usr-1"},
		Categories:  []string{"Tech"},
	}

	data, err := MarshalEventJSON(ej)
	if err != nil {
		t.Fatalf("MarshalEventJSON error: %v", err)
	}

	var decoded EventJSON
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("json.Unmarshal error: %v", err)
	}

	if decoded.Title != "JSON Marshal Test" {
		t.Fatalf("Title = %q, want %q", decoded.Title, "JSON Marshal Test")
	}
	if decoded.City != "Athens" {
		t.Fatalf("City = %q", decoded.City)
	}
	if len(decoded.Categories) != 1 || decoded.Categories[0] != "Tech" {
		t.Fatalf("Categories = %v", decoded.Categories)
	}
}
