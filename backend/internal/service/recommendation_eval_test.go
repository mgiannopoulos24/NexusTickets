package service

import (
	"encoding/csv"
	"io"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"testing"
)

// TestBMFOfflineEvaluation trains the from-scratch BMF implementation on the
// dataset provided with the assignment (Kaggle "Event Recommendation Engine
// Challenge", data/event_interest.csv) and reports the hold-out RMSE. It is an
// offline evaluation used to document the algorithm's behaviour in the report —
// the live application trains BMF on its own DB interactions instead.
//
// It skips automatically when the dataset is not present (e.g. in CI), so it
// never blocks the normal test run. To run it:
//
//	go test ./internal/service/ -run TestBMFOfflineEvaluation -v
//
// The dataset defaults to <repo>/data; RECOMMENDATION_DATA_DIR overrides it
// with a path relative to this package (internal/service).
func TestBMFOfflineEvaluation(t *testing.T) {
	dir := os.Getenv("RECOMMENDATION_DATA_DIR")
	if dir == "" {
		dir = filepath.Join("..", "..", "..", "data")
	}
	path := filepath.Join(dir, "event_interest.csv")

	f, err := os.Open(path)
	if err != nil {
		t.Skipf("dataset not available (%s); skipping offline evaluation", path)
	}
	defer func() { _ = f.Close() }()

	type rawRating struct {
		user, event int
		value       float64
	}

	r := csv.NewReader(f)
	if _, err := r.Read(); err != nil { // header
		t.Fatalf("read header: %v", err)
	}

	var raw []rawRating
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("read row: %v", err)
		}
		if len(rec) < 6 {
			continue
		}
		user, err1 := strconv.Atoi(rec[0])
		event, err2 := strconv.Atoi(rec[1])
		interested, _ := strconv.Atoi(rec[4])
		notInterested, _ := strconv.Atoi(rec[5])
		if err1 != nil || err2 != nil {
			continue
		}
		switch {
		case interested == 1:
			raw = append(raw, rawRating{user, event, 1.0})
		case notInterested == 1:
			raw = append(raw, rawRating{user, event, 0.0})
		}
	}

	if len(raw) < 100 {
		t.Skipf("too few labelled ratings (%d) for a meaningful evaluation", len(raw))
	}

	// 80/20 deterministic train/test split.
	userIdx := map[int]int{}
	eventIdx := map[int]int{}
	var train []Rating
	var test []rawRating
	for i, rr := range raw {
		if i%5 == 0 {
			test = append(test, rr)
			continue
		}
		ui, ok := userIdx[rr.user]
		if !ok {
			ui = len(userIdx)
			userIdx[rr.user] = ui
		}
		ei, ok := eventIdx[rr.event]
		if !ok {
			ei = len(eventIdx)
			eventIdx[rr.event] = ei
		}
		train = append(train, Rating{UserIdx: ui, ItemIdx: ei, Value: rr.value})
	}

	model := trainBMF(train, len(userIdx), len(eventIdx), bmfFactors, bmfEpochs, bmfLR, bmfReg)

	var sqErr float64
	var n int
	for _, rr := range test {
		ui, ok1 := userIdx[rr.user]
		ei, ok2 := eventIdx[rr.event]
		if !ok1 || !ok2 {
			continue // unseen user/event -> cannot evaluate factor terms
		}
		diff := rr.value - model.Predict(ui, ei)
		sqErr += diff * diff
		n++
	}
	if n == 0 {
		t.Skip("no evaluable test pairs (all users/events unseen in training)")
	}

	rmse := math.Sqrt(sqErr / float64(n))
	t.Logf("BMF offline evaluation: train=%d test=%d users=%d events=%d factors=%d -> RMSE=%.4f",
		len(train), n, len(userIdx), len(eventIdx), bmfFactors, rmse)

	if rmse > 1.0 {
		t.Errorf("RMSE %.4f is worse than predicting a constant; model likely misconfigured", rmse)
	}
}
