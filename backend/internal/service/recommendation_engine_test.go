package service

import "testing"

func TestTrainBMF_RecoversRankingSignal(t *testing.T) {
	// user 0 likes item 0, dislikes item 1; user 1 the opposite.
	ratings := []Rating{
		{UserIdx: 0, ItemIdx: 0, Value: 3.0},
		{UserIdx: 0, ItemIdx: 1, Value: 0.0},
		{UserIdx: 1, ItemIdx: 0, Value: 0.0},
		{UserIdx: 1, ItemIdx: 1, Value: 3.0},
	}
	m := trainBMF(ratings, 2, 2, 8, 300, 0.05, 0.01)

	if got := m.Predict(0, 0); got <= m.Predict(0, 1) {
		t.Errorf("user0: pred(item0)=%v should exceed pred(item1)=%v", got, m.Predict(0, 1))
	}
	if got := m.Predict(1, 1); got <= m.Predict(1, 0) {
		t.Errorf("user1: pred(item1)=%v should exceed pred(item0)=%v", got, m.Predict(1, 0))
	}
}

func TestRankPredictions_ExcludesAndLimits(t *testing.T) {
	ratings := []Rating{
		{UserIdx: 0, ItemIdx: 0, Value: 3.0},
		{UserIdx: 0, ItemIdx: 1, Value: 1.0},
		{UserIdx: 0, ItemIdx: 2, Value: 0.0},
	}
	m := trainBMF(ratings, 1, 3, 4, 100, 0.05, 0.01)

	// exclude item 0; ask for top 1 -> should not contain the excluded item.
	ranked := rankPredictions(m, 0, map[int]bool{0: true}, 1)
	if len(ranked) != 1 {
		t.Fatalf("len(ranked) = %d, want 1", len(ranked))
	}
	if ranked[0] == 0 {
		t.Errorf("ranked should exclude item 0, got %v", ranked)
	}
}

func TestRankPredictions_UnknownUserReturnsNil(t *testing.T) {
	m := newBMFFactors(1, 2, 4)
	if got := rankPredictions(m, 5, nil, 10); got != nil {
		t.Errorf("out-of-range user should return nil, got %v", got)
	}
	if got := rankPredictions(m, -1, nil, 10); got != nil {
		t.Errorf("negative user idx should return nil, got %v", got)
	}
}

func TestPredict_UnknownIndicesFallBackToMean(t *testing.T) {
	m := newBMFFactors(2, 2, 4)
	m.Mu = 1.5
	// Index beyond the item space should not panic and stay near the mean.
	got := m.Predict(0, 99)
	if got != m.Mu+m.UserBias[0] {
		t.Errorf("Predict with unknown item = %v, want mean+userbias %v", got, m.Mu+m.UserBias[0])
	}
}
