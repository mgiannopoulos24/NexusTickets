# NexusTickets — Master TODO

> Legend: `[!]` = critical path item

---

## 0. Project Bootstrap

- [X] `[!]` Initialize monorepo root with `git init`
- [X] `[!]` Create root `.gitignore` (Go binaries, `dist/`, `.env*`, `uploads/`, `node_modules/`, `*.log`, `.DS_Store`)
- [X] `[!]` Create root `docker-compose.yml` with services: `postgres`, `redis`, `backend`, `frontend`
- [X] `[!]` Create root `docker-compose.dev.yml` override (hot reload, exposed ports)
- [X] Create `.env.example` with all required env vars
- [X] Create `Makefile` with targets: `dev`, `build`, `test`, `lint`, `migrate-up`, `migrate-down`, `seed`, `wire`
- [X] Set up `pre-commit` hooks: `golangci-lint`, `eslint`, `tsc --noEmit`, `gitleaks`

---

## 1. Infrastructure & DevOps

### 1.1 Docker
- [ ] `[!]` Write `backend/Dockerfile` (multi-stage, scratch final image)
- [ ] `[!]` Write `frontend/Dockerfile` (Bun builder + nginx)
- [ ] Write `nginx/nginx.conf` — reverse proxy to backend, static files for frontend
- [ ] Configure nginx TLS (self-signed dev, Let's Encrypt prod)
- [ ] Add `healthcheck` directives to all Docker services
- [ ] Add named volumes for postgres and redis data

### 1.2 Database
- [ ] `[!]` Provision PostgreSQL 16 container with persistent volume
- [ ] `[!]` Create database `nexustickets` and dedicated user
- [ ] `[!]` Provision Redis 7 container with password and `appendonly yes`

### 1.3 CI Pipeline
- [ ] Workflow: `lint.yml` — `golangci-lint` + `eslint` + `tsc` on every PR
- [ ] Workflow: `test.yml` — Go tests + frontend tests on every PR
- [ ] Workflow: `security.yml` — `govulncheck`, `gitleaks`, `trivy`

---

## 2. Backend — Foundation

### 2.1 Project Skeleton
- [ ] `[!]` `go mod init github.com/yourorg/nexustickets`
- [ ] `[!]` Add all dependencies: Fiber v2, GORM, Wire, JWT, Validator, Redis, Migrate, Zap, Testify, UUID, bcrypt, Cron
- [ ] `[!]` Create full directory structure
- [ ] `[!]` Implement `internal/config/config.go` — load + validate all env vars on startup
- [ ] `[!]` Set up structured logger (zap)
- [ ] Implement `pkg/response/response.go` — `OK`, `Created`, `Paginated`, `Error` helpers
- [ ] Implement `pkg/pagination/pagination.go`
- [ ] Implement `cmd/server/main.go` — bootstrap chain

### 2.2 Database & Migrations
- [ ] `[!]` GORM PostgreSQL connection with pool settings
- [ ] `[!]` Redis client initialization
- [ ] `[!]` Run migrations at startup before accepting traffic
- [ ] `[!]` Migrations: users, events, categories, event_categories, ticket_types, bookings, messages, event_photos, user_event_views
- [ ] Migration: seed admin user
- [ ] Migration: seed initial categories
- [ ] All indexes from database ruleset

### 2.3 Domain Layer
- [ ] `[!]` Entities: User, Event, TicketType, Booking, Message, Category, EventPhoto
- [ ] `[!]` Constants: UserRole, AccountStatus, EventStatus, BookingStatus
- [ ] `[!]` `domain/errors.go` — all sentinel errors

### 2.4 Repository Layer
- [ ] `[!]` Define all repository interfaces
- [ ] `[!]` Implement: UserRepository, EventRepository, TicketTypeRepository, BookingRepository, MessageRepository, CategoryRepository
- [ ] Implement: EventPhotoRepository, UserEventViewRepository
- [ ] GORM model structs + mapper functions for all entities

### 2.5 Middleware
- [ ] `[!]` JWT auth middleware
- [ ] `[!]` Role guard factory `RequireRole(...roles)`
- [ ] Request logger with request ID
- [ ] Rate limiter (Redis sliding window)
- [ ] Global error handler — map domain errors to HTTP status codes
- [ ] CORS middleware

---

## 3. Backend — Features

### 3.1 Authentication
- [ ] `[!]` `auth_service.go`: Register, Login, RefreshToken, Logout
- [ ] `[!]` Handlers: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- [ ] `[!]` RegisterRequest DTO with full validation
- [ ] `[!]` JWT generation (access + refresh) with all claims
- [ ] `[!]` Store refresh JTI in Redis with TTL
- [ ] Implement token refresh + rotation
- [ ] bcrypt cost 12 for password hashing
- [ ] Rate limiting on auth endpoints

### 3.2 User Management
- [ ] `[!]` `user_service.go`: ListUsers, GetUser, ApproveUser, RejectUser, UpdateProfile
- [ ] `[!]` Admin handlers: list, detail, approve, reject
- [ ] `GET /users/me`, `PATCH /users/me`
- [ ] Never expose password hash in any response DTO

### 3.3 Events — Organizer CRUD
- [ ] `[!]` `event_service.go`: Create, Get, List, Search, Update, Delete, Publish, Cancel, GetOrganizerEvents
- [ ] `[!]` All event handlers
- [ ] `[!]` Validate ticket type quantities vs capacity on every write
- [ ] `[!]` Enforce deletion rules (draft only or no bookings yet)
- [ ] `[!]` Enforce cancellation rules (mark CANCELLED, block new bookings)
- [ ] CreateEventRequest + UpdateEventRequest DTOs
- [ ] Support multiple categories per event

### 3.4 Ticket Types
- [ ] `[!]` AddTicketType, UpdateTicketType, DeleteTicketType
- [ ] Validate capacity constraints on every create/update
- [ ] Block modification if bookings exist

### 3.5 Event Photos
- [ ] Upload handler (multipart, validate MIME from bytes, max 5MB)
- [ ] Delete handler
- [ ] Store at `MEDIA_STORAGE_PATH/{event_id}/`
- [ ] Serve via static middleware

### 3.6 Bookings
- [ ] `[!]` `booking_service.go`: CreateBooking, GetBooking, GetMyBookings, GetEventBookings
- [ ] `[!]` Atomic capacity decrement: `UPDATE ... WHERE available >= ?`
- [ ] `[!]` Return `ErrCapacityExceeded` when 0 rows affected
- [ ] `[!]` Validate event is PUBLISHED before booking
- [ ] Calculate total_cost server-side

### 3.7 Messaging
- [ ] `[!]` SendMessage, GetInbox, GetSent, DeleteForUser, MarkAsRead, GetUnreadCount, NotifyEventCancellation
- [ ] `[!]` SSE or polling endpoint for unread count
- [ ] Cache unread count per user in Redis
- [ ] Bulk notify all attendees on event cancellation

### 3.8 Search & Browse
- [ ] `[!]` Full-text search via PostgreSQL `tsvector` + `plainto_tsquery('greek', ...)`
- [ ] `[!]` Filtering: category, title, date range, price range, city
- [ ] `[!]` Keyset pagination
- [ ] Record event view for authenticated users

### 3.9 XML / JSON Export
- [ ] `[!]` Streaming XML export matching assignment DTD exactly
- [ ] `[!]` Streaming JSON export
- [ ] Batch DB reads (100 at a time)
- [ ] `Content-Disposition: attachment` headers

### 3.10 Recommendation Engine
- [ ] `[!]` BMF model struct + hyperparameters
- [ ] `[!]` SGD training loop (user bias, item bias, latent factors)
- [ ] Implicit feedback encoding from bookings + views
- [ ] Cold-start fallback (popularity + recency)
- [ ] Periodic retraining every 6h via cron
- [ ] Redis cache (1h TTL) per user
- [ ] Atomic model swap with `sync.RWMutex`
- [ ] `GET /events/recommended` handler

### 3.11 Wire DI + Health Check
- [ ] `[!]` Wire providers for all repositories, services, handlers
- [ ] `[!]` Run `wire` to generate `wire_gen.go`
- [ ] `GET /health` — DB + Redis ping

---

## 4. Backend — Testing

- [ ] Unit tests: auth_service, event_service, booking_service (capacity enforcement)
- [ ] Unit tests: messaging_service, recommendation engine
- [ ] Integration tests: auth handlers, event CRUD, booking creation (concurrent)
- [ ] Integration tests: XML export validates against DTD
- [ ] Test helpers: testcontainers DB setup, fixtures

---

## 5. Frontend — Foundation

### 5.1 Project Setup
- [ ] `[!]` Scaffold: `bun create vite frontend --template react-ts`
- [ ] `[!]` Install dependencies: Redux Toolkit, RTK Query, React Router v7, React Hook Form, Zod, Lucide React, clsx, tailwind-merge
- [ ] `[!]` Install shadcn/ui: `bunx shadcn init`
- [ ] `[!]` Install react-leaflet + leaflet + @types/leaflet
- [ ] `[!]` Configure Tailwind v4: `@import "tailwindcss"` in `src/index.css`
- [ ] `[!]` Configure path alias `@/` → `src/` in `vite.config.ts` and `tsconfig.json`
- [ ] `[!]` `tsconfig.json`: `strict: true`
- [ ] Configure `VITE_API_BASE_URL` in `.env` and `.env.example`

### 5.2 Core Setup
- [ ] `[!]` `src/app/store.ts` — Redux store with RTK Query middleware
- [ ] `[!]` `src/app/hooks.ts` — `useAppDispatch`, `useAppSelector`
- [ ] `[!]` `src/lib/api.ts` — RTK Query `baseApi` with auth header + token refresh
- [ ] `[!]` `src/lib/utils.ts` — `cn()`, `formatDate()`, `formatDateTime()`, `formatShortDate()`, `formatCurrency()`, `formatNumber()`
- [ ] `[!]` `src/lib/i18n/ui.ts`, `errors.ts`, `messages.ts` — all Greek strings
- [ ] `[!]` `src/types/models.ts` — all TypeScript interfaces
- [ ] `[!]` `src/types/enums.ts` — EventStatus, BookingStatus, UserRole, AccountStatus as const objects
- [ ] `[!]` `src/routes/index.tsx` — `createBrowserRouter` with all routes lazy loaded
- [ ] `[!]` `src/routes/ProtectedRoute.tsx` — auth + role check
- [ ] `[!]` `src/main.tsx` — `<Provider store>`, `<RouterProvider>`

### 5.3 Layout & Shared Components
- [ ] `[!]` `Navbar.tsx` — logo, nav links, user menu, unread badge
- [ ] `[!]` `AppShell.tsx` — Navbar + `<Outlet />`
- [ ] `LoadingSpinner.tsx`
- [ ] `ErrorMessage.tsx`
- [ ] `EmptyState.tsx`
- [ ] `SkeletonList.tsx`
- [ ] `[!]` `Pagination.tsx` — shadcn-based page controls
- [ ] Add shadcn components: `bun x shadcn add button input card dialog table badge tabs sheet select`

---

## 6. Frontend — Features

### 6.1 Auth
- [ ] `[!]` `authSlice.ts` — user, tokens, isAuthenticated, localStorage rehydration
- [ ] `[!]` `authApi.ts` — login, register, refresh, logout RTK Query endpoints
- [ ] `[!]` `useAuth.ts` hook — convenience wrapper over auth store
- [ ] `[!]` `LoginPage.tsx` — form with React Hook Form + Zod
- [ ] `[!]` `RegisterPage.tsx` — full registration form, all required fields
- [ ] `[!]` `PendingApprovalPage.tsx`
- [ ] `UnauthorizedPage.tsx`
- [ ] Token refresh on 401 in `baseApi` reauth wrapper
- [ ] Rehydrate auth state on app load from localStorage

### 6.2 Event Browse
- [ ] `[!]` `eventsApi.ts` — getEvents, getEvent, getRecommended RTK Query endpoints
- [ ] `[!]` `eventsSlice.ts` — filters, pagination UI state
- [ ] `[!]` `EventsPage.tsx` — paginated grid + filter sidebar
- [ ] `[!]` `EventCard.tsx` — title, date, venue, city, categories, price, availability
- [ ] `[!]` Filter sidebar — category, date range, price range, city, free text
- [ ] `[!]` URL search params sync with filters (deep-linkable)
- [ ] `[!]` `EventDetailPage.tsx` — full info, photo gallery, map, ticket selector, booking button
- [ ] `[!]` `MapEmbed.tsx` — Leaflet map, lazy loaded, event marker
- [ ] Recommended events section (authenticated users)
- [ ] Record event view on detail page load
- [ ] Guest: replace booking button with "Σύνδεση για κράτηση" prompt

### 6.3 Bookings
- [ ] `[!]` `bookingsApi.ts` — createBooking, getMyBookings
- [ ] `[!]` Booking form — ticket type select, quantity, live cost preview
- [ ] `[!]` Confirmation dialog — summary + explicit confirm (shadcn Dialog)
- [ ] `[!]` `MyBookingsPage.tsx` — list with event title, date, status, cost
- [ ] Success toast after confirmed booking

### 6.4 Organizer
- [ ] `[!]` `OrganizerEventsPage.tsx` — my events list, status badges, actions
- [ ] `[!]` `CreateEventPage.tsx` — full form: all DTD fields, categories multi-select, ticket types (dynamic add/remove), photo upload
- [ ] `[!]` `EditEventPage.tsx` — same as create, pre-populated
- [ ] `[!]` Live capacity validator (sum of ticket quantities vs capacity)
- [ ] `[!]` Publish action with confirmation dialog
- [ ] `[!]` Cancel action with confirmation + warning about notifying attendees
- [ ] `[!]` Delete action (only shown when allowed)
- [ ] `EventBookingsPage.tsx` — all bookings for an event, paginated
- [ ] Photo upload component — drag & drop, preview, delete

### 6.5 Messaging
- [ ] `[!]` `messagingApi.ts` — getInbox, getSent, sendMessage, deleteMessage, markRead, getUnreadCount
- [ ] `[!]` `messagingSlice.ts` — unread count, polling interval
- [ ] `[!]` `useUnreadCount.ts` — poll every 30s, update navbar badge
- [ ] `[!]` `InboxPage.tsx` — list with unread highlight, pagination
- [ ] `[!]` `SentPage.tsx`
- [ ] Message detail view — full body, reply button
- [ ] Compose form — recipient, subject, body
- [ ] Delete action for inbox/sent
- [ ] Unread badge in Navbar

### 6.6 Admin
- [ ] `[!]` `adminApi.ts` — getUsers, approveUser, rejectUser, exportXml, exportJson
- [ ] `[!]` `UsersPage.tsx` — table with username, name, email, role, status; pagination; filter by status
- [ ] `[!]` `UserDetailPage.tsx` — all fields, approve/reject buttons for pending
- [ ] `[!]` Export XML button — triggers file download
- [ ] `[!]` Export JSON button — triggers file download

---

## 7. Frontend — Testing

- [ ] Unit tests for `authSlice`, `eventsSlice`
- [ ] Unit tests for `useAuth`, `useUnreadCount`
- [ ] Component tests: EventCard, Pagination, BookingForm (React Testing Library)
- [ ] ProtectedRoute tests
- [ ] E2E (Playwright): register → pending → login → browse → book → my bookings
- [ ] E2E: organizer create event → publish → attendee books → organizer views booking
- [ ] E2E: admin approves user → exports XML

---

## 8. Integration & System Testing

- [ ] `[!]` Concurrent booking test — verify capacity not exceeded under load
- [ ] XML export validation against assignment DTD (`xmllint`)
- [ ] Full-text search with Greek text
- [ ] JWT expiry + refresh rotation
- [ ] Rate limiting on auth endpoints
- [ ] Event cancellation bulk messaging
- [ ] Recommendation endpoint (cold-start + returning user)

---

## 9. Report (`./report/`)

- [ ] Cover page — title, team, student IDs, date
- [ ] Table of contents
- [ ] Chapter 1: Introduction
- [ ] Chapter 2: Architecture overview
- [ ] Chapter 3: Database design + ER diagram
- [ ] Chapter 4: Backend implementation
- [ ] Chapter 5: Frontend implementation
- [ ] Chapter 6: Authentication & security
- [ ] Chapter 7: Recommendation engine (BMF algorithm, evaluation)
- [ ] Chapter 8: Testing strategy
- [ ] Epilogue — development summary, difficulties, solutions
- [ ] Export as `./report/report.pdf`

---

## 10. Documentation (`./docs/`)

- [ ] `docs/setup.md`
- [ ] `docs/deployment.md`
- [ ] `docs/api.md` (or generate from Swagger)
- [ ] `docs/database.md` + ER diagram
- [ ] `docs/architecture.md`
- [ ] `docs/recommendation.md`
- [ ] Configure `gofiber/swagger`, annotate all handlers
- [ ] `swag init` → `docs/swagger.json`

---

## 11. Pre-Submission Checklist

- [ ] All `[!]` items completed
- [ ] No `TODO` / `FIXME` in committed code
- [ ] No hardcoded secrets, credentials, or localhost URLs in source
- [ ] `go vet ./...` passes
- [ ] `golangci-lint run` passes
- [ ] `tsc --noEmit` passes
- [ ] `eslint` passes
- [ ] `go test ./...` passes
- [ ] `bun run test` passes
- [ ] Docker Compose starts cleanly from scratch
- [ ] App runs following `docs/setup.md` on a fresh machine
- [ ] XML export validates against assignment DTD
- [ ] OpenStreetMap renders on event detail
- [ ] Recommendation endpoint returns results
- [ ] Report PDF in `./report/`
- [ ] Source zip excludes `node_modules`, `dist`, `.env`, `uploads/`
- [ ] Zip + PDF uploaded to e-class before deadline