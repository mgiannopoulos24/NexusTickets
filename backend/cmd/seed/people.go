package main

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"nexustickets/internal/repository/postgres"
)

// seedPeople fills the social side of the demo: more accounts in every state,
// bookings on the seeded events, organizer/attendee messages on those
// bookings, and support tickets in every status. Everything is idempotent
// (fixed ids), so re-running the seeder changes nothing.
func seedPeople(d *gorm.DB) {
	now := time.Now().UTC()
	pw := hashPassword("ChangeMe123!")

	type person struct {
		id, username, first, last, city, role, status string
	}
	people := []person{
		{"00000000-0000-0000-0000-000000000011", "maria", "Μαρία", "Παπαδοπούλου", "Αθήνα", "attendee", "approved"},
		{"00000000-0000-0000-0000-000000000012", "giorgos", "Γιώργος", "Νικολάου", "Θεσσαλονίκη", "attendee", "approved"},
		{"00000000-0000-0000-0000-000000000013", "eleni", "Ελένη", "Καραγιάννη", "Πάτρα", "attendee", "approved"},
		{"00000000-0000-0000-0000-000000000014", "nikos", "Νίκος", "Αντωνίου", "Ηράκλειο", "attendee", "approved"},
		{"00000000-0000-0000-0000-000000000015", "katerina", "Κατερίνα", "Δημητρίου", "Λάρισα", "attendee", "pending"},
		{"00000000-0000-0000-0000-000000000016", "dimitris", "Δημήτρης", "Ιωάννου", "Βόλος", "attendee", "pending"},
		{"00000000-0000-0000-0000-000000000017", "sofia", "Σοφία", "Μιχαήλ", "Ιωάννινα", "attendee", "rejected"},
		{"00000000-0000-0000-0000-000000000021", "athensevents", "Άννα", "Βασιλείου", "Αθήνα", "organizer", "approved"},
		{"00000000-0000-0000-0000-000000000022", "thessfest", "Κώστας", "Παύλου", "Θεσσαλονίκη", "organizer", "approved"},
		{"00000000-0000-0000-0000-000000000023", "cretelive", "Μανώλης", "Σταυρακάκης", "Ηράκλειο", "organizer", "pending"},
	}
	for _, p := range people {
		u := postgres.UserModel{
			ID: mustUUID(p.id), Username: p.username, Password: pw,
			FirstName: p.first, LastName: p.last, Email: p.username + "@nexustickets.local",
			City: strPtr(p.city), Country: strPtr("GR"),
			Role: p.role, AccountStatus: p.status, CreatedAt: now, UpdatedAt: now,
		}
		insertIfMissing(d, &postgres.UserModel{}, "username = ?", u.Username, &u)
	}

	// Hand two of the generated events to the new organizers so their
	// dashboards are not empty (the generator assigns everything to the demo
	// organizer). Ids come from generatedEvents(): 0000000f0000, 0000000f0001…
	reassign := map[string]string{
		"00000000-0000-0000-0000-0000000f0002": "00000000-0000-0000-0000-000000000021",
		"00000000-0000-0000-0000-0000000f0003": "00000000-0000-0000-0000-000000000021",
		"00000000-0000-0000-0000-0000000f0004": "00000000-0000-0000-0000-000000000022",
		"00000000-0000-0000-0000-0000000f0005": "00000000-0000-0000-0000-000000000022",
	}
	for eventID, orgID := range reassign {
		if err := d.Model(&postgres.EventModel{}).Where("id = ?", mustUUID(eventID)).
			Update("organizer_id", mustUUID(orgID)).Error; err != nil {
			panic(fmt.Errorf("reassign event %s: %w", eventID, err))
		}
	}

	// Bookings: (booking id suffix, user, event, quantity). The ticket type is
	// the event's first; availability is decremented the way the API would.
	type bk struct {
		n, user, event string
		qty            int
	}
	bookings := []bk{
		{"01", "11", "0000000f0000", 2}, {"02", "12", "0000000f0000", 1}, {"03", "13", "0000000f0001", 3},
		{"04", "14", "0000000f0001", 1}, {"05", "11", "0000000f0002", 2}, {"06", "12", "0000000f0003", 2},
		{"07", "13", "0000000f0004", 1}, {"08", "14", "0000000f0005", 4}, {"09", "11", "0000000f0006", 1},
		{"10", "12", "0000000f0007", 2}, {"11", "13", "0000000f0008", 1}, {"12", "14", "0000000f0009", 2},
		{"13", "03", "0000000f0002", 1}, {"14", "03", "0000000f0004", 2},
	}
	for _, b := range bookings {
		id := mustUUID("00000000-0000-0000-0000-0000000c00" + b.n)
		userID := mustUUID("00000000-0000-0000-0000-0000000000" + b.user)
		eventID := mustUUID("00000000-0000-0000-0000-" + b.event)
		if exists(d, &postgres.BookingModel{}, "id = ?", id) {
			continue
		}
		var tt postgres.TicketTypeModel
		if err := d.Where("event_id = ?", eventID).Order("price ASC").First(&tt).Error; err != nil {
			continue // event not seeded (should not happen)
		}
		if tt.Available < b.qty {
			continue
		}
		created := now.Add(-time.Duration(len(b.n)*7) * time.Hour)
		err := d.Transaction(func(tx *gorm.DB) error {
			if err := tx.Model(&postgres.TicketTypeModel{}).Where("id = ? AND available >= ?", tt.ID, b.qty).
				Update("available", gorm.Expr("available - ?", b.qty)).Error; err != nil {
				return err
			}
			return tx.Create(&postgres.BookingModel{
				ID: id, UserID: userID, EventID: eventID, TicketTypeID: tt.ID,
				Quantity: b.qty, TotalCost: tt.Price * float64(b.qty), Status: "confirmed",
				ConfirmedAt: &created, CreatedAt: created, UpdatedAt: now,
			}).Error
		})
		if err != nil {
			panic(fmt.Errorf("seed booking %s: %w", b.n, err))
		}
	}

	// Messages between people who share a booking (the mailbox rule).
	type msg struct {
		n, from, to, event, subject, body string
		read                              bool
	}
	msgs := []msg{
		{"01", "11", "02", "0000000f0000", "Ερώτηση για τη θέση", "Καλησπέρα, οι θέσεις είναι αριθμημένες ή ελεύθερες;", true},
		{"02", "02", "11", "0000000f0000", "Re: Ερώτηση για τη θέση", "Καλησπέρα Μαρία, οι θέσεις είναι ελεύθερες — έλα νωρίς για καλή θέση!", false},
		{"03", "12", "02", "0000000f0000", "Πρόσβαση με αμαξίδιο", "Υπάρχει πρόσβαση για αμαξίδιο στον χώρο;", true},
		{"04", "02", "12", "0000000f0000", "Re: Πρόσβαση με αμαξίδιο", "Ναι, υπάρχει ράμπα στην κεντρική είσοδο και ειδικός χώρος.", false},
		{"05", "13", "02", "0000000f0001", "Αλλαγή ονόματος", "Μπορώ να αλλάξω το όνομα στο εισιτήριο;", false},
		{"06", "11", "21", "0000000f0002", "Ώρα προσέλευσης", "Τι ώρα ανοίγουν οι πόρτες;", true},
		{"07", "21", "11", "0000000f0002", "Re: Ώρα προσέλευσης", "Μία ώρα πριν την έναρξη. Καλή διασκέδαση!", false},
		{"08", "22", "12", "0000000f0003", "Ενημέρωση για τον χώρο", "Η παράσταση μεταφέρεται στη μεγάλη σκηνή, η ώρα παραμένει ίδια.", false},
		{"09", "14", "22", "0000000f0005", "Ομαδικό εισιτήριο", "Είμαστε 4 άτομα, υπάρχει έκπτωση;", false},
		{"10", "03", "21", "0000000f0002", "Ευχαριστώ", "Ευχαριστώ για την άμεση απάντηση.", true},
	}
	for _, m := range msgs {
		id := mustUUID("00000000-0000-0000-0000-0000000d00" + m.n)
		if exists(d, &postgres.MessageModel{}, "id = ?", id) {
			continue
		}
		eventID := mustUUID("00000000-0000-0000-0000-" + m.event)
		var readAt *time.Time
		if m.read {
			t := now.Add(-time.Hour)
			readAt = &t
		}
		row := postgres.MessageModel{
			ID: id, SenderID: mustUUID("00000000-0000-0000-0000-0000000000" + m.from),
			RecipientID: mustUUID("00000000-0000-0000-0000-0000000000" + m.to), EventID: &eventID,
			Subject: m.subject, Body: m.body, ReadAt: readAt,
			CreatedAt: now.Add(-time.Duration(20-len(m.n)) * time.Hour),
		}
		if err := d.Create(&row).Error; err != nil {
			panic(fmt.Errorf("seed message %s: %w", m.n, err))
		}
	}

	// Support tickets in every state, with threads.
	// The server creates the built-in admin on startup with a random id, and
	// seeding keeps that account when it already exists, so look it up.
	var adminRow postgres.UserModel
	if err := d.Select("id").Where("username = ?", "admin").First(&adminRow).Error; err != nil {
		panic(fmt.Errorf("seed tickets: no admin account: %w", err))
	}
	admin := adminRow.ID
	type ticket struct {
		n, user, subject, status string
		thread                   []struct {
			admin bool
			body  string
		}
	}
	tickets := []ticket{
		{"01", "11", "Δεν βλέπω την κράτησή μου", "answered", []struct {
			admin bool
			body  string
		}{
			{false, "Έκανα κράτηση χθες αλλά δεν εμφανίζεται στις κρατήσεις μου."},
			{true, "Καλησπέρα, το ελέγξαμε — η κράτηση είναι καταχωρημένη. Δοκιμάστε ανανέωση της σελίδας."},
		}},
		{"02", "12", "Αλλαγή email", "open", []struct {
			admin bool
			body  string
		}{
			{false, "Θέλω να αλλάξω το email του λογαριασμού μου."},
		}},
		{"03", "13", "Ερώτηση για επιστροφή χρημάτων", "closed", []struct {
			admin bool
			body  string
		}{
			{false, "Η εκδήλωση ακυρώθηκε, πώς γίνεται η επιστροφή;"},
			{true, "Η επιστροφή γίνεται αυτόματα στο μέσο πληρωμής εντός 5 εργάσιμων."},
			{false, "Ευχαριστώ, το έλαβα."},
		}},
		{"04", "23", "Έγκριση λογαριασμού διοργανωτή", "open", []struct {
			admin bool
			body  string
		}{
			{false, "Πότε θα εγκριθεί ο λογαριασμός μου για να ανεβάσω εκδηλώσεις;"},
		}},
		{"05", "21", "Ανέβασμα φωτογραφιών", "answered", []struct {
			admin bool
			body  string
		}{
			{false, "Οι φωτογραφίες πάνω από 5MB απορρίπτονται."},
			{true, "Σωστά, το όριο είναι 5MB ανά αρχείο. Συμπιέστε τις εικόνες πριν το ανέβασμα."},
		}},
	}
	for _, tk := range tickets {
		id := mustUUID("00000000-0000-0000-0000-0000000e00" + tk.n)
		if exists(d, &postgres.SupportTicketModel{}, "id = ?", id) {
			continue
		}
		userID := mustUUID("00000000-0000-0000-0000-0000000000" + tk.user)
		created := now.Add(-time.Duration(48-len(tk.n)) * time.Hour)
		if err := d.Create(&postgres.SupportTicketModel{
			ID: id, UserID: userID, Subject: tk.subject, Status: tk.status,
			CreatedAt: created, UpdatedAt: created.Add(time.Duration(len(tk.thread)) * time.Hour),
		}).Error; err != nil {
			panic(fmt.Errorf("seed ticket %s: %w", tk.n, err))
		}
		for i, m := range tk.thread {
			author := userID
			if m.admin {
				author = admin
			}
			if err := d.Create(&postgres.SupportMessageModel{
				ID: uuid.New(), TicketID: id, AuthorID: author, Body: m.body,
				CreatedAt: created.Add(time.Duration(i) * time.Hour),
			}).Error; err != nil {
				panic(fmt.Errorf("seed ticket message: %w", err))
			}
		}
	}

	fmt.Printf("seeded %d extra users, %d bookings, %d messages, %d support tickets\n",
		len(people), len(bookings), len(msgs), len(tickets))
}

func exists(d *gorm.DB, model any, where string, arg any) bool {
	err := d.Where(where, arg).First(model).Error
	if err == nil {
		return true
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		panic(err)
	}
	return false
}

// insertIfMissing creates the row unless one matching `where` exists.
func insertIfMissing(d *gorm.DB, probe any, where string, arg any, row any) {
	if exists(d, probe, where, arg) {
		return
	}
	if err := d.Create(row).Error; err != nil {
		panic(fmt.Errorf("insert %s: %w", strings.TrimSpace(fmt.Sprint(arg)), err))
	}
}
