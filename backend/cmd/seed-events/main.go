package main

import (
	"errors"
	"flag"
	"fmt"
	"math/rand/v2"
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
	var n int
	flag.IntVar(&n, "n", 50, "number of random events to insert")
	flag.Parse()

	if n <= 0 {
		fmt.Fprintln(os.Stderr, "-n must be > 0")
		os.Exit(2)
	}

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

	organizerID, err := ensureSeedOrganizer(pg.Gorm)
	if err != nil {
		log.Fatal("ensure organizer failed", zap.Error(err))
	}

	events := make([]postgres.EventModel, 0, n)
	now := time.Now().UTC()

	for i := 0; i < n; i++ {
		start := now.Add(time.Duration(rand.IntN(120*24)) * time.Hour) // within ~120 days
		// Random duration between 2 and 6 hours.
		end := start.Add(time.Duration(2+rand.IntN(5)) * time.Hour)

		city := randomCity()
		venue := randomVenue()
		title := randomTitle()

		e := postgres.EventModel{
			ID:              uuid.New(),
			OrganizerID:      organizerID,
			Title:           title,
			Description:     randomDescription(title),
			Venue:           venue,
			Address:         nil,
			City:            city,
			Country:         ptr("Ελλάδα"),
			Latitude:        nil,
			Longitude:       nil,
			StartAt:         start,
			EndAt:           end,
			Capacity:        50 + rand.IntN(900),
			Status:          "published",
			SearchVector:    "",
			CreatedAt:       now,
			UpdatedAt:       now,
			FeaturedImageURL: nil,
		}
		events = append(events, e)
	}

	if err := pg.Gorm.Omit("search_vector").Create(&events).Error; err != nil {
		log.Fatal("insert events failed", zap.Error(err))
	}
	log.Info("seeded random events", zap.Int("count", len(events)))
}

func ensureSeedOrganizer(db *gorm.DB) (uuid.UUID, error) {
	const username = "seed_organizer"

	var existing postgres.UserModel
	err := db.First(&existing, "username = ?", username).Error
	if err == nil {
		return existing.ID, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return uuid.Nil, fmt.Errorf("find organizer: %w", err)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte("SeedPassword123!"), 12)
	if err != nil {
		return uuid.Nil, fmt.Errorf("hash password: %w", err)
	}

	u := postgres.UserModel{
		ID:            uuid.New(),
		Username:      username,
		Password:      string(hash),
		FirstName:     "Seed",
		LastName:      "Organizer",
		Email:         "seed_organizer@nexustickets.local",
		Phone:         nil,
		Address:       nil,
		City:          nil,
		Country:       nil,
		Latitude:      nil,
		Longitude:     nil,
		VATNumber:     nil,
		Role:          "organizer",
		AccountStatus: "approved",
		CreatedAt:     time.Now().UTC(),
		UpdatedAt:     time.Now().UTC(),
	}

	if err := db.Create(&u).Error; err != nil {
		return uuid.Nil, fmt.Errorf("create organizer: %w", err)
	}
	return u.ID, nil
}

func ptr[T any](v T) *T { return &v }

func randomCity() string {
	cities := []string{"Αθήνα", "Θεσσαλονίκη", "Πάτρα", "Ηράκλειο", "Λάρισα", "Βόλος", "Ιωάννινα"}
	return cities[rand.IntN(len(cities))]
}

func randomVenue() string {
	venues := []string{"Ζάππειο Μέγαρο", "Μέγαρο Μουσικής", "Δημοτικό Θέατρο", "Open Air Arena", "City Hall", "Cultural Hub"}
	return venues[rand.IntN(len(venues))]
}

func randomTitle() string {
	left := []string{"Νύχτα", "Φεστιβάλ", "Σκηνή", "Ρυθμός", "Απόδραση", "Εμπειρία", "Εικόνες"}
	right := []string{"στην Πόλη", "του Καλοκαιριού", "Live", "και Ήχος", "στο Κέντρο", "Weekend", "Edition"}
	return left[rand.IntN(len(left))] + " " + right[rand.IntN(len(right))]
}

func randomDescription(title string) string {
	lines := []string{
		"Μια ξεχωριστή εμπειρία με μουσική, φως και ενέργεια.",
		"Ζήσε την ατμόσφαιρα από κοντά — κράτηση εισιτηρίων διαθέσιμη.",
		"Περιορισμένος αριθμός θέσεων. Μην το χάσεις.",
	}
	return strings.TrimSpace(title + ". " + lines[rand.IntN(len(lines))])
}

