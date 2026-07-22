# Recommendation Engine (Requirement 13)

NexusTickets recommends **real events** to each user with a **Biased Matrix
Factorization (BMF)** model implemented from scratch (no ML libraries).

## Model

For a user `u` and event `i` the predicted preference is:

```
R̂(u,i) = μ + b_u + b_i + Pᵤ · Qᵢᵀ
```

- `μ` — global mean of the observed ratings
- `b_u`, `b_i` — user and item biases
- `Pᵤ`, `Qᵢ` — latent factor vectors (K = 20)

Parameters are learned with SGD (`epochs = 30`, `lr = 0.01`, `λ = 0.02`).
The implementation lives in `internal/service/recommendation_engine.go`
(`trainBMF`, `BMFFactors.Predict`).

## Training data — the live application

The model is trained on the application's **own interaction matrix**, built from
real DB rows keyed by real UUIDs, so every recommended item is an actual event:

| Signal                         | Source table        | Weight |
| ------------------------------ | ------------------- | ------ |
| Confirmed booking (strong)     | `bookings`          | 3.0    |
| Event detail view (weak)       | `user_event_views`  | 1.0    |

The strongest signal for a `(user, event)` pair wins. Training runs once at
startup and then every 6 hours (`RecommendationService.StartPeriodicRetraining`),
swapping the model in atomically under an `sync.RWMutex`.

### Serving

`GET /api/v1/events/recommended` (optional JWT) returns hydrated `Event` objects:

1. Take a pool of published events (`ListPublic`).
2. Drop events the user has already booked.
3. Rank the rest by the BMF score predicted for the user.
4. **Cold start** — a guest, an untrained model, or a user with no history —
   falls back to the popularity order (most confirmed bookings first). This
   matches the requirement that users with no booking history are served from
   what they have viewed / what is popular.

## The provided dataset — offline evaluation

The assignment ships a dataset (Kaggle *Event Recommendation Engine Challenge*,
`data/*.csv`). Its integer IDs do not correspond to real application events, so
it is **not** used in the live path. Instead it is used to **evaluate** the BMF
implementation offline for the report:

```bash
cd backend
RECOMMENDATION_DATA_DIR=../data go test ./internal/service/ \
    -run TestBMFOfflineEvaluation -v
```

The test builds an implicit-feedback matrix from `event_interest.csv`
(`interested → 1.0`, `not_interested → 0.0`), does an 80/20 split, trains BMF and
reports hold-out **RMSE** (≈ 0.19). It skips automatically when the dataset is
absent, so it never blocks CI.
