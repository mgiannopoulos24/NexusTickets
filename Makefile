.PHONY: dev build test lint migrate-up migrate-down seed wire

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
	@cd backend && go run ./cmd/migrate up

migrate-down:
	@test -f backend/cmd/migrate/main.go || (echo "Missing backend/cmd/migrate (not implemented yet)"; exit 1)
	@cd backend && go run ./cmd/migrate down

seed:
	@test -f backend/cmd/seed/main.go || (echo "Missing backend/cmd/seed (not implemented yet)"; exit 1)
	@cd backend && go run ./cmd/seed

wire:
	@cd backend && wire ./...

