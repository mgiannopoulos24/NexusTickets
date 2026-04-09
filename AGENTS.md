# NexusTickets — Agent Master Guide (AGENTS.md)

This document serves as the single source of truth for all agents working on the NexusTickets project. It consolidates the project's architecture, conventions, and specific implementation rules.

## 1. Stack Overview
- **Backend**: Go 1.22+ (Fiber v2, GORM, Wire, PostgreSQL 16, Redis 7, Gorilla WebSocket)
- **Frontend**: React 19, Vite 6, Bun, TypeScript 5 (strict), Tailwind CSS v4, shadcn/ui, Lucide React, React Router v7, Redux Toolkit, RTK Query
- **Auth**: JWT (Access + Refresh), Role-Based Access Control (Admin, Organizer, Attendee, Guest)
- **Realtime**: Native WebSocket API on frontend $\leftrightarrow$ Gorilla WebSocket on backend

## 2. Project Structure
```
/
├── backend/             # Go service
│   ├── cmd/server/      # Entry point
│   ├── internal/        # Private application code
│   │   ├── config/      # Env var loading & validation
│   │   ├── dto/         # Request/Response DTOs (Handler layer)
│   │   ├── domain/      # Entities, Value Objects, Sentinel Errors
│   │   ├── repository/  # Data access layer (Postgres, Redis)
│   │   ├── service/     # Business logic (includes Recommendation Engine)
│   │   ├── handler/     # REST (v1) and WebSocket handlers
│   │   ├── middleware/  # Auth, Rate limiting, CORS, Logging
│   │   └── wire/        # Dependency Injection providers
│   ├── migrations/      # SQL migration files (Up/Down)
│   └── pkg/             # Shared public packages
└── frontend/            # React application
    ├── src/
    │   ├── app/         # Redux store, root providers, hooks
    │   ├── features/    # Domain-specific slices (Auth, Events, Bookings, Organizer, Messaging, Admin)
    │   ├── components/  # Shared UI (ui/ shadcn, layout/, shared/)
    │   ├── hooks/       # Global custom hooks (useAuth, useWebSocket)
    │   ├── lib/         # API client, WS client, i18n strings, utils
    │   ├── types/       # TypeScript models, enums, WS envelopes
    │   └── routes/      # Router config & ProtectedRoute
```

## 3. Core Conventions

### Global
- **Language**: English for code/commits; Greek only for UI-facing strings.
- **IDs**: UUID v7 everywhere.
- **Time**: UTC for storage; localized on frontend.
- **API Envelope**: `{ data, error, meta }` for REST; `{ type, payload }` for WebSocket.
- **Security**: No secrets in git; input validation on all boundaries; no `any` types.

### Backend (Go)
- **Architecture**: Clean Architecture (Handler $\rightarrow$ Service $\rightarrow$ Repository).
- **Handler Rules**: Always use DTOs; never bind domain entities directly; use `fiber.NewError`.
- **Service Rules**: No HTTP framework dependencies; use repository interfaces.
- **Repository Rules**: `db.WithContext(ctx)` on every call; wrap GORM errors.
- **Error Handling**: Use sentinel errors in `domain/errors.go`.

### Frontend (React)
- **Styling**: Tailwind v4 (CSS-first); use `cn()` utility.
- **State**: Redux Toolkit for global/auth state; RTK Query for server state.
- **Typography**: Use predefined classes in `typography.css` (e.g., `comfortaa-bold`).
- **Routing**: Lazy-load all route-level components.
- **i18n**: No library; use centralized strings in `lib/i18n/*.ts`. Never hardcode Greek in JSX.

## 4. Detailed Domain Rules

### API Design
- **Path**: `/api/v1/` base. Plural nouns, kebab-case.
- **Methods**: `GET` (list/single), `POST` (create/transition), `PATCH` (partial update), `DELETE`.
- **WebSocket**: Authenticated via JWT query param; handled via Hub/Client pattern.
- **XML Export**: Streaming via `xml.Encoder`; must match assignment DTD exactly.

### Database (PostgreSQL & Redis)
- **Postgres**: UUID v7 PKs, `TIMESTAMPTZ` for dates, `ENUM` for statuses, GIN index for Greek full-text search.
- **Capacity**: Atomic decrement (`UPDATE ... WHERE available >= $1`) to prevent overbooking.
- **Redis**: Used for session JTIs, rate limiting (sliding window), unread counts, and recommendation cache.

### Recommendation Engine
- **Algorithm**: Biased Matrix Factorization (BMF) implemented from scratch.
- **Formula**: $\hat{R}(u,i) = \mu + b_u + b_i + P_u \cdot Q_i^T$.
- **Feedback**: Implicit scoring (View = 1.0, Book = 3.0+).
- **Lifecycle**: Periodic retraining (6h) via cron; atomic model swap with `sync.RWMutex`.

### i18n & Formatting
- **Greek UI**: All strings must reside in `lib/i18n/ui.ts`, `errors.ts`, or `messages.ts`.
- **Formatters**: Use `formatDate`, `formatCurrency`, etc., from `lib/utils.ts` (locale `el-GR`).

### Security & Deployment
- **Passwords**: `bcrypt` cost 12.
- **JWT**: Access (15m) and Refresh (7d) tokens; Refresh tokens stored in Redis.
- **Infrastructure**: Docker multi-stage builds (Scratch for Go, Nginx for React).
- **CORS**: Restricted to specific origins.

## 5. Requirements Mapping
- **Req 1-5**: Auth, Registration, Admin User Management.
- **Req 6-8**: Event Management, Browse, Search (Full-text Greek).
- **Req 9**: Event Detail, OpenStreetMap, Booking with atomic capacity check.
- **Req 10**: Realtime Messaging (WS), Inbox/Sent, Unread Badge, Bulk Notifications.
- **Req 11**: Guest access (Browse only).
- **Req 12**: Admin XML/JSON Export (DTD compliant).
- **Req 13**: BMF Recommendation Engine with cold-start fallback.
