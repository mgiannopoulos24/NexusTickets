# Deployment (Docker Compose)

`docker-compose.yml` on its own is the production-shaped stack: the frontend is
built once (`bun run build`) and served as static files by nginx, which also
terminates TLS on 443 and proxies the API and the WebSocket to the Go backend.

```
browser ──https 443──▶ nginx (frontend image) ──▶ /            static SPA (dist/)
                                                ──▶ /api/v1     backend:8080 (REST + WebSocket upgrade)
                                                ──▶ /uploads    backend:8080 (event photos)
backend ──▶ postgres:5432, redis:6379
```

## Steps

```bash
cp .env.example .env
# edit .env: POSTGRES_*, REDIS_PASSWORD, JWT_SECRET, ADMIN_PASSWORD, CORS_ALLOWED_ORIGINS, APP_ENV=production
make certs                      # or drop a real certificate into docker/tls/local/{cert,key}.pem
docker compose up --build -d
```

Open `https://<host>/`. The built-in administrator is created on the first
backend start from `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_EMAIL`.

## Environment variables that matter in production

| Variable | Notes |
|---|---|
| `APP_ENV` | `production` disables `.env` auto-loading and switches the logger to JSON |
| `JWT_SECRET` | long random string; every token is invalidated when it changes |
| `ADMIN_PASSWORD` | only used on the first start; change it afterwards through the app |
| `CORS_ALLOWED_ORIGINS` | the public origin(s) of the SPA |
| `MEDIA_STORAGE_PATH` | uploads directory inside the backend container — mount a volume on it |
| `TLS_CERT_FILE` / `TLS_KEY_FILE` | the backend also speaks TLS; nginx proxies to it with `proxy_ssl_verify off` (internal network) |
| `RATE_LIMIT_MAX_REQUESTS` / `RATE_LIMIT_WINDOW` | global limiter; auth endpoints are additionally fixed at 5/min |

## TLS

`frontend/nginx.conf` listens on 443 with `/etc/nginx/ssl/{cert,key}.pem`
(mounted from `docker/tls/local`). For a public host replace those files with a
CA-issued certificate (e.g. from certbot) and restart the frontend container;
nothing else changes.

## Data

- `postgres_data` and `redis_data` are named volumes.
- Backups: `docker compose exec postgres pg_dump -U nexus nexustickets > backup.sql`.
- Schema changes are applied by GORM `AutoMigrate` at backend start (see `docs/database.md`).

## Health

- `GET /health` → `{"data":{"status":"ok"}}` (used by the compose healthchecks)
- `GET /ping` → `pong`
