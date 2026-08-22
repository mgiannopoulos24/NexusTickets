package main

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"nexustickets/internal/config"
	"nexustickets/internal/db"
	"nexustickets/internal/repository/postgres"
	"nexustickets/pkg/logger"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(1)
	}

	log, err := logger.New(cfg.AppEnv)
	if err != nil {
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(1)
	}
	defer func() { _ = log.Sync() }()

	pg, err := db.NewPostgres(cfg)
	if err != nil {
		log.Fatal("postgres init failed", zap.Error(err))
	}
	defer func() { _ = pg.SQL.Close() }()

	if err := db.AutoMigrate(pg.Gorm); err != nil {
		log.Fatal("auto migrate failed", zap.Error(err))
	}

	seedUsers(pg.Gorm)
	seedCategories(pg.Gorm)
	seedEvents(pg.Gorm)

	log.Info("seed complete")
}

func mustUUID(s string) uuid.UUID {
	id, err := uuid.Parse(s)
	if err != nil {
		panic(fmt.Sprintf("invalid uuid %q: %v", s, err))
	}
	return id
}

func hashPassword(pw string) string {
	h, err := bcrypt.GenerateFromPassword([]byte(pw), 12)
	if err != nil {
		panic(err)
	}
	return string(h)
}

func seedUsers(d *gorm.DB) {
	now := time.Now().UTC()
	users := []postgres.UserModel{
		{
			ID:            mustUUID("00000000-0000-0000-0000-000000000001"),
			Username:      "admin",
			Password:      hashPassword("ChangeMe123!"),
			FirstName:     "Admin",
			LastName:      "User",
			Email:         "admin@nexustickets.local",
			Role:          "admin",
			AccountStatus: "approved",
			CreatedAt:     now,
			UpdatedAt:     now,
		},
		{
			ID:            mustUUID("00000000-0000-0000-0000-000000000002"),
			Username:      "organizer",
			Password:      hashPassword("ChangeMe123!"),
			FirstName:     "Demo",
			LastName:      "Organizer",
			Email:         "organizer@nexustickets.local",
			City:          strPtr("Αθήνα"),
			Country:       strPtr("GR"),
			Role:          "organizer",
			AccountStatus: "approved",
			CreatedAt:     now,
			UpdatedAt:     now,
		},
		{
			ID:            mustUUID("00000000-0000-0000-0000-000000000003"),
			Username:      "attendee",
			Password:      hashPassword("ChangeMe123!"),
			FirstName:     "Demo",
			LastName:      "Attendee",
			Email:         "attendee@nexustickets.local",
			City:          strPtr("Θεσσαλονίκη"),
			Country:       strPtr("GR"),
			Role:          "attendee",
			AccountStatus: "approved",
			CreatedAt:     now,
			UpdatedAt:     now,
		},
	}

	for _, u := range users {
		err := d.Where("username = ?", u.Username).First(&postgres.UserModel{}).Error
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			panic(err)
		}
		if err := d.Create(&u).Error; err != nil {
			panic(err)
		}
	}
	fmt.Println("seeded 3 users")
}

// eventTypeFromCategory maps a seeded category id to a DTD EventType value.
func eventTypeFromCategory(m map[string]string, catID string) string {
	if t, ok := m[strings.ToLower(catID)]; ok {
		return t
	}
	return "event"
}

func seedCategories(d *gorm.DB) {
	cats := []postgres.CategoryModel{
		{ID: mustUUID("00000000-0000-0000-0000-000000000101"), Name: "Μουσική"},
		{ID: mustUUID("00000000-0000-0000-0000-000000000102"), Name: "Θέατρο"},
		{ID: mustUUID("00000000-0000-0000-0000-000000000103"), Name: "Αθλητισμός"},
		{ID: mustUUID("00000000-0000-0000-0000-000000000104"), Name: "Τεχνολογία"},
		{ID: mustUUID("00000000-0000-0000-0000-000000000105"), Name: "Εκπαίδευση"},
		{ID: mustUUID("00000000-0000-0000-0000-000000000106"), Name: "Τέχνη"},
	}

	for _, c := range cats {
		err := d.Where("name = ?", c.Name).First(&postgres.CategoryModel{}).Error
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			panic(err)
		}
		if err := d.Create(&c).Error; err != nil {
			panic(err)
		}
	}
	fmt.Println("seeded 6 categories")
}

func seedEvents(d *gorm.DB) {
	type ticketSeed struct {
		id        string
		name      string
		price     float64
		quantity  int
		available int
	}

	type eventSeed struct {
		id       string
		title    string
		desc     string
		venue    string
		addr     *string
		city     string
		country  *string
		lat      *float64
		lng      *float64
		start    time.Time
		end      time.Time
		capacity int
		catID    string
		tickets  []ticketSeed
	}

	orgID := mustUUID("00000000-0000-0000-0000-000000000002")
	musicID := "00000000-0000-0000-0000-000000000101"
	theaterID := "00000000-0000-0000-0000-000000000102"
	sportsID := "00000000-0000-0000-0000-000000000103"
	techID := "00000000-0000-0000-0000-000000000104"
	eduID := "00000000-0000-0000-0000-000000000105"
	artID := "00000000-0000-0000-0000-000000000106"

	f := func(s string) time.Time {
		t, err := time.Parse(time.RFC3339, s)
		if err != nil {
			panic(err)
		}
		return t
	}
	fp := func(v float64) *float64 { return &v }
	sp := func(s string) *string { return &s }

	events := []eventSeed{
		{
			id: "00000000-0000-0000-0000-00000000E001", title: "Athens Jazz Festival 2026",
			desc:  "Το μεγαλύτερο φεστιβάλ τζαζ της Αθήνας με καλλιτέχνες από όλο τον κόσμο. Τρεις ημέρες γεμάτες αυτοσχεδιασμό, swing και ρυθμούς.",
			venue: "Κέντρο Πολιτισμού Ίδρυμα Σταύρος Νιάρχος", addr: sp("Λεωφ. Συγγρού 364"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.941), lng: fp(23.694),
			start: f("2026-07-15T18:00:00Z"), end: f("2026-07-17T23:00:00Z"), capacity: 5000, catID: musicID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a001", name: "Early Bird", price: 25.00, quantity: 500, available: 500},
				{id: "00000000-0000-0000-0000-00000000a002", name: "Γενική Είσοδος", price: 40.00, quantity: 3000, available: 3000},
				{id: "00000000-0000-0000-0000-00000000a003", name: "VIP", price: 80.00, quantity: 1500, available: 1500},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E002", title: "Συναυλία Ελληνικού Ροκ — Θεσσαλονίκη",
			desc:  "Οι κορυφαίες μπάντες του ελληνικού ροκ ενώνουν τις δυνάμεις τους για μία μοναδική βραδιά. Μαζί μας οι Ξύλινα Σπαθιά, Τρύπες και Μωρά στη Φωτιά.",
			venue: "Πλατεία Αριστοτέλους", addr: sp("Πλατεία Αριστοτέλους"), city: "Θεσσαλονίκη", country: sp("Ελλάδα"), lat: fp(40.633), lng: fp(22.938),
			start: f("2026-08-20T20:00:00Z"), end: f("2026-08-21T02:00:00Z"), capacity: 8000, catID: musicID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a004", name: "Γενική Είσοδος", price: 15.00, quantity: 6000, available: 6000},
				{id: "00000000-0000-0000-0000-00000000a005", name: "Μπροστινή Ζώνη", price: 30.00, quantity: 2000, available: 2000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E003", title: "Athens Techno Festival",
			desc:  "Τριήμερο φεστιβάλ ηλεκτρονικής μουσικής με διεθνείς DJs. Main stage, techno tent και chill-out zone στο πρώην αεροδρόμιο του Ελληνικού.",
			venue: "Παλιό Αεροδρόμιο Ελληνικού", addr: sp("Λεωφ. Ποσειδώνος"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.894), lng: fp(23.748),
			start: f("2026-06-26T16:00:00Z"), end: f("2026-06-28T06:00:00Z"), capacity: 15000, catID: musicID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a006", name: "Ημερήσιο", price: 35.00, quantity: 8000, available: 8000},
				{id: "00000000-0000-0000-0000-00000000a007", name: "Τριήμερο", price: 70.00, quantity: 7000, available: 7000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E004", title: "Συναυλία Νίκου Πορτοκάλογλου",
			desc:  "Ο αγαπημένος τραγουδοποιός σε μια μοναδική ακουστική βραδιά στο θέατρο Λυκαβηττού. Μαζί του η Μάρθα Φριτζήλα.",
			venue: "Θέατρο Λυκαβηττού", addr: sp("Λόφος Λυκαβηττού"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.981), lng: fp(23.746),
			start: f("2026-07-03T21:00:00Z"), end: f("2026-07-03T23:30:00Z"), capacity: 4000, catID: musicID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a008", name: "Γενική Είσοδος", price: 20.00, quantity: 3000, available: 3000},
				{id: "00000000-0000-0000-0000-00000000a009", name: "VIP", price: 50.00, quantity: 1000, available: 1000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E005", title: "Release Athens 2026",
			desc:  "Το κορυφαίο φεστιβάλ ροκ και indie της χρονιάς. Φέτος headliners: Editors, Fontaines D.C. και οι Έλληνες The Boy.",
			venue: "Πλατεία Νερού", addr: sp("Λεωφ. Ποσειδώνος"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.896), lng: fp(23.684),
			start: f("2026-06-19T17:00:00Z"), end: f("2026-06-21T23:00:00Z"), capacity: 20000, catID: musicID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a00A", name: "Ημερήσιο", price: 40.00, quantity: 10000, available: 10000},
				{id: "00000000-0000-0000-0000-00000000a00B", name: "Τριήμερο", price: 90.00, quantity: 10000, available: 10000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E006", title: "Muse — Will of the People Tour",
			desc:  "Το βρετανικό συγκρότημα έρχεται για πρώτη φορά στην Αθήνα για μία συναυλία-υπερθέαμα στο ΟΑΚΑ.",
			venue: "ΟΑΚΑ", addr: sp("Λεωφ. Κηφισίας 37"), city: "Μαρούσι", country: sp("Ελλάδα"), lat: fp(38.038), lng: fp(23.786),
			start: f("2026-09-02T20:00:00Z"), end: f("2026-09-02T23:30:00Z"), capacity: 30000, catID: musicID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a00C", name: "Γενική Είσοδος", price: 50.00, quantity: 20000, available: 20000},
				{id: "00000000-0000-0000-0000-00000000a00D", name: "VIP", price: 120.00, quantity: 10000, available: 10000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E007", title: "Πανηγύρι της Ξάνθης",
			desc:  "Το παραδοσιακό πανηγύρι έρχεται στην πόλη. Ζωντανή ορχήστρα με δημοτικά τραγούδια, χορός και τοπικά κρασιά όλη τη νύχτα.",
			venue: "Πλατεία Διοικητηρίου", addr: sp("Πλατεία Διοικητηρίου"), city: "Ξάνθη", country: sp("Ελλάδα"), lat: fp(41.135), lng: fp(24.887),
			start: f("2026-09-15T19:00:00Z"), end: f("2026-09-16T01:00:00Z"), capacity: 3000, catID: musicID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a00E", name: "Γενική Είσοδος", price: 5.00, quantity: 3000, available: 3000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E008", title: "Αφιέρωμα στον Μίκη Θεοδωράκη",
			desc:  "Μια μεγάλη συναυλία αφιερωμένη στον κορυφαίο Έλληνα μουσικοσυνθέτη. Συμμετέχουν η Ρίτα Αντωνοπούλου, ο Βασίλης Λέκκας και η ΚΟΑ.",
			venue: "Ηρώδειο", addr: sp("Διονυσίου Αρεοπαγίτου"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.971), lng: fp(23.726),
			start: f("2026-08-02T21:00:00Z"), end: f("2026-08-02T23:30:00Z"), capacity: 5000, catID: musicID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a00F", name: "Άνω Διάζωμα", price: 30.00, quantity: 3000, available: 3000},
				{id: "00000000-0000-0000-0000-00000000a010", name: "Κάτω Διάζωμα", price: 60.00, quantity: 2000, available: 2000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E009", title: "Οιδίπους Τύραννος — Καλοκαιρινή Περιοδεία",
			desc:  "Το αρχαίο δράμα του Σοφοκλή με τον Δημήτρη Ηλία στον ομώνυμο ρόλο. Μία παράσταση-γεγονός για το καλοκαίρι.",
			venue: "Αρχαίο Θέατρο Επιδαύρου", addr: sp("Επίδαυρος"), city: "Ναύπλιο", country: sp("Ελλάδα"), lat: fp(37.635), lng: fp(23.157),
			start: f("2026-07-25T21:00:00Z"), end: f("2026-07-25T23:30:00Z"), capacity: 14000, catID: theaterID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a011", name: "Άνω Διάζωμα", price: 25.00, quantity: 10000, available: 10000},
				{id: "00000000-0000-0000-0000-00000000a012", name: "Κάτω Διάζωμα", price: 45.00, quantity: 4000, available: 4000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E00A", title: "Σεσουάρ για Δολοφόνους",
			desc:  "Η ξεκαρδιστική κωμωδία του Ρομπέρ Τομά. Ένα κομμωτήριο γίνεται σκηνικό μυστηρίου. Παίζουν: Ελένη Ράντου, Γιάννης Μπέζος.",
			venue: "Θέατρο Αθηνών", addr: sp("Οδός Σταδίου 48"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.975), lng: fp(23.733),
			start: f("2026-10-10T19:00:00Z"), end: f("2026-10-10T21:30:00Z"), capacity: 600, catID: theaterID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a013", name: "Κανονικό", price: 20.00, quantity: 400, available: 400},
				{id: "00000000-0000-0000-0000-00000000a014", name: "Φοιτητικό", price: 12.00, quantity: 200, available: 200},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E00B", title: "Η Αυλή των Θαυμάτων",
			desc:  "Το αριστούργημα του Ιάκωβου Καμπανέλλη σε σκηνοθεσία της νέας γενιάς. Μια παράσταση για τη μνήμη και την ταυτότητα.",
			venue: "Θέατρο Τέχνης Καρόλου Κουν", addr: sp("Οδός Πεσμαζόγλου 5"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.978), lng: fp(23.733),
			start: f("2026-05-05T18:00:00Z"), end: f("2026-05-05T21:00:00Z"), capacity: 300, catID: theaterID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a015", name: "Κανονικό", price: 18.00, quantity: 200, available: 200},
				{id: "00000000-0000-0000-0000-00000000a016", name: "Φοιτητικό", price: 10.00, quantity: 100, available: 100},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E00C", title: "Λυσιστράτη — Αριστοφάνης στο Φεστιβάλ Αθηνών",
			desc:  "Η διαχρονική κωμωδία σε σύγχρονη μεταγραφή. Μία παράσταση για τη δύναμη των γυναικών και την ειρήνη.",
			venue: "Ωδείο Ηρώδου του Αττικού", addr: sp("Διονυσίου Αρεοπαγίτου"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.971), lng: fp(23.726),
			start: f("2026-08-15T21:00:00Z"), end: f("2026-08-15T23:30:00Z"), capacity: 5000, catID: theaterID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a017", name: "Άνω Διάζωμα", price: 25.00, quantity: 3000, available: 3000},
				{id: "00000000-0000-0000-0000-00000000a018", name: "Κάτω Διάζωμα", price: 50.00, quantity: 2000, available: 2000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E00D", title: "Το Ημερολόγιο της Άννας Φρανκ",
			desc:  "Η συγκλονιστική ιστορία της Άννας Φρανκ στο θέατρο. Παίζει η Μαρία Κίτσου.",
			venue: "Σταθμός — Θέατρο Σύγχρονου Λόγου", addr: sp("Λεωφ. Βασιλίσσης Σοφίας 26"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.981), lng: fp(23.761),
			start: f("2026-04-20T19:00:00Z"), end: f("2026-04-20T21:30:00Z"), capacity: 250, catID: theaterID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a019", name: "Κανονικό", price: 15.00, quantity: 180, available: 180},
				{id: "00000000-0000-0000-0000-00000000a01A", name: "Φοιτητικό", price: 8.00, quantity: 70, available: 70},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E00E", title: "Εκκλησιάζουσες — Αριστοφάνης",
			desc:  "Οι γυναίκες καταλαμβάνουν την Εκκλησία του Δήμου σε μία φρέσκια και τολμηρή παράσταση.",
			venue: "Αρχαίο Θέατρο Δωδώνης", addr: sp("Δωδώνη"), city: "Ιωάννινα", country: sp("Ελλάδα"), lat: fp(39.547), lng: fp(20.788),
			start: f("2026-07-10T21:00:00Z"), end: f("2026-07-10T23:30:00Z"), capacity: 10000, catID: theaterID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a01B", name: "Γενική Είσοδος", price: 15.00, quantity: 10000, available: 10000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E00F", title: "Κάποτε στο Λος Άντζελες",
			desc:  "Το νέο έργο του Δημήτρη Δημητριάδη. Μια σκοτεινή κωμωδία για το Σινεμά, τη φήμη και την παρακμή.",
			venue: "Θέατρο Πειραιώς 260", addr: sp("Πειραιώς 260"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.947), lng: fp(23.642),
			start: f("2026-06-05T20:00:00Z"), end: f("2026-06-05T22:30:00Z"), capacity: 800, catID: theaterID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a01C", name: "Κανονικό", price: 22.00, quantity: 500, available: 500},
				{id: "00000000-0000-0000-0000-00000000a01D", name: "Φοιτητικό", price: 14.00, quantity: 300, available: 300},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E010", title: "Μήδεια — Θεατρική Παράσταση",
			desc:  "Η τραγωδία του Ευριπίδη σε μία σύγχρονη ανάγνωση με την Καρυοφυλλιά Καραμπέτη.",
			venue: "Αρχαίο Θέατρο Φιλίππων", addr: sp("Φίλιπποι"), city: "Καβάλα", country: sp("Ελλάδα"), lat: fp(41.013), lng: fp(24.283),
			start: f("2026-08-08T21:00:00Z"), end: f("2026-08-08T23:30:00Z"), capacity: 8000, catID: theaterID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a01E", name: "Άνω Διάζωμα", price: 20.00, quantity: 5000, available: 5000},
				{id: "00000000-0000-0000-0000-00000000a01F", name: "Κάτω Διάζωμα", price: 40.00, quantity: 3000, available: 3000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E011", title: "Athens Marathon 2026 — Ο Αυθεντικός",
			desc:  "Ο ιστορικός αγώνας από τον Μαραθώνα στην Αθήνα. Διεθνής συμμετοχή με περισσότερους από 50.000 δρομείς.",
			venue: "Παναθηναϊκό Στάδιο", addr: sp("Λεωφ. Βασιλέως Κωνσταντίνου"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.968), lng: fp(23.721),
			start: f("2026-11-08T07:00:00Z"), end: f("2026-11-08T18:00:00Z"), capacity: 55000, catID: sportsID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a020", name: "Εγγραφή Αγώνα", price: 50.00, quantity: 55000, available: 55000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E012", title: "Παναθηναϊκός — Ολυμπιακός: Ντέρμπι Αιωνίων",
			desc:  "Το μεγαλύτερο ντέρμπι του ελληνικού μπάσκετ στο ΟΑΚΑ.",
			venue: "ΟΑΚΑ — Κλειστό Γήπεδο Μπάσκετ", addr: sp("Λεωφ. Κηφισίας 37"), city: "Μαρούσι", country: sp("Ελλάδα"), lat: fp(38.042), lng: fp(23.788),
			start: f("2026-05-10T20:00:00Z"), end: f("2026-05-10T23:00:00Z"), capacity: 18500, catID: sportsID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a021", name: "Απλή Θέση", price: 20.00, quantity: 10000, available: 10000},
				{id: "00000000-0000-0000-0000-00000000a022", name: "Επισήμων", price: 50.00, quantity: 5000, available: 5000},
				{id: "00000000-0000-0000-0000-00000000a023", name: "VIP Lounge", price: 100.00, quantity: 3500, available: 3500},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E013", title: "Ελλάδα — Τουρκία: Προκριματικά Euro 2028",
			desc:  "Η εθνική ομάδα αντιμετωπίζει την Τουρκία σε ένα κρίσιμο παιχνίδι για την πρόκριση στο Euro 2028.",
			venue: "Γήπεδο Αγιά Σοφιά", addr: sp("Λεωφ. Φιλικής Εταιρείας 1"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.949), lng: fp(23.664),
			start: f("2026-10-12T21:45:00Z"), end: f("2026-10-12T23:45:00Z"), capacity: 32000, catID: sportsID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a024", name: "Θύρα 1-8", price: 30.00, quantity: 20000, available: 20000},
				{id: "00000000-0000-0000-0000-00000000a025", name: "Θύρα 9-16", price: 50.00, quantity: 12000, available: 12000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E014", title: "Διεθνές Τουρνουά Τένις Αθηνών",
			desc:  "Το ATP 250 επιστρέφει στο Ολυμπιακό Κέντρο Αντισφαίρισης με κορυφαίους παίκτες από όλο τον κόσμο.",
			venue: "Ολυμπιακό Κέντρο Αντισφαίρισης", addr: sp("Λεωφ. Κηφισίας 37"), city: "Μαρούσι", country: sp("Ελλάδα"), lat: fp(38.045), lng: fp(23.793),
			start: f("2026-09-28T10:00:00Z"), end: f("2026-10-04T20:00:00Z"), capacity: 8000, catID: sportsID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a026", name: "Ημερήσιο", price: 15.00, quantity: 6000, available: 6000},
				{id: "00000000-0000-0000-0000-00000000a027", name: "Εβδομαδιαίο", price: 60.00, quantity: 2000, available: 2000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E015", title: "Ράλλυ Ακρόπολις 2026",
			desc:  "O θρυλικός αγώνας αυτοκινήτου επιστρέφει στα βουνά της Στερεάς Ελλάδας. Δραματικές διαδρομές και μοναδική θέα.",
			venue: "Παρασκευή Εκκίνηση — Καστέλλα", addr: sp("Λόφος Καστέλλας"), city: "Πειραιάς", country: sp("Ελλάδα"), lat: fp(37.937), lng: fp(23.656),
			start: f("2026-09-10T08:00:00Z"), end: f("2026-09-12T18:00:00Z"), capacity: 50000, catID: sportsID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a028", name: "Γενική Είσοδος", price: 10.00, quantity: 50000, available: 50000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E016", title: "Διεθνές Μίτινγκ Στίβου «Παπαναστασίου»",
			desc:  "Το κορυφαίο μίτινγκ στίβου της Νοτιοανατολικής Ευρώπης με Ολυμπιονίκες και παγκόσμια αστέρια.",
			venue: "Στάδιο Καραϊσκάκη", addr: sp("Πειραιώς 1"), city: "Πειραιάς", country: sp("Ελλάδα"), lat: fp(37.947), lng: fp(23.665),
			start: f("2026-06-20T18:00:00Z"), end: f("2026-06-20T22:00:00Z"), capacity: 15000, catID: sportsID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a029", name: "Απλή Θέση", price: 10.00, quantity: 10000, available: 10000},
				{id: "00000000-0000-0000-0000-00000000a02A", name: "Επισήμων", price: 30.00, quantity: 5000, available: 5000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E017", title: "Ποδηλατικός Γύρος Ηπείρου",
			desc:  "Τετραήμερος αγώνας ποδηλασίας στα βουνά της Ηπείρου. Διαδρομή 400 χιλιομέτρων με εκκίνηση από τα Ιωάννινα.",
			venue: "Πλατεία Μαβίλη", addr: sp("Πλατεία Μαβίλη"), city: "Ιωάννινα", country: sp("Ελλάδα"), lat: fp(39.667), lng: fp(20.854),
			start: f("2026-05-14T09:00:00Z"), end: f("2026-05-17T17:00:00Z"), capacity: 2000, catID: sportsID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a02B", name: "Εγγραφή", price: 20.00, quantity: 2000, available: 2000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E018", title: "Ελλάδα — Ισπανία: Προκριματικά Παγκοσμίου Κυπέλλου",
			desc:  "Η εθνική μπάσκετ αντιμετωπίζει την Ισπανία στο ΣΕΦ.",
			venue: "Στάδιο Ειρήνης και Φιλίας", addr: sp("Λεωφ. Ποσειδώνος 1"), city: "Πειραιάς", country: sp("Ελλάδα"), lat: fp(37.941), lng: fp(23.672),
			start: f("2026-08-28T21:00:00Z"), end: f("2026-08-28T23:30:00Z"), capacity: 12000, catID: sportsID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a02C", name: "Απλή Θέση", price: 25.00, quantity: 8000, available: 8000},
				{id: "00000000-0000-0000-0000-00000000a02D", name: "VIP", price: 60.00, quantity: 4000, available: 4000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E019", title: "DevConf Athens 2026",
			desc:  "Το μεγαλύτερο συνέδριο προγραμματισμού στην Ελλάδα. AI, Cloud, Cybersecurity και Web3. Workshops από μηχανικούς Google, Microsoft και GitHub.",
			venue: "Συνεδριακό Κέντρο Metropolitan Expo", addr: sp("Λεωφ. Αθηνών 40"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.920), lng: fp(23.943),
			start: f("2026-09-18T09:00:00Z"), end: f("2026-09-19T19:00:00Z"), capacity: 3000, catID: techID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a02E", name: "Κανονικό", price: 100.00, quantity: 2000, available: 2000},
				{id: "00000000-0000-0000-0000-00000000a02F", name: "Φοιτητικό", price: 50.00, quantity: 1000, available: 1000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E01A", title: "HackThess 2026",
			desc:  "36ωρο hackathon στη Θεσσαλονίκη με θέμα την έξυπνη πόλη. Λύσεις για βιώσιμη αστική ανάπτυξη.",
			venue: "Διεθνές Κέντρο Ψηφιακού Μετασχηματισμού", addr: sp("Λεωφ. Δικαστηρίων 1"), city: "Θεσσαλονίκη", country: sp("Ελλάδα"), lat: fp(40.637), lng: fp(22.937),
			start: f("2026-11-27T10:00:00Z"), end: f("2026-11-28T22:00:00Z"), capacity: 500, catID: techID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a030", name: "Δωρεάν Συμμετοχή", price: 0.00, quantity: 500, available: 500},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E01B", title: "PyCon Greece 2026",
			desc:  "Το μεγαλύτερο συνέδριο Python στη χώρα. Machine Learning, Data Engineering, Web Dev. Keynote: Guido van Rossum (live stream).",
			venue: "Συνεδριακό Κέντρο ΔΕΘ Helexpo", addr: sp("Εγνατία 154"), city: "Θεσσαλονίκη", country: sp("Ελλάδα"), lat: fp(40.625), lng: fp(22.954),
			start: f("2026-04-24T09:00:00Z"), end: f("2026-04-25T18:00:00Z"), capacity: 1200, catID: techID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a031", name: "Κανονικό", price: 80.00, quantity: 800, available: 800},
				{id: "00000000-0000-0000-0000-00000000a032", name: "Φοιτητικό", price: 30.00, quantity: 400, available: 400},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E01C", title: "Blockchain & Web3 Summit Athens",
			desc:  "Συνέδριο για την αποκεντρωμένη τεχνολογία, DeFi, NFTs και DAOs. Διεθνείς ομιλητές από Ethereum Foundation, Polygon, Solana.",
			venue: "Divani Caravel", addr: sp("Λεωφ. Βασιλέως Αλεξάνδρου 2"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.977), lng: fp(23.759),
			start: f("2026-10-08T10:00:00Z"), end: f("2026-10-09T18:00:00Z"), capacity: 800, catID: techID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a033", name: "Κανονικό", price: 150.00, quantity: 500, available: 500},
				{id: "00000000-0000-0000-0000-00000000a034", name: "Φοιτητικό", price: 60.00, quantity: 300, available: 300},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E01D", title: "Cybersecurity Forum 2026",
			desc:  "Συνέδριο για την ασφάλεια πληροφοριακών συστημάτων. Red team, blue team, zero trust architecture.",
			venue: "Εθνικό Ίδρυμα Ερευνών", addr: sp("Λεωφ. Βασιλέως Κωνσταντίνου 48"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.980), lng: fp(23.769),
			start: f("2026-06-10T09:00:00Z"), end: f("2026-06-10T17:00:00Z"), capacity: 400, catID: techID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a035", name: "Γενική Είσοδος", price: 50.00, quantity: 300, available: 300},
				{id: "00000000-0000-0000-0000-00000000a036", name: "Φοιτητικό", price: 20.00, quantity: 100, available: 100},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E01E", title: "AI & Data Science Symposium",
			desc:  "Το συμπόσιο τεχνητής νοημοσύνης με θεματικές: NLP, Computer Vision, Reinforcement Learning. Hands-on workshops σε PyTorch και TensorFlow.",
			venue: "Οικονομικό Πανεπιστήμιο Αθηνών", addr: sp("Πατησίων 76"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.994), lng: fp(23.732),
			start: f("2026-05-22T09:00:00Z"), end: f("2026-05-22T18:00:00Z"), capacity: 600, catID: techID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a037", name: "Κανονικό", price: 40.00, quantity: 400, available: 400},
				{id: "00000000-0000-0000-0000-00000000a038", name: "Φοιτητικό", price: 15.00, quantity: 200, available: 200},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E01F", title: "Startup Tech Day — Πανεπιστήμιο Πατρών",
			desc:  "Ημέρα σταδιοδρομίας και τεχνολογίας. 20+ εταιρείες πληροφορικής παρουσιάζουν θέσεις εργασίας. Διαγωνισμός καινοτομίας.",
			venue: "Πανεπιστήμιο Πατρών — Συνεδριακό Κέντρο", addr: sp("Πανεπιστημιούπολη Ρίου"), city: "Πάτρα", country: sp("Ελλάδα"), lat: fp(38.290), lng: fp(21.786),
			start: f("2026-05-08T10:00:00Z"), end: f("2026-05-08T17:00:00Z"), capacity: 1000, catID: techID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a039", name: "Δωρεάν", price: 0.00, quantity: 1000, available: 1000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E020", title: "Game Jam Athens 2026",
			desc:  "48ωρος διαγωνισμός δημιουργίας βιντεοπαιχνιδιών. Προγραμματιστές, καλλιτέχνες και μουσικοί συνεργάζονται για να φτιάξουν ένα παιχνίδι.",
			venue: "Πολυχώρος Αθηναΐς", addr: sp("Καστοριάς 34"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.979), lng: fp(23.703),
			start: f("2026-07-04T10:00:00Z"), end: f("2026-07-06T10:00:00Z"), capacity: 300, catID: techID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a03A", name: "Εγγραφή", price: 10.00, quantity: 300, available: 300},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E021", title: "TedxAthens 2026: Με Άλλα Μάτια",
			desc:  "Η ετήσια συγκέντρωση ιδεών με ομιλητές από όλο τον κόσμο. Φέτος: η αλλαγή οπτικής γωνίας.",
			venue: "Μέγαρο Μουσικής Αθηνών", addr: sp("Λεωφ. Βασιλίσσης Σοφίας 69"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.980), lng: fp(23.753),
			start: f("2026-04-25T10:00:00Z"), end: f("2026-04-25T19:00:00Z"), capacity: 2000, catID: eduID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a03B", name: "Γενική Είσοδος", price: 30.00, quantity: 1500, available: 1500},
				{id: "00000000-0000-0000-0000-00000000a03C", name: "VIP", price: 60.00, quantity: 500, available: 500},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E022", title: "Σεμινάριο Επιχειρηματικότητας — Startups 101",
			desc:  "Πρακτικό σεμινάριο για νέους επιχειρηματίες. Από το business plan μέχρι τον πρώτο γύρο χρηματοδότησης.",
			venue: "Impact Hub Athens", addr: sp("Καραϊσκάκη 28"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.988), lng: fp(23.722),
			start: f("2026-06-13T10:00:00Z"), end: f("2026-06-13T17:00:00Z"), capacity: 150, catID: eduID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a03D", name: "Δωρεάν", price: 0.00, quantity: 150, available: 150},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E023", title: "1ο Συνέδριο Νεοφυών Επιχειρήσεων Κρήτης",
			desc:  "Δικτύωση και ενημέρωση για startups στο Ηράκλειο. Ομιλίες, pitching session και mentoring από επιτυχημένους επιχειρηματίες.",
			venue: "Πολιτιστικό Κέντρο Ηρακλείου", addr: sp("Λεωφ. Ανδρέα Παπανδρέου 1"), city: "Ηράκλειο", country: sp("Ελλάδα"), lat: fp(35.337), lng: fp(25.123),
			start: f("2026-09-26T10:00:00Z"), end: f("2026-09-26T18:00:00Z"), capacity: 500, catID: eduID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a03E", name: "Δωρεάν", price: 0.00, quantity: 500, available: 500},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E024", title: "Ημερίδα Δια Βίου Μάθησης και Κατάρτισης",
			desc:  "Δωρεάν σεμινάρια για ενήλικες: ψηφιακές δεξιότητες, επαγγελματικός προσανατολισμός, τεχνικές αναζήτησης εργασίας.",
			venue: "Δημαρχείο Αθηναίων", addr: sp("Πλατεία Κοτζιά"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.984), lng: fp(23.728),
			start: f("2026-10-10T09:00:00Z"), end: f("2026-10-10T16:00:00Z"), capacity: 300, catID: eduID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a03F", name: "Δωρεάν", price: 0.00, quantity: 300, available: 300},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E025", title: "Εκπαιδευτικό Συνέδριο: STEM & Ρομποτική",
			desc:  "Εργαστήρια ρομποτικής και STEM για εκπαιδευτικούς και μαθητές. Διοργάνωση ΕΚΦΕ και Πανεπιστημίου Πατρών.",
			venue: "Πανεπιστήμιο Πατρών", addr: sp("Πανεπιστημιούπολη"), city: "Πάτρα", country: sp("Ελλάδα"), lat: fp(38.291), lng: fp(21.789),
			start: f("2026-11-15T09:30:00Z"), end: f("2026-11-15T16:00:00Z"), capacity: 400, catID: eduID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a040", name: "Γενική Είσοδος", price: 5.00, quantity: 250, available: 250},
				{id: "00000000-0000-0000-0000-00000000a041", name: "Φοιτητικό", price: 2.00, quantity: 150, available: 150},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E026", title: "Ημέρα Καριέρας — Πανεπιστήμιο Μακεδονίας",
			desc:  "Συναντήστε 30+ εταιρείες και βρείτε την επόμενη ευκαιρία σταδιοδρομίας σας. Σεμινάρια βιογραφικού και συνέντευξης.",
			venue: "Πανεπιστήμιο Μακεδονίας", addr: sp("Εγνατία 156"), city: "Θεσσαλονίκη", country: sp("Ελλάδα"), lat: fp(40.626), lng: fp(22.955),
			start: f("2026-05-20T10:00:00Z"), end: f("2026-05-20T17:00:00Z"), capacity: 2000, catID: eduID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a042", name: "Δωρεάν", price: 0.00, quantity: 2000, available: 2000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E027", title: "Φεστιβάλ Επιστήμης & Τεχνολογίας",
			desc:  "Διαδραστικά πειράματα, εκθέματα και ομιλίες για όλη την οικογένεια. Από το CERN μέχρι τον Διεθνή Διαστημικό Σταθμό.",
			venue: "Τεχνόπολη Δήμου Αθηναίων", addr: sp("Πειραιώς 100"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.978), lng: fp(23.714),
			start: f("2026-05-30T10:00:00Z"), end: f("2026-06-01T20:00:00Z"), capacity: 5000, catID: eduID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a043", name: "Γενική Είσοδος", price: 8.00, quantity: 3000, available: 3000},
				{id: "00000000-0000-0000-0000-00000000a044", name: "Οικογενειακό", price: 20.00, quantity: 2000, available: 2000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E028", title: "International Summer School — AI & Ethics",
			desc:  "Θερινό σχολείο για την ηθική της τεχνητής νοημοσύνης. Διακεκριμένοι καθηγητές από ΕΚΠΑ, ETH Zurich και MIT.",
			venue: "Αναπύρωμα Ελ. Βενιζέλου", addr: sp("Πανεπιστημιούπολη Ζωγράφου"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.968), lng: fp(23.769),
			start: f("2026-07-20T09:00:00Z"), end: f("2026-07-24T17:00:00Z"), capacity: 100, catID: eduID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a045", name: "Εγγραφή", price: 200.00, quantity: 80, available: 80},
				{id: "00000000-0000-0000-0000-00000000a046", name: "Υποτροφία", price: 50.00, quantity: 20, available: 20},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E029", title: "Ελληνογερμανική Συνάντηση — Εκπαίδευση & Καινοτομία",
			desc:  "Διμερές συνέδριο για τις προκλήσεις της εκπαίδευσης. Ανταλλαγή καλών πρακτικών μεταξύ Ελλάδας και Γερμανίας.",
			venue: "Γερμανικό Ινστιτούτο Goethe", addr: sp("Ομήρου 14"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.977), lng: fp(23.742),
			start: f("2026-06-24T09:00:00Z"), end: f("2026-06-25T16:00:00Z"), capacity: 200, catID: eduID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a047", name: "Δωρεάν", price: 0.00, quantity: 200, available: 200},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E02A", title: "Art Athina 2026 — Διεθνής Έκθεση Σύγχρονης Τέχνης",
			desc:  "60+ γκαλερί από 20 χώρες παρουσιάζουν έργα ζωγραφικής, γλυπτικής και εγκαταστάσεων.",
			venue: "Zάππειον Μέγαρο", addr: sp("Εθνικός Κήπος"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.971), lng: fp(23.738),
			start: f("2026-09-24T12:00:00Z"), end: f("2026-09-27T21:00:00Z"), capacity: 5000, catID: artID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a048", name: "Γενική Είσοδος", price: 15.00, quantity: 5000, available: 5000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E02B", title: "Φεστιβάλ Κινηματογράφου Θεσσαλονίκης 2026",
			desc:  "Το 67ο Φεστιβάλ προβάλλει ταινίες μικρού και μεγάλου μήκους από τη διεθνή σκηνή, με έμφαση σε νέους δημιουργούς.",
			venue: "Αποθήκη 1 — Λιμάνι Θεσσαλονίκης", addr: sp("Λιμάνι Θεσσαλονίκης"), city: "Θεσσαλονίκη", country: sp("Ελλάδα"), lat: fp(40.633), lng: fp(22.936),
			start: f("2026-11-05T15:00:00Z"), end: f("2026-11-15T23:00:00Z"), capacity: 8000, catID: artID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a049", name: "Ημερήσιο", price: 8.00, quantity: 5000, available: 5000},
				{id: "00000000-0000-0000-0000-00000000a04A", name: "Φοιτητικό", price: 5.00, quantity: 3000, available: 3000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E02C", title: "Εικαστική Έκθεση: «Φως & Σκιά»",
			desc:  "Η ετήσια έκθεση της Σχολής Καλών Τεχνών με έργα τελειόφοιτων. Zωγραφική, γλυπτική, χαρακτική, βίντεο αρτ.",
			venue: "Ανώτατη Σχολή Καλών Τεχνών", addr: sp("Πειραιώς 256"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.951), lng: fp(23.639),
			start: f("2026-07-02T10:00:00Z"), end: f("2026-07-30T21:00:00Z"), capacity: 2000, catID: artID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a04B", name: "Γενική Είσοδος", price: 5.00, quantity: 2000, available: 2000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E02D", title: "Street Art Festival — Πετράλωνα",
			desc:  "Το ετήσιο φεστιβάλ δρόμου επιστρέφει. Ζωντανές τοιχογραφίες, graffiti workshops, μουσική, χορός και φαγητό.",
			venue: "Πλατεία Κολοκοτρώνη — Πετράλωνα", addr: sp("Πλατεία Κολοκοτρώνη"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.966), lng: fp(23.714),
			start: f("2026-06-27T11:00:00Z"), end: f("2026-06-28T22:00:00Z"), capacity: 3000, catID: artID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a04C", name: "Δωρεάν", price: 0.00, quantity: 3000, available: 3000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E02E", title: "Έκθεση Φωτογραφίας — Δρόμοι της Πόλης",
			desc:  "Ομαδική έκθεση φωτογραφίας δρόμου. 50 φωτογράφοι αποτυπώνουν την καθημερινότητα των ελληνικών πόλεων.",
			venue: "Μουσείο Μπενάκη", addr: sp("Κουμπάρη 1"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.976), lng: fp(23.740),
			start: f("2026-05-05T10:00:00Z"), end: f("2026-06-05T20:00:00Z"), capacity: 1000, catID: artID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a04D", name: "Γενική Είσοδος", price: 8.00, quantity: 1000, available: 1000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E02F", title: "Φεστιβάλ Χορού Καλαμάτας",
			desc:  "Διεθνές φεστιβάλ σύγχρονου χορού. Παραστάσεις από ομάδες της Ελλάδας, Γαλλίας, Ιαπωνίας και ΗΠΑ.",
			venue: "Δημοτικό Θέατρο Καλαμάτας", addr: sp("Αριστομένους 34"), city: "Καλαμάτα", country: sp("Ελλάδα"), lat: fp(37.039), lng: fp(22.113),
			start: f("2026-08-25T20:00:00Z"), end: f("2026-08-29T23:00:00Z"), capacity: 1500, catID: artID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a04E", name: "Ημερήσιο", price: 12.00, quantity: 1000, available: 1000},
				{id: "00000000-0000-0000-0000-00000000a04F", name: "Πενθήμερο", price: 40.00, quantity: 500, available: 500},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E030", title: "Biennale Νέων Καλλιτεχνών Ευρώπης",
			desc:  "Η σημαντικότερη έκθεση νέων καλλιτεχνών από 30 ευρωπαϊκές χώρες. Επιμέλεια: Συραγώ Τσιάρα.",
			venue: "Κρατικό Μουσείο Σύγχρονης Τέχνης", addr: sp("Κολοκοτρώνη 25"), city: "Θεσσαλονίκη", country: sp("Ελλάδα"), lat: fp(40.625), lng: fp(22.948),
			start: f("2026-10-15T11:00:00Z"), end: f("2026-12-15T19:00:00Z"), capacity: 0, catID: artID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a050", name: "Γενική Είσοδος", price: 10.00, quantity: 0, available: 0},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E031", title: "Συναυλία Κλασικής Μουσικής — Μέγαρο Μουσικής",
			desc:  "Η Κρατική Ορχήστρα Αθηνών ερμηνεύει Μπετόβεν και Σοστακόβιτς. Διεύθυνση: Λουκάς Καρυτινός.",
			venue: "Μέγαρο Μουσικής Αθηνών — Αίθουσα Χ. Λαμπράκη", addr: sp("Λεωφ. Βασιλίσσης Σοφίας 69"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.980), lng: fp(23.753),
			start: f("2026-12-12T20:00:00Z"), end: f("2026-12-12T22:30:00Z"), capacity: 2000, catID: artID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a051", name: "Ζώνη Α", price: 40.00, quantity: 1000, available: 1000},
				{id: "00000000-0000-0000-0000-00000000a052", name: "Ζώνη Β", price: 25.00, quantity: 1000, available: 1000},
			},
		},
		{
			id: "00000000-0000-0000-0000-00000000E032", title: "Παράσταση Καραγκιόζη — Παραδοσιακό Θέατρο Σκιών",
			desc:  "Ο θρυλικός Καραγκιόζης του Ευγένιου Σπαθάρη ζωντανεύει για μικρούς και μεγάλους. Μια βραδιά με γέλια και παραδόσεις.",
			venue: "Θέατρο Σκιών Σπαθάρη", addr: sp("Πλάκα, Τριπόδων 22"), city: "Αθήνα", country: sp("Ελλάδα"), lat: fp(37.972), lng: fp(23.728),
			start: f("2026-08-15T19:00:00Z"), end: f("2026-08-15T21:00:00Z"), capacity: 200, catID: artID,
			tickets: []ticketSeed{
				{id: "00000000-0000-0000-0000-00000000a053", name: "Γενική Είσοδος", price: 8.00, quantity: 150, available: 150},
				{id: "00000000-0000-0000-0000-00000000a054", name: "Παιδικό", price: 5.00, quantity: 50, available: 50},
			},
		},
	}

	type eventCat struct {
		EventID    uuid.UUID `gorm:"column:event_id"`
		CategoryID uuid.UUID `gorm:"column:category_id"`
	}

	// EventType is the DTD's own field, separate from Category. Seed data
	// derives it from the event's category so exports carry a sensible value.
	eventTypeByCategory := map[string]string{
		"00000000-0000-0000-0000-000000000101": "concert",
		"00000000-0000-0000-0000-000000000102": "performance",
		"00000000-0000-0000-0000-000000000103": "match",
		"00000000-0000-0000-0000-000000000104": "conference",
		"00000000-0000-0000-0000-000000000105": "workshop",
		"00000000-0000-0000-0000-000000000106": "exhibition",
	}

	now := time.Now().UTC()
	for _, es := range events {
		eID := mustUUID(es.id)
		var existing postgres.EventModel
		err := d.Where("id = ?", eID).First(&existing).Error
		if err == nil {
			// Already seeded. Backfill columns added after the row was written
			// so an existing dev database picks them up without a reset.
			if strings.TrimSpace(existing.EventType) == "" {
				if uErr := d.Model(&postgres.EventModel{}).
					Where("id = ?", eID).
					Update("event_type", eventTypeFromCategory(eventTypeByCategory, es.catID)).
					Error; uErr != nil {
					panic(fmt.Errorf("backfill event_type for %s: %w", es.title, uErr))
				}
			}
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			panic(err)
		}

		ev := postgres.EventModel{
			ID:           eID,
			OrganizerID:  orgID,
			Title:        es.title,
			Description:  es.desc,
			Venue:        es.venue,
			EventType:    eventTypeFromCategory(eventTypeByCategory, es.catID),
			Address:      es.addr,
			City:         es.city,
			Country:      es.country,
			Latitude:     es.lat,
			Longitude:    es.lng,
			StartAt:      es.start,
			EndAt:        es.end,
			Capacity:     es.capacity,
			Status:       "published",
			EventDetail:  []byte("{}"),
			CreatedAt:    now,
			UpdatedAt:    now,
			SearchVector: "",
		}
		if err := d.Omit("search_vector").Create(&ev).Error; err != nil {
			panic(fmt.Errorf("insert event %s: %w", es.title, err))
		}

		// Link category
		catLink := eventCat{EventID: eID, CategoryID: mustUUID(es.catID)}
		if err := d.Table("event_categories").Create(&catLink).Error; err != nil {
			panic(fmt.Errorf("link category for %s: %w", es.title, err))
		}

		// Ticket types
		for _, ts := range es.tickets {
			tt := postgres.TicketTypeModel{
				ID:        mustUUID(ts.id),
				EventID:   eID,
				Name:      ts.name,
				Price:     ts.price,
				Quantity:  ts.quantity,
				Available: ts.available,
				CreatedAt: now,
				UpdatedAt: now,
			}
			if err := d.Create(&tt).Error; err != nil {
				panic(fmt.Errorf("insert ticket %s for %s: %w", ts.name, es.title, err))
			}
		}
	}

	fmt.Println("seeded 50 events with ticket types")
}

func strPtr(s string) *string { return &s }
