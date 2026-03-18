.PHONY: dev build test lint migrate-up migrate-down seed db-reset wire

COMPOSE = docker compose -f docker-compose.yml
COMPOSE_DEV = docker compose -f docker-compose.yml -f docker-compose.dev.yml

dev:
	$(COMPOSE_DEV) up --build

build:
	$(COMPOSE) build

test:
	@cd backend && go test ./...
	@cd frontend && bun x tsc --noEmit

lint:
	@cd backend && golangci-lint run
	@cd frontend && bun run lint

migrate-up:
	@test -f backend/cmd/migrate/main.go || (echo "Missing backend/cmd/migrate (not implemented yet)"; exit 1)
	@cd backend && DB_HOST=$${DB_HOST:-localhost} DB_PORT=$${DB_PORT:-$${POSTGRES_EXPOSED_PORT:-5432}} go run ./cmd/migrate up

migrate-down:
	@test -f backend/cmd/migrate/main.go || (echo "Missing backend/cmd/migrate (not implemented yet)"; exit 1)
	@cd backend && DB_HOST=$${DB_HOST:-localhost} DB_PORT=$${DB_PORT:-$${POSTGRES_EXPOSED_PORT:-5432}} go run ./cmd/migrate down

seed:
	@$(MAKE) migrate-up

db-reset:
	@echo "This will delete local postgres/redis volumes (DATA LOSS)."
	@$(COMPOSE_DEV) down -v
	@$(COMPOSE_DEV) up -d postgres redis

wire:
	@cd backend && wire ./...

