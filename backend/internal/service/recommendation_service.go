package service

import (
	"context"
	"encoding/json"
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"sync"
	"time"

	redisv9 "github.com/redis/go-redis/v9"
)

const (
	bmfFactors      = 20
	bmfEpochs       = 30
	bmfLR           = 0.01
	bmfReg          = 0.02
	retrainInterval = 6 * time.Hour
	topN            = 100
)

type RecommendationService struct {
	mu       sync.RWMutex
	model    *BMFFactors
	popular  []PopularItem

	userIDs     []int
	userIdxMap  map[int]int
	eventIDs    []int
	eventIdxMap map[int]int

	dataDir string
	stopCh  chan struct{}
	redis   *redisv9.Client
}

type Recommendation struct {
	EventID int     `json:"event_id"`
	Score   float64 `json:"score"`
}

func NewRecommendationService(dataDir string, redisClient *redisv9.Client) *RecommendationService {
	return &RecommendationService{
		dataDir: dataDir,
		stopCh:  make(chan struct{}),
		redis:   redisClient,
	}
}

func (s *RecommendationService) StartPeriodicRetraining() {
	s.train()
	ticker := time.NewTicker(retrainInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			log.Println("recommendation: periodic retraining triggered")
			s.train()
		case <-s.stopCh:
			return
		}
	}
}

func (s *RecommendationService) Stop() {
	close(s.stopCh)
}

func (s *RecommendationService) train() {
	log.Println("recommendation: starting model training")

	start := time.Now()
	users, err := s.loadUsers()
	if err != nil {
		log.Printf("recommendation: load users: %v", err)
		return
	}
	events, err := s.loadEvents()
	if err != nil {
		log.Printf("recommendation: load events: %v", err)
		return
	}
	ratings, err := s.loadRatings(users, events)
	if err != nil {
		log.Printf("recommendation: load ratings: %v", err)
		return
	}
	popular, err := s.loadPopular()
	if err != nil {
		log.Printf("recommendation: load popular: %v", err)
		return
	}

	if len(ratings) == 0 {
		log.Println("recommendation: no ratings, skipping training")
		ratings = nil
	}

	var model *BMFFactors
	if ratings != nil {
		model = trainBMF(ratings, len(users.userIDs), len(events.eventIDs),
			bmfFactors, bmfEpochs, bmfLR, bmfReg)
	}

	s.mu.Lock()
	s.model = model
	s.popular = popular
	s.userIDs = users.userIDs
	s.userIdxMap = users.idxMap
	s.eventIDs = events.eventIDs
	s.eventIdxMap = events.idxMap
	s.mu.Unlock()

	s.flushCache()

	elapsed := time.Since(start)
	ratingInfo := "no ratings"
	if ratings != nil {
		ratingInfo = fmt.Sprintf("%d ratings", len(ratings))
	}
	log.Printf("recommendation: training done (%d users, %d events, %s) in %v",
		len(users.userIDs), len(events.eventIDs), ratingInfo, elapsed)
}

const cacheTTL = 1 * time.Hour

func (s *RecommendationService) cached(key string) []Recommendation {
	if s.redis == nil {
		return nil
	}
	data, err := s.redis.Get(context.Background(), key).Bytes()
	if err != nil {
		return nil
	}
	var out []Recommendation
	if err := json.Unmarshal(data, &out); err != nil {
		return nil
	}
	return out
}

func (s *RecommendationService) cacheAndReturn(key string, recs []Recommendation) []Recommendation {
	if s.redis == nil || len(recs) == 0 {
		return recs
	}
	data, err := json.Marshal(recs)
	if err != nil {
		return recs
	}
	if err := s.redis.Set(context.Background(), key, data, cacheTTL).Err(); err != nil {
		log.Printf("recommendation: cache set failed: %v", err)
	}
	return recs
}

func (s *RecommendationService) flushCache() {
	if s.redis == nil {
		return
	}
	iter := s.redis.Scan(context.Background(), 0, "rec:*", 0).Iterator()
	for iter.Next(context.Background()) {
		if err := s.redis.Del(context.Background(), iter.Val()).Err(); err != nil {
			log.Printf("recommendation: cache flush failed for %s: %v", iter.Val(), err)
		}
	}
}

func (s *RecommendationService) GetForUser(userID int, limit int) []Recommendation {
	cacheKey := fmt.Sprintf("rec:user:%d:%d", userID, limit)
	if cached := s.cached(cacheKey); cached != nil {
		return cached
	}

	s.mu.RLock()
	model := s.model
	userIdxMap := s.userIdxMap
	eventIdxMap := s.eventIdxMap
	popular := s.popular
	s.mu.RUnlock()

	if model == nil {
		return s.cacheAndReturn(cacheKey, s.popularToRecs(popular, limit, nil, nil))
	}

	userIdx, ok := userIdxMap[userID]
	if !ok {
		return s.cacheAndReturn(cacheKey, s.popularToRecs(popular, limit, model, eventIdxMap))
	}

	idxToEID := make(map[int]int, len(eventIdxMap))
	for eid, idx := range eventIdxMap {
		idxToEID[idx] = eid
	}

	ranked := rankPredictions(model, userIdx, nil, limit)
	out := make([]Recommendation, len(ranked))
	for i, idx := range ranked {
		if eid, ok := idxToEID[idx]; ok {
			out[i] = Recommendation{
				EventID: eid,
				Score:   model.Predict(userIdx, idx),
			}
		}
	}
	return s.cacheAndReturn(cacheKey, out)
}

func (s *RecommendationService) GetPopular(limit int) []Recommendation {
	cacheKey := fmt.Sprintf("rec:popular:%d", limit)
	if cached := s.cached(cacheKey); cached != nil {
		return cached
	}

	s.mu.RLock()
	model := s.model
	popular := s.popular
	eventIdxMap := s.eventIdxMap
	s.mu.RUnlock()
	return s.cacheAndReturn(cacheKey, s.popularToRecs(popular, limit, model, eventIdxMap))
}

func (s *RecommendationService) GetStatus() map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()

	m := map[string]any{
		"model_loaded": s.model != nil,
		"num_users":    len(s.userIDs),
		"num_events":   len(s.eventIDs),
		"num_popular":  len(s.popular),
	}
	if s.model != nil {
		m["num_factors"] = len(s.model.UserFac[0])
		m["global_mean"] = s.model.Mu
	}
	return m
}

func (s *RecommendationService) popularToRecs(popular []PopularItem, limit int, model *BMFFactors, eventIdxMap map[int]int) []Recommendation {
	if len(popular) == 0 {
		return nil
	}
	if limit <= 0 {
		limit = len(popular)
	}
	if limit > len(popular) {
		limit = len(popular)
	}
	out := make([]Recommendation, limit)
	for i, p := range popular[:limit] {
		score := 0.0
		if model != nil {
			if idx, ok := eventIdxMap[p.ItemID]; ok {
				score = model.Mu + model.ItemBias[idx]
			}
		}
		out[i] = Recommendation{
			EventID: p.ItemID,
			Score:   score,
		}
	}
	return out
}

func (s *RecommendationService) EventIDs() []int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]int, len(s.eventIDs))
	copy(out, s.eventIDs)
	return out
}

func (s *RecommendationService) UserIDs() []int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]int, len(s.userIDs))
	copy(out, s.userIDs)
	return out
}

// --- CSV loading ---

type userData struct {
	userIDs []int
	idxMap  map[int]int
}

type eventData struct {
	eventIDs []int
	idxMap   map[int]int
}

func (s *RecommendationService) loadUsers() (*userData, error) {
	f, err := os.Open(filepath.Join(s.dataDir, "users.csv"))
	if err != nil {
		return nil, fmt.Errorf("open users.csv: %w", err)
	}
	defer f.Close()

	r := csv.NewReader(f)
	if _, err := r.Read(); err != nil {
		return nil, fmt.Errorf("users.csv header: %w", err)
	}

	var userIDs []int
	idxMap := make(map[int]int)
	var idx int
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("users.csv row: %w", err)
		}
		uid, err := strconv.Atoi(rec[0])
		if err != nil {
			continue
		}
		userIDs = append(userIDs, uid)
		idxMap[uid] = idx
		idx++
	}
	return &userData{userIDs: userIDs, idxMap: idxMap}, nil
}

func (s *RecommendationService) loadEvents() (*eventData, error) {
	f, err := os.Open(filepath.Join(s.dataDir, "events.csv"))
	if err != nil {
		return nil, fmt.Errorf("open events.csv: %w", err)
	}
	defer f.Close()

	r := csv.NewReader(f)
	if _, err := r.Read(); err != nil {
		return nil, fmt.Errorf("events.csv header: %w", err)
	}

	var eventIDs []int
	idxMap := make(map[int]int)
	var idx int
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("events.csv row: %w", err)
		}
		eid, err := strconv.Atoi(rec[0])
		if err != nil {
			continue
		}
		eventIDs = append(eventIDs, eid)
		idxMap[eid] = idx
		idx++
	}
	return &eventData{eventIDs: eventIDs, idxMap: idxMap}, nil
}

func (s *RecommendationService) loadRatings(users *userData, events *eventData) ([]Rating, error) {
	f, err := os.Open(filepath.Join(s.dataDir, "event_interest.csv"))
	if err != nil {
		return nil, fmt.Errorf("open event_interest.csv: %w", err)
	}
	defer f.Close()

	r := csv.NewReader(f)
	if _, err := r.Read(); err != nil {
		return nil, fmt.Errorf("event_interest.csv header: %w", err)
	}

	var ratings []Rating
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("event_interest.csv row: %w", err)
		}
		if len(rec) < 6 {
			continue
		}

		userID, err := strconv.Atoi(rec[0])
		if err != nil {
			continue
		}
		eventID, err := strconv.Atoi(rec[1])
		if err != nil {
			continue
		}
		interested, err := strconv.Atoi(rec[4])
		if err != nil {
			continue
		}
		notInterested, err := strconv.Atoi(rec[5])
		if err != nil {
			continue
		}

		userIdx, ok := users.idxMap[userID]
		if !ok {
			continue
		}
		eventIdx, ok := events.idxMap[eventID]
		if !ok {
			continue
		}

		var value float64
		switch {
		case interested == 1:
			value = 1.0
		case notInterested == 1:
			value = 0.0
		default:
			continue
		}

		ratings = append(ratings, Rating{UserIdx: userIdx, ItemIdx: eventIdx, Value: value})
	}
	return ratings, nil
}

func (s *RecommendationService) loadPopular() ([]PopularItem, error) {
	f, err := os.Open(filepath.Join(s.dataDir, "event_attendees.csv"))
	if err != nil {
		return nil, fmt.Errorf("open event_attendees.csv: %w", err)
	}
	defer f.Close()

	r := csv.NewReader(f)
	if _, err := r.Read(); err != nil {
		return nil, fmt.Errorf("event_attendees.csv header: %w", err)
	}

	counts := make(map[int]int)
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("event_attendees.csv row: %w", err)
		}
		if len(rec) < 3 {
			continue
		}
		eventID, err := strconv.Atoi(rec[1])
		if err != nil {
			continue
		}
		if rec[2] == "yes" {
			counts[eventID]++
		}
	}

	popular := make([]PopularItem, 0, len(counts))
	for id, c := range counts {
		popular = append(popular, PopularItem{ItemID: id, Score: c})
	}
	sort.Slice(popular, func(i, j int) bool {
		return popular[i].Score > popular[j].Score
	})
	if len(popular) > topN {
		popular = popular[:topN]
	}
	return popular, nil
}
