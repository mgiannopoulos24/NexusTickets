package service

import (
	"math/rand"
	"sort"
)

type BMFFactors struct {
	Mu       float64
	UserBias []float64
	ItemBias []float64
	UserFac  [][]float64
	ItemFac  [][]float64
}

func newBMFFactors(numUsers, numItems, numFactors int) *BMFFactors {
	initVec := func(n int) []float64 {
		v := make([]float64, n)
		for i := range v {
			v[i] = (rand.Float64() - 0.5) * 0.1
		}
		return v
	}
	initMat := func(n, k int) [][]float64 {
		m := make([][]float64, n)
		for i := range m {
			m[i] = initVec(k)
		}
		return m
	}
	return &BMFFactors{
		UserBias: make([]float64, numUsers),
		ItemBias: make([]float64, numItems),
		UserFac:  initMat(numUsers, numFactors),
		ItemFac:  initMat(numItems, numFactors),
	}
}

func (m *BMFFactors) Predict(userIdx, itemIdx int) float64 {
	pred := m.Mu
	if userIdx < len(m.UserBias) {
		pred += m.UserBias[userIdx]
	}
	if itemIdx < len(m.ItemBias) {
		pred += m.ItemBias[itemIdx]
	}
	if userIdx < len(m.UserFac) && itemIdx < len(m.ItemFac) {
		uf := m.UserFac[userIdx]
		iv := m.ItemFac[itemIdx]
		for k := range uf {
			pred += uf[k] * iv[k]
		}
	}
	return pred
}

type Rating struct {
	UserIdx int
	ItemIdx int
	Value   float64
}

type scoredItem struct {
	idx   int
	score float64
}

func trainBMF(ratings []Rating, numUsers, numItems, numFactors, epochs int, lr, reg float64) *BMFFactors {
	m := newBMFFactors(numUsers, numItems, numFactors)

	var sum float64
	for _, r := range ratings {
		sum += r.Value
	}
	m.Mu = sum / float64(len(ratings))

	work := make([]Rating, len(ratings))
	copy(work, ratings)

	buf := make([]float64, numFactors)

	for range epochs {
		rand.Shuffle(len(work), func(i, j int) { work[i], work[j] = work[j], work[i] })

		for _, r := range work {
			u, i := r.UserIdx, r.ItemIdx
			pred := m.Mu + m.UserBias[u] + m.ItemBias[i]
			puf := m.UserFac[u]
			piv := m.ItemFac[i]
			for k := range puf {
				pred += puf[k] * piv[k]
			}

			err := r.Value - pred

			m.UserBias[u] += lr * (err - reg*m.UserBias[u])
			m.ItemBias[i] += lr * (err - reg*m.ItemBias[i])

			for k := range puf {
				buf[k] = puf[k]
			}
			for k := range puf {
				ufk := buf[k]
				puf[k] += lr * (err*piv[k] - reg*ufk)
				piv[k] += lr * (err*ufk - reg*piv[k])
			}
		}
	}

	return m
}

type PopularItem struct {
	ItemID int
	Score  int
}

func rankPredictions(m *BMFFactors, userIdx int, exclude map[int]bool, topN int) []int {
	if userIdx < 0 || userIdx >= len(m.UserBias) {
		return nil
	}
	candidates := make([]scoredItem, 0, len(m.ItemBias))
	for i := range m.ItemBias {
		if exclude != nil && exclude[i] {
			continue
		}
		candidates = append(candidates, scoredItem{idx: i, score: m.Predict(userIdx, i)})
	}
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].score > candidates[j].score
	})
	if len(candidates) > topN {
		candidates = candidates[:topN]
	}
	out := make([]int, len(candidates))
	for i, c := range candidates {
		out[i] = c.idx
	}
	return out
}
