package domain

// EventDetail holds optional rich content for the public event template (tabs, sidebar, etc.).
type EventDetail struct {
	Contributors []ContributorCredit  `json:"contributors"`
	Artists      []ArtistCredit       `json:"artists"`
	Useful       *EventUsefulInfo     `json:"useful"`
	Organizer    *OrganizerPublicInfo `json:"organizer_display"`
	Occurrences  []EventOccurrence    `json:"occurrences"`
}

type ContributorCredit struct {
	Role string `json:"role"`
	Name string `json:"name"`
}

type ArtistCredit struct {
	Name string `json:"name"`
	Role string `json:"role,omitempty"`
}

type EventUsefulInfo struct {
	DurationMinutes     *int   `json:"duration_minutes"`
	IntermissionMinutes *int   `json:"intermission_minutes"`
	SeatedOnly          *bool  `json:"seated_only"`
	ParkingAvailable    *bool  `json:"parking_available"`
	CancellationPolicy  string `json:"cancellation_policy"`
}

type OrganizerPublicInfo struct {
	LegalName    string `json:"legal_name"`
	Headquarters string `json:"headquarters"`
	VATNumber    string `json:"vat_number"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	TaxOffice    string `json:"tax_office"`
}

type EventOccurrence struct {
	StartsAt string `json:"starts_at"`
	EndsAt   string `json:"ends_at,omitempty"`
	Label    string `json:"label,omitempty"`
}
