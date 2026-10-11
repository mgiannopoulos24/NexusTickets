package service

import (
	"context"
	"log"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"

	repo "nexustickets/internal/repository"
)

// BMF hyperparameters (see docs/recommendation.md). The model is trained from
// scratch on the application's own interaction matrix.
const (
	bmfFactors      = 20
	bmfEpochs       = 30
	bmfLR           = 0.01
	bmfReg          = 0.02
	retrainInterval = 6 * time.Hour
)

// Implicit-feedback weights. A confirmed booking is a much stronger signal of
// interest than merely viewing an event's detail page.
const (
	scoreView = 1.0 // user viewed the event
	scoreBook = 3.0 // user confirmed a booking for the event
)

// RecommendationService trains a Biased Matrix Factorization model over the
// real interaction matrix built from confirmed bookings (strong signal) and
// event views (weak signal). All identifiers are real DB UUIDs, so the model
// scores and returns actual events (Requirement 13).
type RecommendationService struct {
	bookings repo.BookingRepository
	views    repo.UserEventViewRepository

	mu       sync.RWMutex
	model    *BMFFactors
	userIdx  map[uuid.UUID]int // user UUID -> row index in the model
	eventIdx map[uuid.UUID]int // event UUID -> column index in the model
	eventIDs []uuid.UUID       // column index -> event UUID
	popular  []uuid.UUID       // most-booked events, best-first (cold-start)

	stopCh chan struct{}
}

func NewRecommendationService(bookings repo.BookingRepository, views repo.UserEventViewRepository) *RecommendationService {
	return &RecommendationService{
		bookings: bookings,
		views:    views,
		stopCh:   make(chan struct{}),
	}
}

// StartPeriodicRetraining trains once immediately and then re-trains every
// retrainInterval. Intended to run in its own goroutine.
func (s *RecommendationService) StartPeriodicRetraining() {
	s.Train(context.Background())
	ticker := time.NewTicker(retrainInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			log.Println("recommendation: periodic retraining triggered")
			s.Train(context.Background())
		case <-s.stopCh:
			return
		}
	}
}

func (s *RecommendationService) Stop() {
	close(s.stopCh)
}

// ratingKey identifies a (user, event) pair for deduplication.
type ratingKey struct {
	user  uuid.UUID
	event uuid.UUID
}

// Train rebuilds the model from the current DB state and atomically swaps it in.
func (s *RecommendationService) Train(ctx context.Context) {
	start := time.Now()

	bookings, err := s.bookings.ListAllConfirmed(ctx)
	if err != nil {
		log.Printf("recommendation: load confirmed bookings: %v", err)
		return
	}
	views, err := s.views.ListAll(ctx)
	if err != nil {
		log.Printf("recommendation: load views: %v", err)
		return
	}

	// Build the deduplicated implicit-feedback scores. The strongest signal for
	// a (user, event) pair wins.
	scores := make(map[ratingKey]float64)
	bookingCount := make(map[uuid.UUID]int) // event -> distinct confirmed bookers
	for _, b := range bookings {
		k := ratingKey{user: b.UserID, event: b.EventID}
		if _, seen := scores[k]; !seen {
			bookingCount[b.EventID]++
		}
		if scoreBook > scores[k] {
			scores[k] = scoreBook
		}
	}
	for _, v := range views {
		k := ratingKey{user: v.UserID, event: v.EventID}
		if scoreView > scores[k] {
			scores[k] = scoreView
		}
	}

	// Assign contiguous indices to users and events that appear in the matrix.
	userIdx := make(map[uuid.UUID]int)
	eventIdx := make(map[uuid.UUID]int)
	var eventIDs []uuid.UUID
	ratings := make([]Rating, 0, len(scores))
	for k, val := range scores {
		ui, ok := userIdx[k.user]
		if !ok {
			ui = len(userIdx)
			userIdx[k.user] = ui
		}
		ei, ok := eventIdx[k.event]
		if !ok {
			ei = len(eventIdx)
			eventIdx[k.event] = ei
			eventIDs = append(eventIDs, k.event)
		}
		ratings = append(ratings, Rating{UserIdx: ui, ItemIdx: ei, Value: val})
	}

	// Popularity ranking (cold-start fallback), most confirmed bookers first.
	popular := make([]uuid.UUID, 0, len(bookingCount))
	for id := range bookingCount {
		popular = append(popular, id)
	}
	sort.Slice(popular, func(i, j int) bool {
		if bookingCount[popular[i]] != bookingCount[popular[j]] {
			return bookingCount[popular[i]] > bookingCount[popular[j]]
		}
		return popular[i].String() < popular[j].String()
	})

	var model *BMFFactors
	if len(ratings) > 0 {
		model = trainBMF(ratings, len(userIdx), len(eventIdx), bmfFactors, bmfEpochs, bmfLR, bmfReg)
	}

	s.mu.Lock()
	s.model = model
	s.userIdx = userIdx
	s.eventIdx = eventIdx
	s.eventIDs = eventIDs
	s.popular = popular
	s.mu.Unlock()

	log.Printf("recommendation: trained (%d users, %d events, %d ratings) in %v",
		len(userIdx), len(eventIdx), len(ratings), time.Since(start))
}

// HasUser reports whether the trained model has learned latent factors for the
// given user (i.e. the user has booking/view history).
func (s *RecommendationService) HasUser(userID uuid.UUID) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.model == nil {
		return false
	}
	_, ok := s.userIdx[userID]
	return ok
}

// ScoreEvents returns the predicted BMF score for each of the given events for
// the user. Events or users unknown to the model are omitted from the result.
func (s *RecommendationService) ScoreEvents(userID uuid.UUID, eventIDs []uuid.UUID) map[uuid.UUID]float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()

	out := make(map[uuid.UUID]float64, len(eventIDs))
	if s.model == nil {
		return out
	}
	ui, ok := s.userIdx[userID]
	if !ok {
		return out
	}
	for _, eid := range eventIDs {
		if ei, ok := s.eventIdx[eid]; ok {
			out[eid] = s.model.Predict(ui, ei)
		}
	}
	return out
}

// PopularEventIDs returns the most-booked event IDs, best-first.
func (s *RecommendationService) PopularEventIDs(limit int) []uuid.UUID {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if limit <= 0 || limit > len(s.popular) {
		limit = len(s.popular)
	}
	out := make([]uuid.UUID, limit)
	copy(out, s.popular[:limit])
	return out
}

// Status exposes basic model diagnostics.
func (s *RecommendationService) Status() map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()
	m := map[string]any{
		"model_loaded": s.model != nil,
		"num_users":    len(s.userIdx),
		"num_events":   len(s.eventIdx),
		"num_popular":  len(s.popular),
	}
	if s.model != nil {
		m["num_factors"] = bmfFactors
		m["global_mean"] = s.model.Mu
	}
	return m
}
