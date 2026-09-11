package main

import (
	"fmt"
	"math/rand"
	"time"
)

// genEvent mirrors the hand-written eventSeed in main.go but is produced by
// combining word lists, so the catalogue reaches a realistic size (100 extra
// events) without a hundred hand-written entries. Everything is derived from a
// fixed random seed, so the ids and titles are stable across runs.
type genEvent struct {
	id       string
	title    string
	desc     string
	venue    string
	addr     string
	city     string
	lat, lng float64
	start    time.Time
	end      time.Time
	capacity int
	catID    string
	tickets  []genTicket
}

type genTicket struct {
	id       string
	name     string
	price    float64
	quantity int
}

type genCity struct {
	name     string
	lat, lng float64
	venues   []genVenue
}

type genVenue struct{ name, addr string }

var genCities = []genCity{
	{"Αθήνα", 37.984, 23.728, []genVenue{
		{"Θέατρο Badminton", "Άλσος Στρατού, Γουδή"}, {"Gazarte", "Βουτάδων 34, Γκάζι"}, {"Μέγαρο Μουσικής Αθηνών", "Βασ. Σοφίας & Κόκκαλη"},
		{"Fuzz Live Music Club", "Πειραιώς 209"}, {"Τεχνόπολη Δήμου Αθηναίων", "Πειραιώς 100"}, {"Θέατρο Παλλάς", "Βουκουρεστίου 5"},
		{"Ζάππειο Μέγαρο", "Βασ. Όλγας"}, {"Στέγη Ιδρύματος Ωνάση", "Λεωφ. Συγγρού 107"},
	}},
	{"Θεσσαλονίκη", 40.640, 22.944, []genVenue{
		{"Μέγαρο Μουσικής Θεσσαλονίκης", "25ης Μαρτίου & Παραλία"}, {"Principal Club Theater", "Ανδρέου Γεωργίου 56"},
		{"Θέατρο Δάσους", "Σέιχ Σου"}, {"ΔΕΘ – Helexpo", "Εγνατία 154"}, {"Block 33", "26ης Οκτωβρίου 33"},
	}},
	{"Πάτρα", 38.246, 21.735, []genVenue{{"Θέατρο Απόλλων", "Πλατεία Γεωργίου Α'"}, {"Αρχαίο Ωδείο Πάτρας", "Άνω Πόλη"}, {"Πάρκο Ειρήνης", "Λεωφ. Γούναρη"}}},
	{"Ηράκλειο", 35.339, 25.134, []genVenue{{"Κηποθέατρο Νίκος Καζαντζάκης", "Λεωφ. Πλαστήρα"}, {"Πολιτιστικό Συνεδριακό Κέντρο", "Λεωφ. Πλαστήρα 26"}}},
	{"Λάρισα", 39.639, 22.420, []genVenue{{"Κηποθέατρο Αλκαζάρ", "Πάρκο Αλκαζάρ"}, {"Δημοτικό Θέατρο ΟΥΗΛ", "Ταγματάρχου Βελισσαρίου 3"}}},
	{"Ιωάννινα", 39.665, 20.853, []genVenue{{"Πνευματικό Κέντρο Δήμου Ιωαννιτών", "Αγ. Μαρίνας 55"}, {"Θέατρο Φρόντζου", "Λόφος Αγ. Γεωργίου"}}},
	{"Βόλος", 39.362, 22.942, []genVenue{{"Ανοιχτό Θέατρο Βόλου", "Νέα Ιωνία"}, {"Θέατρο Παλαιάς Ηλεκτρικής", "Παπαδιαμάντη"}}},
	{"Χανιά", 35.514, 24.018, []genVenue{{"Θέατρο Ανατολικής Τάφρου", "Παλιά Πόλη"}, {"Κέντρο Αρχιτεκτονικής Μεσογείου", "Ακτή Τομπάζη"}}},
	{"Ρόδος", 36.435, 28.217, []genVenue{{"Εθνικό Θέατρο Ρόδου", "Πλατεία Ελευθερίας"}, {"Μεσαιωνική Τάφρος", "Παλιά Πόλη"}}},
}

type genTemplate struct {
	catID   string
	titles  []string
	descs   []string
	tickets [][]genTicket // price/quantity presets; ids are filled in later
	capMin  int
	capMax  int
}

var genTemplates = []genTemplate{
	{ // Μουσική
		catID: "00000000-0000-0000-0000-000000000101",
		titles: []string{
			"Μάρω Μαρκέλλου — Live", "Κωνσταντίνος Αργυρός: Summer Tour", "Παύλος Παυλίδης & B-Movies", "Νατάσσα Μποφίλιου — Χειμωνιάτικη Περιοδεία",
			"Locomondo Reggae Night", "Villagers of Ioannina City", "Μονικα — Acoustic Evening", "Θανάσης Παπακωνσταντίνου Live",
			"Jazz Under the Stars", "Βραδιά Έντεχνου με τη Λένα Πλάτωνος", "Rock Revival: Tribute to Queen", "Electronic Sunset Sessions",
			"Ρεμπέτικη Βραδιά στο Λιμάνι", "Συμφωνική Ορχήστρα: Beethoven 9", "Hip-Hop Block Party", "Indie Night: Local Heroes",
			"Blues & Bourbon", "Χορωδιακό Φεστιβάλ Άνοιξης", "Latin Fiesta Live", "Classical Piano Recital",
		},
		descs: []string{
			"Μια βραδιά γεμάτη μουσική με τους αγαπημένους σας καλλιτέχνες σε μία από τις πιο ατμοσφαιρικές σκηνές της πόλης.",
			"Live εμφάνιση με πλήρη μπάντα, νέα τραγούδια και μεγάλες επιτυχίες. Οι πόρτες ανοίγουν μία ώρα πριν την έναρξη.",
			"Συναυλία με ειδικούς καλεσμένους και ένα σκηνικό που υπόσχεται να μείνει αξέχαστο.",
		},
		tickets: [][]genTicket{
			{{name: "Γενική Είσοδος", price: 18}, {name: "VIP", price: 45}},
			{{name: "Early Bird", price: 15}, {name: "Κανονικό", price: 25}, {name: "Front Stage", price: 40}},
			{{name: "Είσοδος", price: 12}},
		},
		capMin: 400, capMax: 6000,
	},
	{ // Θέατρο
		catID: "00000000-0000-0000-0000-000000000102",
		titles: []string{
			"Ο Γλάρος — Άντον Τσέχωφ", "Ρωμαίος και Ιουλιέτα", "Το Μεγάλο μας Τσίρκο", "Περιμένοντας τον Γκοντό", "Η Δωδέκατη Νύχτα",
			"Ματωμένος Γάμος", "Ο Θείος Βάνιας", "Έξι Πρόσωπα Ζητούν Συγγραφέα", "Το Σπίτι της Μπερνάρντα Άλμπα", "Οι Δίκαιοι — Αλμπέρ Καμύ",
			"Μήδεια — Ευριπίδης", "Αντιγόνη", "Ο Επιθεωρητής", "Το Τάβλι", "Η Στρίγγλα που Έγινε Αρνάκι",
			"Δον Καμίλο", "Οι Ηλίθιοι — Comedy Night", "Stand-up: Νέες Φωνές", "Παιδική Παράσταση: Ο Μικρός Πρίγκιπας", "Χορευτική Παράσταση: Σώμα και Φως",
		},
		descs: []string{
			"Μια παράσταση που ανανεώνει το κλασικό κείμενο με σύγχρονη ματιά και δυνατό θίασο.",
			"Σκηνοθεσία της νέας γενιάς, λιτό σκηνικό και ερμηνείες που συζητιούνται. Διάρκεια περίπου δύο ώρες με διάλειμμα.",
			"Η επιτυχία της περσινής σεζόν επιστρέφει για λίγες παραστάσεις. Κατάλληλο για όλες τις ηλικίες.",
		},
		tickets: [][]genTicket{
			{{name: "Κανονικό", price: 20}, {name: "Φοιτητικό", price: 12}},
			{{name: "Πλατεία", price: 25}, {name: "Εξώστης", price: 15}},
			{{name: "Κανονικό", price: 18}, {name: "Μειωμένο", price: 10}, {name: "Ομαδικό", price: 14}},
		},
		capMin: 150, capMax: 1200,
	},
	{ // Αθλητισμός
		catID: "00000000-0000-0000-0000-000000000103",
		titles: []string{
			"Ημιμαραθώνιος Πόλης", "Τουρνουά Beach Volley", "Αγώνας Μπάσκετ: Τοπικό Ντέρμπι", "Ποδηλατικός Γύρος", "Night Run 10K",
			"Τουρνουά Τένις Ανοιχτού", "Αγώνες Κολύμβησης Ανοιχτής Θάλασσας", "Street Basketball 3x3", "Ορεινό Τρέξιμο Trail", "Ημερίδα Στίβου Νέων",
			"Τουρνουά Ποδοσφαίρου 5x5", "Yoga στο Πάρκο", "Αγώνας Χάντμπολ", "Skate Contest", "Κωπηλατικοί Αγώνες",
		},
		descs: []string{
			"Αθλητική διοργάνωση ανοιχτή σε αθλητές και θεατές, με ζώνες θέασης και βοηθητικές υπηρεσίες.",
			"Οι εγγραφές αθλητών κλείνουν μία εβδομάδα πριν. Οι θεατές εξασφαλίζουν θέση με το εισιτήριό τους.",
		},
		tickets: [][]genTicket{
			{{name: "Θεατής", price: 5}},
			{{name: "Θεατής", price: 8}, {name: "Οικογενειακό", price: 20}},
		},
		capMin: 300, capMax: 5000,
	},
	{ // Τεχνολογία
		catID: "00000000-0000-0000-0000-000000000104",
		titles: []string{
			"DevConf Greece", "AI & Data Summit", "Startup Weekend", "Cloud Native Day", "Cybersecurity Forum",
			"Product Design Meetup", "Open Source Saturday", "Game Dev Jam", "Frontend Days", "Blockchain & Fintech Talks",
			"Robotics Expo", "Women in Tech Conference", "DevOps Night", "Mobile First Meetup", "Hackathon: Smart Cities",
		},
		descs: []string{
			"Ομιλίες, workshops και networking με επαγγελματίες του κλάδου. Περιλαμβάνεται καφές και ελαφρύ γεύμα.",
			"Διήμερο συνέδριο με παράλληλα tracks και hands-on εργαστήρια. Περιορισμένες θέσεις.",
		},
		tickets: [][]genTicket{
			{{name: "Standard", price: 30}, {name: "Student", price: 10}},
			{{name: "Early Bird", price: 25}, {name: "Regular", price: 45}, {name: "Team (x4)", price: 140}},
		},
		capMin: 100, capMax: 900,
	},
	{ // Εκπαίδευση
		catID: "00000000-0000-0000-0000-000000000105",
		titles: []string{
			"Σεμινάριο Δημιουργικής Γραφής", "Εργαστήριο Φωτογραφίας Δρόμου", "Μαθήματα Κεραμικής για Αρχάριους", "Ημερίδα Επαγγελματικού Προσανατολισμού",
			"Workshop Δημόσιας Ομιλίας", "Σεμινάριο Οικονομικής Παιδείας", "Εργαστήριο Κώδικα για Παιδιά", "Μάθημα Ελληνικής Μαγειρικής",
			"Διάλεξη: Ιστορία της Πόλης", "Σχολή Γονέων", "Σεμινάριο Πρώτων Βοηθειών", "Εργαστήριο Κηπουρικής", "Ημερίδα Ψηφιακού Μάρκετινγκ",
			"Εισαγωγή στη Φιλοσοφία", "Μαθήματα Σκακιού",
		},
		descs: []string{
			"Πρακτικό εργαστήριο σε μικρή ομάδα. Δεν απαιτείται προηγούμενη εμπειρία· το υλικό παρέχεται.",
			"Ημερίδα με εισηγητές από τον ακαδημαϊκό και επαγγελματικό χώρο. Χορηγείται βεβαίωση παρακολούθησης.",
		},
		tickets: [][]genTicket{
			{{name: "Συμμετοχή", price: 15}},
			{{name: "Συμμετοχή", price: 20}, {name: "Φοιτητικό", price: 8}},
		},
		capMin: 20, capMax: 200,
	},
	{ // Σινεμά
		catID: "00000000-0000-0000-0000-000000000107",
		titles: []string{
			"Θερινό Σινεμά: Κλασικές Ταινίες", "Πρεμιέρα: Το Τελευταίο Καλοκαίρι", "Βραδιά Ντοκιμαντέρ", "Cine-Concert με Ζωντανή Ορχήστρα",
			"Αφιέρωμα Θόδωρος Αγγελόπουλος", "Νύχτα Ταινιών Τρόμου", "Παιδικό Σινεμά: Animation Marathon", "Φεστιβάλ Ταινιών Μικρού Μήκους",
			"Ελληνικός Κινηματογράφος: Νέες Φωνές", "Σινεμά κάτω από τ' Άστρα", "Ρετροσπεκτίβα Nouvelle Vague", "Ταινίες Βουνού & Περιπέτειας",
			"Anime Night", "Silent Movie με Πιάνο", "Πρεμιέρα Ντοκιμαντέρ: Το Αιγαίο",
		},
		descs: []string{
			"Προβολή σε μεγάλη οθόνη με ήχο Dolby. Οι πόρτες ανοίγουν 30 λεπτά πριν την έναρξη.",
			"Θερινή προβολή σε ανοιχτό χώρο. Σε περίπτωση βροχής η προβολή μεταφέρεται στην επόμενη μέρα.",
			"Η ταινία προβάλλεται στην αυθεντική γλώσσα με ελληνικούς υπότιτλους.",
		},
		tickets: [][]genTicket{
			{{name: "Κανονικό", price: 8}, {name: "Μειωμένο", price: 6}},
			{{name: "Είσοδος", price: 7}},
		},
		capMin: 80, capMax: 400,
	},
	{ // Τέχνη
		catID: "00000000-0000-0000-0000-000000000106",
		titles: []string{
			"Έκθεση Σύγχρονης Ζωγραφικής", "Φωτογραφική Έκθεση: Πρόσωπα της Πόλης", "Γλυπτική στον Δημόσιο Χώρο", "Street Art Festival",
			"Έκθεση Χαρακτικής", "Design Week", "Αναδρομική Έκθεση Ελλήνων Χαράκτων", "Video Art Nights", "Έκθεση Κόμικς", "Κεραμική & Ύφασμα",
			"Βραδιά Ποίησης και Εικόνας", "Έκθεση Αρχιτεκτονικής", "Illustration Fair", "Art Walk στο Κέντρο", "Έκθεση Νέων Δημιουργών",
		},
		descs: []string{
			"Έργα καταξιωμένων και νέων καλλιτεχνών σε έναν χώρο που μετατρέπεται για λίγες μέρες σε ανοιχτό εργαστήρι.",
			"Ξεναγήσεις καθημερινά στις 18:00. Η είσοδος περιλαμβάνει τον κατάλογο της έκθεσης.",
		},
		tickets: [][]genTicket{
			{{name: "Είσοδος", price: 6}, {name: "Μειωμένο", price: 3}},
			{{name: "Είσοδος", price: 8}},
		},
		capMin: 80, capMax: 600,
	},
}

// generatedEvents returns 100 deterministic events spread over the next
// twelve months from `from`, cycling through the categories (with the 50
// hand-written ones that makes 150 in total).
func generatedEvents(from time.Time) []genEvent {
	rng := rand.New(rand.NewSource(20260911))
	out := make([]genEvent, 0, 100)
	used := map[string]int{}

	for i := 0; i < 100; i++ {
		tpl := genTemplates[i%len(genTemplates)]
		title := tpl.titles[rng.Intn(len(tpl.titles))]
		// The same title may recur in another city; number repeats so the
		// catalogue never shows two identical rows.
		used[title]++
		if used[title] > 1 {
			title = fmt.Sprintf("%s (%dη διοργάνωση)", title, used[title])
		}

		city := genCities[rng.Intn(len(genCities))]
		venue := city.venues[rng.Intn(len(city.venues))]

		start := from.AddDate(0, 0, 3+rng.Intn(360)).Truncate(24 * time.Hour).Add(time.Duration(17+rng.Intn(5)) * time.Hour)
		duration := time.Duration(2+rng.Intn(3)) * time.Hour
		capacity := tpl.capMin + rng.Intn(tpl.capMax-tpl.capMin+1)
		capacity -= capacity % 10

		preset := tpl.tickets[rng.Intn(len(tpl.tickets))]
		tickets := make([]genTicket, len(preset))
		remaining := capacity
		for j, t := range preset {
			qty := remaining / (len(preset) - j)
			if j == len(preset)-1 {
				qty = remaining
			}
			remaining -= qty
			tickets[j] = genTicket{
				id:       fmt.Sprintf("00000000-0000-0000-0000-0000000b%02x%02x", i, j),
				name:     t.name,
				price:    t.price,
				quantity: qty,
			}
		}

		out = append(out, genEvent{
			id:       fmt.Sprintf("00000000-0000-0000-0000-0000000f%04x", i),
			title:    title,
			desc:     tpl.descs[rng.Intn(len(tpl.descs))],
			venue:    venue.name,
			addr:     venue.addr,
			city:     city.name,
			lat:      city.lat + (rng.Float64()-0.5)*0.02,
			lng:      city.lng + (rng.Float64()-0.5)*0.02,
			start:    start,
			end:      start.Add(duration),
			capacity: capacity,
			catID:    tpl.catID,
			tickets:  tickets,
		})
	}
	return out
}
