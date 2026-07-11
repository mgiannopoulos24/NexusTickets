DEFAULT_GOAL := help

COMPOSE      := docker compose -f docker-compose.yml
COMPOSE_DEV  := $(COMPOSE) -f docker-compose.dev.yml
DB_HOST     ?= localhost
DB_PORT     ?= 5432
GO           := cd backend && go
BUN          := cd frontend && bun

.PHONY: help dev build test test-full test-short lint backend backend-short frontend db-reset seed certs wire

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

dev: ## Start full dev environment (Docker Compose)
	$(COMPOSE_DEV) up --build

build: ## Build production images
	$(COMPOSE) build

backend: ## Run backend tests (requires DB)
	$(GO) test ./... -count=1

backend-short: ## Run backend tests without DB
	$(GO) test -short ./... -count=1

frontend: ## TypeScript check + tests
	$(BUN) x tsc --noEmit
	$(BUN) run test

test: ## Run all tests (prompts for DB)
	@read -p "Run with DB? [y/N] " ans; \
	if [ "$$ans" = "y" ] || [ "$$ans" = "Y" ]; then \
		$(MAKE) test-full; \
	else \
		$(MAKE) test-short; \
	fi

test-full: ## Start DB, run all tests, stop DB
	@echo "Starting postgres and redis..."
	$(COMPOSE_DEV) up -d postgres redis
	@echo "Waiting for postgres..."
	@for i in $$(seq 1 30); do \
		if $(COMPOSE_DEV) exec -T postgres pg_isready -q 2>/dev/null; then \
			echo "postgres ready"; \
			break; \
		fi; \
		if [ "$$i" = "30" ]; then \
			echo "postgres did not start in time"; \
			exit 1; \
		fi; \
		sleep 1; \
	done
	$(MAKE) backend
	$(MAKE) frontend
	@echo "Stopping DB services..."
	$(COMPOSE_DEV) stop postgres redis

test-short: backend-short frontend ## Run all tests without DB

lint: ## Run linters
	@cd backend && golangci-lint run
	@cd frontend && bun run lint

db-reset: ## Delete postgres/redis volumes and recreate
	@echo "This will delete local postgres/redis volumes (DATA LOSS)."
	$(COMPOSE_DEV) down -v
	$(COMPOSE_DEV) up -d postgres redis

wire: ## Regenerate Wire DI
	@cd backend && which wire >/dev/null 2>&1 || (echo "wire not installed: go install github.com/google/wire/cmd/wire@latest"; exit 1)
	@cd backend && wire ./...

seed: ## Seed the database with demo data (requires running DB)
	$(COMPOSE_DEV) run --rm seed

certs: ## Generate local TLS certificates via mkcert
	@scripts/setup-certs.sh
