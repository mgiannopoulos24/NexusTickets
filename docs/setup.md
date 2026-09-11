# Local development setup

## Prerequisites

- Docker and Docker Compose (v2.24+ — the dev overlay uses `!override`)
- `make`
- [mkcert](https://github.com/FiloSottile/mkcert) for the local TLS certificate (falls back to `openssl`)
- Only for running outside Docker: Go 1.22+, Bun 1.x, Node 20+ (Vite's runtime)

## First start

```bash
cp .env.example .env          # defaults work for a local stack; change the passwords for anything else
make certs                    # writes docker/tls/local/{cert,key}.pem and frontend/localhost*.pem, trusts the mkcert CA
make dev                      # = docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Then open **https://localhost:5173**.

What happens on start:

| Service | What it does |
|---|---|
| `postgres` | PostgreSQL 16; `docker/postgres/init/10-app-user.sh` creates the `nexustickets_app` role on first init |
| `redis` | Redis 7 with `--requirepass` and AOF persistence |
| `backend` | Go API under `air` (hot reload). On start it runs `AutoMigrate`, then **creates the built-in administrator** if no admin exists (`ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_EMAIL`, default `admin` / `ChangeMe123!`), trains the recommender, and listens with TLS on `:8080` |
| `frontend` | Vite on Node (installed into the Bun image — see "Why Node" below), serving HTTPS on `:5173` with the same mkcert certificate and proxying `/api`, `/uploads`, `/health` and the WebSocket to `https://backend:8080` |

The admin account is all a fresh install has. Everything else comes from the seeder:

```bash
make seed        # docker compose ... run --rm seed   (idempotent)
```

It creates: demo `organizer` / `attendee` plus 10 more accounts in every approval state (all `ChangeMe123!`), 7 categories, **150 events** (50 hand-written + 100 generated, with ticket types), **5 photos per event** (bundled free stock images, copied into `MEDIA_STORAGE_PATH`), 14 bookings, 10 organizer/attendee messages and 5 support tickets in every status. Re-running it changes nothing.

## Ports

| Port | Service |
|---|---|
| 5173 | the app (Vite, HTTPS) |
| 8080 | backend API directly (HTTPS) — `https://localhost:8080/api/v1` |
| 5432 / 6379 | Postgres / Redis (for `psql`, tests) |

## Running the tests

```bash
make backend-short     # go test -short ./... — no database; Redis is required for the service tests
make frontend          # tsc --noEmit + vitest
make test-full         # starts Postgres/Redis, runs everything, stops them
```

The Go service tests talk to a real Redis. With the compose stack running, export its password first:

```bash
export REDIS_PASSWORD=$(grep ^REDIS_PASSWORD= .env | cut -d= -f2) REDIS_HOST=localhost
cd backend && go test -short ./...
```

## Running without Docker

```bash
# Postgres + Redis from the stack
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis

# Backend (reads ../.env; set DB_HOST=localhost REDIS_HOST=localhost)
cd backend && DB_HOST=localhost REDIS_HOST=localhost TLS_CERT_FILE=../docker/tls/local/cert.pem TLS_KEY_FILE=../docker/tls/local/key.pem go run ./cmd/server

# Frontend
cd frontend && bun install && bun run dev     # https://localhost:5173 (uses frontend/localhost*.pem)
```

## Why Vite runs on Node

`frontend/Dockerfile` installs `nodejs` into the Bun image and the dev command is
`node node_modules/vite/bin/vite.js`. Vite creates its HTTPS server with Node's
`http2` module and relies on `allowHTTP1` for the HTTP/1.1 fallback that a
WebSocket upgrade needs. Bun's `node:http2` does not implement that fallback:
under Bun the pages load (over h2) but the realtime messaging socket never
connects. Bun remains the package manager and test runner.

## Resetting

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v     # drops the volumes
make dev && make seed
```

## Troubleshooting

- **Browser warns about the certificate** — run `mkcert -install` (done by `make certs`) and restart the browser.
- **`NOAUTH Authentication required` in Go tests** — export `REDIS_PASSWORD` (see above).
- **Login returns 429** — the auth endpoints are rate limited to 5 requests/minute per IP.
- **Ports in use** — set `FRONTEND_PORT`, `APP_PORT`, `POSTGRES_EXPOSED_PORT`, `REDIS_EXPOSED_PORT` in `.env`.
