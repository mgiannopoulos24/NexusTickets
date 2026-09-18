package main

import (
	"testing"

	"nexustickets/internal/domain"
	"nexustickets/internal/repository/postgres"
)

func TestOrganizerDisplayFor_FullProfile(t *testing.T) {
	u := postgres.UserModel{
		FirstName: "Άννα",
		LastName:  "Βασιλείου",
		Email:     "athensevents@nexustickets.local",
		City:      strPtr("Αθήνα"),
		Country:   strPtr("GR"),
		Phone:     strPtr("2101234567"),
		VATNumber: strPtr("123456789"),
	}

	got := organizerDisplayFor(u)

	want := domain.OrganizerPublicInfo{
		LegalName:    "Άννα Βασιλείου",
		Headquarters: "Αθήνα, GR",
		VATNumber:    "123456789",
		Email:        "athensevents@nexustickets.local",
		Phone:        "2101234567",
	}
	if got != want {
		t.Fatalf("organizerDisplayFor = %+v, want %+v", got, want)
	}
}

func TestOrganizerDisplayFor_NilOptionalFields(t *testing.T) {
	// The demo organizer has no phone, VAT or address — nil pointers must
	// become empty strings, not panic, and headquarters falls back to the
	// country alone when city is missing.
	u := postgres.UserModel{
		FirstName: "Demo",
		LastName:  "Organizer",
		Email:     "organizer@nexustickets.local",
		Country:   strPtr("GR"),
	}

	got := organizerDisplayFor(u)

	if got.LegalName != "Demo Organizer" {
		t.Errorf("LegalName = %q", got.LegalName)
	}
	if got.Headquarters != "GR" {
		t.Errorf("Headquarters = %q, want country only", got.Headquarters)
	}
	if got.VATNumber != "" || got.Phone != "" {
		t.Errorf("nil optional fields should be empty, got vat=%q phone=%q", got.VATNumber, got.Phone)
	}
}

func TestWithOrganizerDisplay_FillsEmptyDetail(t *testing.T) {
	u := postgres.UserModel{FirstName: "Demo", LastName: "Organizer", City: strPtr("Αθήνα")}

	next, changed := withOrganizerDisplay(domain.EventDetail{}, u)

	if !changed {
		t.Fatal("expected an empty detail to be filled")
	}
	if next.Organizer == nil || next.Organizer.LegalName != "Demo Organizer" {
		t.Fatalf("Organizer = %+v", next.Organizer)
	}
}

func TestWithOrganizerDisplay_KeepsHandFilledDisplay(t *testing.T) {
	// An organizer who already typed their company details must not have
	// them replaced by the profile-derived defaults on a re-seed.
	existing := domain.EventDetail{
		Organizer: &domain.OrganizerPublicInfo{LegalName: "Athens Events ΙΚΕ", VATNumber: "999999999"},
	}
	u := postgres.UserModel{FirstName: "Άννα", LastName: "Βασιλείου"}

	next, changed := withOrganizerDisplay(existing, u)

	if changed {
		t.Fatal("hand-filled organizer display must not be overwritten")
	}
	if next.Organizer.LegalName != "Athens Events ΙΚΕ" || next.Organizer.VATNumber != "999999999" {
		t.Fatalf("Organizer mutated: %+v", next.Organizer)
	}
}

func TestWithOrganizerDisplay_PreservesOtherDetailSections(t *testing.T) {
	minutes := 90
	existing := domain.EventDetail{
		Artists: []domain.ArtistCredit{{Name: "Κρατική Ορχήστρα"}},
		Useful:  &domain.EventUsefulInfo{DurationMinutes: &minutes},
	}
	u := postgres.UserModel{FirstName: "Demo", LastName: "Organizer"}

	next, changed := withOrganizerDisplay(existing, u)

	if !changed {
		t.Fatal("expected organizer to be filled")
	}
	if len(next.Artists) != 1 || next.Useful == nil || *next.Useful.DurationMinutes != 90 {
		t.Fatalf("other sections were lost: %+v", next)
	}
}

func TestWithOrganizerDisplay_SkipsProfileWithNoName(t *testing.T) {
	// Nothing to show → leave the detail alone rather than writing an
	// all-empty block that the template would render as a blank tab.
	next, changed := withOrganizerDisplay(domain.EventDetail{}, postgres.UserModel{})

	if changed || next.Organizer != nil {
		t.Fatalf("expected no change, got changed=%v organizer=%+v", changed, next.Organizer)
	}
}
