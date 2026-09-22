# NexusTickets

Event management and online ticket reservation platform, developed as a mandatory assignment for the course "Internet Application Technologies" (6th semester), Department of Informatics and Telecommunications.

---

## Authors

**Marios Giannopoulos**  
Department of Informatics and Telecommunications

**Ramantan Konomi**  
Department of Informatics and Telecommunications

---

## Overview

NexusTickets is a full-stack web application that allows organizers to create and manage events, attendees to browse and book tickets, and administrators to oversee the platform. The system is built on a client-server architecture and accessible entirely through the browser.

The platform supports four distinct roles: Administrator, Organizer, Attendee, and Guest. Access to functionality is determined at the API level via JWT-based authentication and role-based authorization.

---

## Technology Stack

### Backend
- **Language**: Go 1.22+
- **HTTP Framework**: Fiber v2
- **ORM**: GORM with PostgreSQL driver
- **Dependency Injection**: Wire (compile-time)
- **Authentication**: JWT (access + refresh token pair)
- **Structured Logging**: Zap

### Database
- **Primary Store**: PostgreSQL 16
- **Cache / Session Store**: Redis 7

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite 8+
- **Package Manager / Runtime**: Bun
- **Language**: TypeScript 5+ (strict mode)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix primitives + Tailwind)
- **Icons**: Lucide React
- **i18n**: Greek / English, YAML locale files (`src/locales`), no library
- **Routing**: React Router v7
- **State Management**: Redux Toolkit + RTK Query
- **Forms**: React Hook Form + Zod

---

## Repository Structure

```
nexustickets/
├── backend/
│   ├── cmd/server/          # Application entry point
│   ├── internal/
│   │   ├── config/          # Environment configuration
│   │   ├── domain/          # Entities, value objects, domain errors
│   │   ├── repository/      # GORM implementations and interfaces
│   │   ├── service/         # Business logic
│   │   ├── handler/         # Fiber HTTP handlers (v1)
│   │   ├── middleware/       # Auth, rate limiting, logging, CORS
│   │   ├── dto/             # Request and response structs
│   │   └── wire/            # Dependency injection providers
│   └── pkg/                 # Shared utilities (response helpers, pagination, UUID)
├── frontend/
│   ├── src/
│   │   ├── app/             # Redux store, typed hooks
│   │   ├── components/      # Shared UI components, shadcn/ui primitives, layout
│   │   ├── contexts/        # Auth and language providers
│   │   ├── hooks/           # Shared custom hooks
│   │   ├── lib/             # i18n lookup, formatters, utilities
│   │   ├── locales/         # UI strings: gr.yaml, en.yaml
│   │   ├── types/           # Global TypeScript types and models
│   │   ├── routes/          # React Router configuration, ProtectedRoute
│   │   ├── pages/           # Page components, grouped by area
│   │   └── utils/           # API client (api.ts) and WebSocket client (wsClient.ts)
│   └── ...
├── docs/                    # Technical documentation
├── report/                  # Academic report (PDF)
├── docker-compose.yml
├── docker-compose.dev.yml
├── Makefile
├── .env.example
├── README.md
├── README.el.md
└── TODO.md
```

---

## Documentation

All technical documentation is located in the `./docs/` directory:

| File | Contents |
|------|----------|
| `docs/setup.md` | Local development setup guide |
| `docs/deployment.md` | Production deployment with Docker Compose |
| `docs/api.md` | Full REST API reference |
| `docs/database.md` | Entity-relationship diagram and migration guide |
| `docs/architecture.md` | System architecture overview |
| `docs/recommendation.md` | Biased Matrix Factorization implementation details |
| `docs/events-catalog.dtd` | The assignment's DTD; the XML export validates against it |

---

## Academic Report

The project report is located in the `./report/` directory.

It covers the architecture decisions, database design, implementation details for both backend and frontend, the recommendation engine algorithm, testing strategy, and a development retrospective.

---

## Local Development Setup

### Prerequisites

- Docker and Docker Compose
- Go 1.22+
- Bun 1.x
- Make

### Prerequisites

- [mkcert](https://github.com/FiloSottile/mkcert) (for local TLS certs)

### Quick Start (Development — Hot Reload)

```bash
# 1. Copy environment template and fill in values
cp .env.example .env

# 2. Generate local TLS certificates
make certs

# 3. Start all services (PostgreSQL, Redis, backend, frontend)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

The app is served at `https://localhost:5173` (Vite terminates TLS with the mkcert cert and proxies `/api`, `/uploads` and the WebSocket to the backend).  
The backend API is also reachable directly at `https://localhost:8080/api/v1`.

### Production-Like Stack (Built SPA behind nginx)

To run the **built** frontend behind nginx with TLS (same layout as production):

```bash
cp .env.example .env
make certs
docker compose up --build
```

Then open `https://localhost`.

### Seeding the Database

The first time you start the stack, the database is empty. Run the seed command inside the `backend` container (or from the host while the stack is up):

```bash
# From the host while the stack is running (connects to postgres via Docker network):
cd backend && go run ./cmd/seed

# Or start a standalone seed container by building just the seed binary.
```

The built-in administrator is created automatically on the first backend start (`ADMIN_USERNAME` / `ADMIN_PASSWORD`, default `admin` / `ChangeMe123!`). The seeder adds the demo `organizer` / `attendee` and ten more accounts (same password), 7 categories, 150 events with ticket types and 5 photos each, plus sample bookings, messages and support tickets, and fills each event's public "Organizer" tab from its organizer's profile (name, city, e-mail); run it with `make seed`.

### Running Without Docker

```bash
# Backend
cd backend
go run ./cmd/server

# Frontend (separate terminal)
cd frontend
bun install
bun run dev
```

### Resetting the Database

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis
```

---

## Available Make Targets

```
make dev            Start backend in development mode (hot reload)
make build          Build production binaries
make test           Run all backend tests
make lint           Run golangci-lint
make wire           Regenerate Wire dependency injection code
make db-reset       Delete postgres/redis volumes and recreate
make certs          Generate local TLS certificates via mkcert
```

---

## Environment Variables

All required environment variables are documented in `.env.example`. The application will fail at startup if any required variable is missing.

Key variables:

```
# Backend
APP_ENV                 development | staging | production
DATABASE_URL            PostgreSQL connection string
REDIS_URL               Redis connection string
JWT_ACCESS_SECRET       Secret for signing access tokens
JWT_REFRESH_SECRET      Secret for signing refresh tokens
ADMIN_USERNAME          Default administrator username
ADMIN_PASSWORD          Default administrator password
MEDIA_STORAGE_PATH      Directory for uploaded event photos (default: `backend/uploads/media`)
CORS_ALLOWED_ORIGINS    Comma-separated list of allowed origins

# Frontend
VITE_API_BASE_URL       Backend origin only, or empty for same-origin (e.g. http://localhost:8080). The app calls `/api/v1/...` on that origin.
```

---

## API Overview

All endpoints are prefixed with `/api/v1/`. Authentication uses Bearer tokens passed in the `Authorization` header.

Public endpoints (no authentication required):

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
GET    /api/v1/events
GET    /api/v1/events/:id
```

All other endpoints require a valid JWT and appropriate role. Refer to `docs/api.md` for the complete route map.

---

## Roles and Permissions

| Capability | Guest | Attendee | Organizer | Admin |
|---|---|---|---|---|
| Browse and search events | Yes | Yes | Yes | Yes |
| View event details | Yes | Yes | Yes | Yes |
| Book tickets | No | Yes | Yes | No |
| Create and manage events | No | No | Yes | No |
| View own bookings | No | Yes | Yes | No |
| Send and receive messages | No | Yes | Yes | No |
| Approve / reject users | No | No | No | Yes |
| Export events (XML / JSON) | No | No | No | Yes |

---

## Key Features

**Event management**: Organizers create events with multiple ticket types, capacity enforcement, categories, geolocation, and optional photo galleries. Events follow a lifecycle: Draft, Published, Completed, Cancelled.

**Booking system**: Atomic capacity decrement prevents overbooking under concurrent requests. Bookings are confirmed immediately upon submission and cannot be reversed by the attendee.

**Messaging**: Organizers and attendees communicate through an inbox/sent messaging system. Event cancellation triggers bulk notifications to all registered attendees.

**Recommendation engine**: Authenticated users receive personalized event suggestions based on their booking history and browsing behavior, powered by a Biased Matrix Factorization model trained periodically on platform data. New users receive popularity-based recommendations.

**Admin tools**: The administrator manages user registrations (approve or reject) and can export the full event catalogue in XML or JSON format conforming to the assignment DTD.

**Map integration**: Event detail pages display an interactive OpenStreetMap with a marker at the event location.

---

## Testing

```bash
# Backend unit and integration tests
cd backend && go test ./...

# Frontend unit tests
cd frontend && bun run test

# End-to-end tests
cd frontend && bun run e2e
```