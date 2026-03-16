---
description: Biased Matrix Factorization recommendation engine implementation rules
globs: ["backend/internal/service/recommendation/**/*.go"]
alwaysApply: false
---

# Recommendation Engine — Biased Matrix Factorization

## Algorithm Overview
Biased MF decomposes the user-item interaction matrix R into:
```
R̂(u,i) = μ + b_u + b_i + P_u · Q_i^T
```
Where:
- `μ` = global average rating/score
- `b_u` = user bias
- `b_i` = item (event) bias  
- `P_u` = user latent factor vector (K dimensions)
- `Q_i` = item latent factor vector (K dimensions)

## Package Structure
```
service/recommendation/
  model.go          # BMF model struct, hyperparameters
  train.go          # SGD training loop
  predict.go        # inference, top-N retrieval
  dataset.go        # data loading from DB + preprocessing
  coldstart.go      # fallback for users with no history
  scheduler.go      # periodic retraining cron
```

## Hyperparameters (configurable via env)
```go
type HyperParams struct {
    K           int     // latent dimensions: default 20
    LearningRate float64 // default 0.005
    Lambda      float64 // L2 regularization: default 0.02
    Epochs      int     // default 50
    MinScore    float64 // minimum implicit score: 1.0
    MaxScore    float64 // maximum implicit score: 5.0
}
```

## Implicit Feedback Encoding
Since we have bookings (not explicit ratings), encode implicit signals:
```go
// Scoring heuristic — tune as needed
func scoreInteraction(booked bool, viewed bool, bookingCount int) float64 {
    score := 0.0
    if viewed  { score += 1.0 }
    if booked  { score += 3.0 + float64(bookingCount)*0.5 }
    return math.Min(score, 5.0) // cap at 5
}
```

## Training Loop (SGD)
```go
func (m *BMFModel) Train(interactions []Interaction) {
    for epoch := 0; epoch < m.params.Epochs; epoch++ {
        shuffle(interactions)
        for _, r := range interactions {
            predicted := m.predict(r.UserIdx, r.ItemIdx)
            err := r.Score - predicted

            // Update biases
            m.userBias[r.UserIdx] += m.params.LearningRate *
                (err - m.params.Lambda*m.userBias[r.UserIdx])
            m.itemBias[r.ItemIdx] += m.params.LearningRate *
                (err - m.params.Lambda*m.itemBias[r.ItemIdx])

            // Update latent factors
            for k := 0; k < m.params.K; k++ {
                pu := m.P[r.UserIdx][k]
                qi := m.Q[r.ItemIdx][k]
                m.P[r.UserIdx][k] += m.params.LearningRate *
                    (err*qi - m.params.Lambda*pu)
                m.Q[r.ItemIdx][k] += m.params.LearningRate *
                    (err*pu - m.params.Lambda*qi)
            }
        }
    }
}
```

## Cold-Start Fallback
```go
// Users with no history: recommend by item popularity + recency
func (s *RecommendationService) ColdStart(ctx context.Context, limit int) ([]uuid.UUID, error) {
    // Score = booking_count * 0.7 + recency_weight * 0.3
    // Only published, future events
}
```

## Inference API
```go
// Returns top-N event IDs for a user
func (s *RecommendationService) Recommend(ctx context.Context, userID uuid.UUID, n int) ([]uuid.UUID, error) {
    // 1. Check Redis cache — TTL 1h
    // 2. If cache miss → run model.TopN(userIdx, n, alreadyBooked)
    // 3. Filter to only published + future events
    // 4. Cache result
    // 5. Return IDs → handler fetches full event objects
}
```

## Retraining Schedule
- Retrain every 6 hours via cron
- Use read replica for training queries (don't hammer primary)
- Store trained model in memory; swap atomically with `sync.RWMutex`
- Log training RMSE per epoch at DEBUG level; log final RMSE at INFO level

## Integration with Handler
```go
// GET /api/v1/events/recommended
func (h *EventHandler) GetRecommended(c *fiber.Ctx) error {
    claims := c.Locals("user").(*jwt.Claims)
    ids, err := h.recService.Recommend(c.Context(), uuid.MustParse(claims.UserID), 10)
    if err != nil {
        return fiber.NewError(500, "recommendation unavailable")
    }
    events, err := h.eventRepo.FindByIDs(c.Context(), ids)
    // preserve recommendation order
    return c.JSON(response.OK(events))
}
```
