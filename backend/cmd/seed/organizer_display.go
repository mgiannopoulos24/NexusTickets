package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"nexustickets/internal/domain"
	"nexustickets/internal/repository/postgres"
)

// organizerDisplayFor derives the public "Organizer" tab of an event from
// its organizer's profile. Only fields the profile actually has are filled;
// the template hides the tab when both legal_name and headquarters are empty.
func organizerDisplayFor(u postgres.UserModel) domain.OrganizerPublicInfo {
	deref := func(p *string) string {
		if p == nil {
			return ""
		}
		return strings.TrimSpace(*p)
	}

	hq := deref(u.City)
	if country := deref(u.Country); country != "" {
		if hq != "" {
			hq += ", " + country
		} else {
			hq = country
		}
	}

	return domain.OrganizerPublicInfo{
		LegalName:    strings.TrimSpace(u.FirstName + " " + u.LastName),
		Headquarters: hq,
		VATNumber:    deref(u.VATNumber),
		Email:        strings.TrimSpace(u.Email),
		Phone:        deref(u.Phone),
	}
}

// withOrganizerDisplay fills detail.Organizer from the organizer's profile
// when the event has none yet. A display an organizer already filled in by
// hand is left untouched, so re-running the seed never overwrites their edits.
func withOrganizerDisplay(detail domain.EventDetail, organizer postgres.UserModel) (domain.EventDetail, bool) {
	if o := detail.Organizer; o != nil && (o.LegalName != "" || o.Headquarters != "") {
		return detail, false
	}
	info := organizerDisplayFor(organizer)
	if info.LegalName == "" && info.Headquarters == "" {
		return detail, false
	}
	detail.Organizer = &info
	return detail, true
}

// seedOrganizerDisplay runs after every event has its final organizer
// (seedPeople reassigns a few) and backfills the organizer tab of any event
// still missing it. The generator leaves event_detail as "{}", which made
// every seeded event show "no organizer info" even though each one has an
// organizer.
func seedOrganizerDisplay(d *gorm.DB) {
	var events []postgres.EventModel
	if err := d.Select("id", "organizer_id", "event_detail").Find(&events).Error; err != nil {
		panic(fmt.Errorf("load events for organizer display: %w", err))
	}

	var organizers []postgres.UserModel
	if err := d.Where("role = ?", "organizer").Find(&organizers).Error; err != nil {
		panic(fmt.Errorf("load organizers: %w", err))
	}
	byID := make(map[string]postgres.UserModel, len(organizers))
	for _, u := range organizers {
		byID[u.ID.String()] = u
	}

	filled := 0
	for _, ev := range events {
		org, ok := byID[ev.OrganizerID.String()]
		if !ok {
			continue
		}
		var detail domain.EventDetail
		if len(ev.EventDetail) > 0 {
			if err := json.Unmarshal(ev.EventDetail, &detail); err != nil {
				panic(fmt.Errorf("decode event_detail for %s: %w", ev.ID, err))
			}
		}
		next, changed := withOrganizerDisplay(detail, org)
		if !changed {
			continue
		}
		raw, err := json.Marshal(next)
		if err != nil {
			panic(fmt.Errorf("encode event_detail for %s: %w", ev.ID, err))
		}
		if err := d.Model(&postgres.EventModel{}).Where("id = ?", ev.ID).
			Update("event_detail", raw).Error; err != nil {
			panic(fmt.Errorf("update event_detail for %s: %w", ev.ID, err))
		}
		filled++
	}
	fmt.Printf("filled organizer display on %d events\n", filled)
}
