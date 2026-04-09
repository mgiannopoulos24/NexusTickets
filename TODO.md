# NexusTickets — Master TODO

> Legend: `[!]` = critical path item

---

## 0. Project Bootstrap

- [X] `[!]` Initialize monorepo root with `git init`
- [X] `[!]` Create root `.gitignore` (Go binaries, `dist/`, `.env*`, `backend/uploads/`, `node_modules/`, `*.log`, `.DS_Store`)
- [X] `[!]` Create root `docker-compose.yml` with services: `postgres`, `redis`, `backend`, `frontend`
- [X] `[!]` Create root `docker-compose.dev.yml` override (hot reload, exposed ports)
- [X] Create `.env.example` with all required env vars
- [X] Create `Makefile` with targets: `dev`, `build`, `test`, `lint`, `migrate-up`, `migrate-down`, `seed`, `wire`
- [X] Set up `pre-commit` hooks: `golangci-lint`, `eslint`, `tsc --noEmit`, `gitleaks`

---

## 1. Infrastructure & DevOps

### 1.1 Docker
- [X] `[!]` Write `backend/Dockerfile` (multi-stage, scratch final image)
- [X] `[!]` Write `frontend/Dockerfile` (Bun builder + nginx)
- [X] Write `nginx/nginx.conf` — reverse proxy to backend, static files for frontend
- [X] Configure nginx TLS (self-signed dev, Let's Encrypt prod)
- [X] Add `healthcheck` directives to all Docker services
- [X] Add named volumes for postgres and redis data

### 1.2 Database
- [X] `[!]` Provision PostgreSQL 16 container with persistent volume
- [X] `[!]` Create database `nexustickets` and dedicated user
- [X] `[!]` Provision Redis 7 container with password and `appendonly yes`

### 1.3 CI Pipeline
- [X] Workflow: `lint.yml` — `golangci-lint` + `eslint` + `tsc` on every PR
- [X] Workflow: `test.yml` — Go tests + frontend tests on every PR
- [X] Workflow: `security.yml` — `govulncheck`, `gitleaks`, `trivy`

---

## 2. Backend — Foundation

### 2.1 Project Skeleton
- [X] `[!]` `go mod init nexustickets`
- [X] `[!]` Add all dependencies: Fiber v2, gofiber/websocket, GORM, Wire, JWT, Validator, Redis, Migrate, Zap, Testify, UUID, bcrypt, Cron
- [X] `[!]` Create full directory structure
- [X] `[!]` Implement `internal/config/config.go` — load + validate all env vars on startup
- [X] `[!]` Set up structured logger (zap)
- [X] `[!]` `GET /health` — returns `{ status: ok }`
- [X] `[!]` `GET /ping` — returns `pong`
- [X] `[!]` air hot reload configured (`.air.toml` with correct `cmd`)
- [X] Implement `pkg/response/response.go` — `OK`, `Created`, `Paginated`, `Error` helpers
- [X] Implement `pkg/pagination/pagination.go`
- [X] Complete `cmd/server/main.go` bootstrap chain (beyond health/ping)

### 2.2 Database & Migrations
- [X] `[!]` GORM PostgreSQL connection with pool settings
- [X] `[!]` Redis client initialization
- [X] `[!]` Run migrations at startup before accepting traffic
- [X] `[!]` Migration `000001`: users table
- [X] `[!]` Migration `000002`: events table + search_vector + indexes
- [X] `[!]` Migration `000003`: categories + event_categories
- [X] `[!]` Migration `000004`: ticket_types
- [X] `[!]` Migration `000005`: bookings
- [X] `[!]` Migration `000006`: messages
- [X] `[!]` Migration `000007`: event_photos
- [X] `[!]` Migration `000008`: user_event_views
- [X] Migration `000009`: seed admin user
- [X] Migration `000010`: seed initial categories
- [X] All indexes from database ruleset

### 2.3 Domain Layer
- [X] `[!]` Entities: User, Event, TicketType, Booking, Message, Category, EventPhoto
- [X] `[!]` Constants: UserRole, AccountStatus, EventStatus, BookingStatus
- [X] `[!]` `domain/errors.go` — all sentinel errors

### 2.4 Repository Layer
- [X] `[!]` Define all repository interfaces
- [X] `[!]` Implement: UserRepository, EventRepository, TicketTypeRepository, BookingRepository, MessageRepository, CategoryRepository
- [X] Implement: EventPhotoRepository, UserEventViewRepository
- [X] `[!]` GORM model structs + mapper functions for all entities

### 2.5 Middleware
- [X] `[!]` JWT auth middleware
- [X] `[!]` WebSocket JWT auth middleware (`ws_auth.go` — token via query param)
- [X] `[!]` Role guard factory `RequireRole(...roles)`
- [X] Request logger with request ID
- [X] Rate limiter (Redis sliding window)
- [X] Global error handler — map domain errors to HTTP status codes
- [X] CORS middleware (AllowOrigins includes `localhost:5173`)

---

## 3. Backend — Features

### 3.1 Authentication
- [X] `[!]` `auth_service.go`: Register, Login, RefreshToken, Logout
- [X] `[!]` Handlers: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- [X] `[!]` RegisterRequest DTO — username, password, confirm_password, first_name, last_name, email, phone, address, city, country, vat_number
- [X] `[!]` JWT generation (access + refresh) with all claims (sub, role, jti, exp, iat)
- [X] `[!]` Store refresh JTI in Redis with TTL
- [X] Implement token refresh + rotation
- [X] bcrypt cost 12 for password hashing
- [X] Rate limiting on auth endpoints (5 req/min per IP)

### 3.2 User Management
- [X] `[!]` `user_service.go`: ListUsers, GetUser, ApproveUser, RejectUser, UpdateProfile
- [X] `[!]` Admin handlers: list, detail, approve, reject
- [X] `GET /users/me`, `PATCH /users/me`
- [X] Never expose password hash in any response DTO

### 3.3 Events — Organizer CRUD
- [X] `[!]` `event_service.go`: Create, Get, List, Search, Update, Delete, Publish, Cancel, GetOrganizerEvents
- [X] `[!]` All event handlers
- [X] `[!]` Validate sum of ticket type quantities ≤ event capacity on every write
- [X] `[!]` Enforce deletion rules: DRAFT only, or PUBLISHED with zero bookings
- [X] `[!]` Enforce cancellation rules: PUBLISHED only → CANCELLED, block new bookings, keep all data
- [X] CreateEventRequest + UpdateEventRequest DTOs
- [X] Support multiple categories per event (create category if not exists)

### 3.4 Ticket Types
- [X] `[!]` AddTicketType, UpdateTicketType, DeleteTicketType
- [X] Validate capacity constraints on every create/update
- [X] Block modification if bookings exist for that ticket type

### 3.5 Event Photos
- [X] Upload handler (multipart, validate MIME from bytes, max 5MB)
- [X] Delete handler
- [X] Store at `MEDIA_STORAGE_PATH/{event_id}/`
- [X] Serve via static middleware

### 3.6 Bookings
- [X] `[!]` `booking_service.go`: CreateBooking, GetBooking, GetMyBookings, GetEventBookings
- [X] `[!]` Atomic capacity decrement: `UPDATE ticket_types SET available = available - $1 WHERE id = $2 AND available >= $1`
- [X] `[!]` Return `ErrCapacityExceeded` when 0 rows affected
- [X] `[!]` Validate event is PUBLISHED before allowing booking
- [X] Calculate total_cost server-side (never trust client value)

### 3.7 Messaging — REST + WebSocket (Requirement 10)
- [X] `[!]` `messaging_service.go`: SendMessage, GetInbox, GetSent, DeleteForUser, MarkAsRead, GetUnreadCount, NotifyEventCancellation
- [X] `[!]` REST handlers: `GET /api/v1/messages/inbox`, `GET /api/v1/messages/sent`, `GET /api/v1/messages/unread-count`, `POST /api/v1/messages`, `DELETE /api/v1/messages/:id`
- [X] `[!]` WebSocket Hub (`handler/ws/hub.go`) — userID → set of clients, broadcast channel, register/unregister
- [X] `[!]` WebSocket Client (`handler/ws/client.go`) — ReadPump, WritePump, ping/pong keepalive, max message size
- [X] `[!]` WebSocket upgrade handler: `GET /api/v1/ws/messages?token=<jwt>`
- [X] `[!]` After SendMessage: broadcast `new_message` + `unread_count` to recipient via Hub
- [X] `[!]` Cache unread count in Redis (`INCR nexustickets:unread:{user_id}` on send, `SET 0` on inbox open)
- [X] `[!]` `NotifyEventCancellation`: bulk INSERT messages + WS broadcast to all attendees with confirmed bookings

### 3.8 Search & Browse
- [X] `[!]` Full-text search via `tsvector` + `plainto_tsquery('greek', ...)`
- [X] `[!]` Filtering: category, title (ILIKE), free-text (q), date range, price range, city
- [X] `[!]` Keyset pagination (`after_start` + `after_id`, `meta.has_more`, `meta.next_after_*`; offset fallback)
- [X] Record event view in `user_event_views` for authenticated users (`OptionalJWTAuth` on `GET /events/:id`)

### 3.9 XML / JSON Export (Requirement 12)
- [X] `[!]` Streaming XML export — struct tags match assignment DTD exactly (`docs/events-catalog.dtd`, `internal/export/catalog.go`)
- [X] `[!]` Streaming JSON export (`{"events":[...]}` streamed)
- [X] `[!]` Batch DB reads (100 records at a time)
- [X] `[!]` `Content-Disposition: attachment` headers (`events.xml` / `events.json`)

### 3.10 Recommendation Engine (Requirement 13)
- [ ] `[!]` BMF model struct + hyperparameters (K=20, lr=0.005, lambda=0.02, epochs=50)
- [ ] `[!]` SGD training loop: R̂(u,i) = μ + b_u + b_i + P_u·Q_i^T
- [ ] Implicit feedback encoding from bookings + views
- [ ] Cold-start fallback (popularity + recency scoring)
- [ ] Periodic retraining every 6h via cron
- [ ] Redis cache per user (1h TTL)
- [ ] Atomic model swap with `sync.RWMutex`
- [ ] `GET /events/recommended` handler

### 3.11 Wire DI
- [ ] `[!]` Wire providers for all repositories, services, handlers, WebSocket Hub
- [ ] `[!]` Run `wire` to generate `wire_gen.go`

---

## 4. Backend — Testing

- [ ] Unit tests: auth_service, event_service, booking_service (capacity enforcement)
- [ ] Unit tests: messaging_service, recommendation engine
- [ ] Integration tests: auth handlers, event CRUD, booking creation (concurrent)
- [ ] Integration tests: XML export validates against DTD
- [ ] WebSocket integration test: connect, send message, verify broadcast to recipient
- [ ] Test helpers: testcontainers DB setup, fixtures

---

## 5. Frontend — Foundation

### 5.1 Project Setup
- [X] `[!]` Scaffold with Vite + React + TypeScript
- [X] `[!]` Bun as package manager
- [X] `[!]` Install shadcn/ui (`bunx shadcn init`)
- [X] `[!]` Configure Tailwind v4 (`@import "tailwindcss"` + `@tailwindcss/vite` plugin)
- [X] `[!]` Configure path alias `@/` → `src/`
- [X] `[!]` Install remaining dependencies: Redux Toolkit, RTK Query, React Router v7, React Hook Form, Zod, Lucide React, clsx, tailwind-merge
- [X] `[!]` Install react-leaflet + leaflet + @types/leaflet
- [X] `[!]` `tsconfig.json`: `strict: true`
- [X] Configure `VITE_API_PROXY_TARGET` and `VITE_WS_URL` in `.env.example` (app uses relative `/api/v1` paths via Vite proxy)

### 5.2 Core Setup
- [X] `[!]` `src/app/store.ts` — Redux store with messaging reducer + RTK Query middleware
- [X] `[!]` `src/app/hooks.ts` — `useAppDispatch`, `useAppSelector`
- [X] `[!]` `src/utils/api.ts` — RTK Query `baseApi` with auth header + 401 reauth wrapper
- [X] `[!]` `src/utils/wsClient.ts` — WebSocket singleton with auto-reconnect + subscriber pattern
- [X] `[!]` `src/hooks/useWebSocket.ts` — connect on auth, dispatch to Redux on incoming WS messages
- [X] `[!]` `src/lib/utils.ts` + `src/helpers/formatDate.ts` + `src/helpers/formatCurrency.ts` — `cn()`, `formatDate()`, `formatDateTime()`, `formatShortDate()`, `formatCurrency()`, `formatNumber()`
- [X] `[!]` `src/locales/en.yaml` (current locale file path)
- [X] `[!]` `src/types/models.ts` — all TypeScript interfaces
- [X] `[!]` `src/types/enums.ts` — EventStatus, BookingStatus, UserRole, AccountStatus as const
- [X] `[!]` `src/types/ws.ts` — WSEnvelope, WSMessageType, WSNewMessagePayload, WSUnreadCountPayload
- [X] `[!]` `src/routes/routes.tsx` — single route config file (lazy-loaded route elements)
- [X] `[!]` `src/components/auth/ProtectedRoute.tsx` — auth + role check
- [X] `[!]` `src/main.tsx` — `<Provider store>`, `<BrowserRouter>`

### 5.3 Layout & Shared Components
- [X] `[!]` `Navbar.tsx` — logo, nav links, user menu, unread badge (from Redux)
- [X] `[!]` `AppShell.tsx` — mounts `useWebSocket()`, renders Navbar + `<Outlet />`
- [X] `LoadingSpinner.tsx`
- [X] `ErrorMessage.tsx`
- [X] `EmptyState.tsx`
- [X] `SkeletonList.tsx`
- [X] `[!]` `Pagination.tsx` — shadcn-based page controls
- [X] Add shadcn components: `bunx shadcn add button input card dialog table badge tabs sheet select sonner` (present under `src/components/ui/`; `badge` added)

---

## 6. Frontend — Features

### 6.1 Auth
- [X] `[!]` `authSlice.ts` — user, accessToken, isAuthenticated, localStorage rehydration
- [X] `[!]` `authApi.ts` — login, register, refresh, logout RTK Query endpoints
- [X] `[!]` `useAuth.ts` — convenience wrapper over auth store
- [X] `[!]` `LoginPage.tsx` — React Hook Form + Zod
- [X] `[!]` `RegisterPage.tsx` — all fields: username, password, confirm_password, first_name, last_name, email, phone, address, city, country, vat_number
- [X] `[!]` `PendingApprovalPage.tsx`
- [X] `UnauthorizedPage.tsx`
- [X] Token refresh on 401 in `baseApi` reauth wrapper
- [X] `wsClient.disconnect()` called on logout

### 6.2 Event Browse
- [X] `[!]` `eventsApi.ts` — getEvents, getEvent, getRecommended
- [X] `[!]` `eventsSlice.ts` — filters, pagination UI state
- [X] `[!]` `EventsPage.tsx` — paginated grid + filter sidebar
- [X] `[!]` `EventCard.tsx` — title, date, venue, city, categories, price, availability
- [X] `[!]` Filter sidebar — category, date range, price range, city, free text
- [X] `[!]` URL search params sync with active filters
- [X] `[!]` `EventDetailPage.tsx` — full info, photo gallery, map, ticket selector, booking button
- [X] `[!]` `EventMapEmbed.tsx` — react-leaflet, lazy-loaded via route chunk, event marker
- [X] Recommended events section (authenticated users only)
- [X] Record event view on detail page load (authenticated)
- [X] Guest: show "Σύνδεση για κράτηση" instead of booking button

### 6.3 Bookings
- [ ] `[!]` `bookingsApi.ts` — createBooking, getMyBookings
- [ ] `[!]` Booking form — ticket type select, quantity input, live cost preview
- [ ] `[!]` Confirmation dialog before submit (booking cannot be reversed)
- [ ] `[!]` `MyBookingsPage.tsx` — list with event title, date, status, cost
- [ ] Success toast (Sonner) after confirmed booking

### 6.4 Organizer
- [ ] `[!]` `OrganizerEventsPage.tsx` — my events, status badges, action buttons
- [ ] `[!]` `CreateEventPage.tsx` — all DTD fields, multi-select categories, dynamic ticket types, photo upload
- [ ] `[!]` `EditEventPage.tsx` — pre-populated, same as create
- [ ] `[!]` Live capacity validator (sum of ticket quantities vs capacity, client-side)
- [ ] `[!]` Publish action — confirmation dialog
- [ ] `[!]` Cancel action — confirmation dialog, warn about bulk notification to attendees
- [ ] `[!]` Delete action — only shown when allowed (DRAFT or no bookings)
- [ ] `EventBookingsPage.tsx` — all bookings for an event, paginated
- [ ] Photo upload — drag & drop, preview, delete

### 6.5 Messaging — WebSocket (Requirement 10)
- [ ] `[!]` `messagingSlice.ts` — unreadCount, pendingMessages (incoming WS buffer)
- [ ] `[!]` `messagingApi.ts` — getInbox, getSent, sendMessage, deleteMessage, markRead (REST)
- [ ] `[!]` `InboxPage.tsx` — list, unread highlighted, pagination; reset unread on open
- [ ] `[!]` `SentPage.tsx` — sent messages list, pagination
- [ ] `[!]` `MessageDetailPage.tsx` — full body, reply button
- [ ] `[!]` Compose/reply form — recipient, subject, body
- [ ] `[!]` Delete action for inbox/sent
- [ ] `[!]` Unread badge in Navbar — sourced from `state.messaging.unreadCount` (WebSocket-driven)
- [ ] On inbox open: call markRead REST + dispatch `setUnreadCount(0)` in Redux

### 6.6 Admin
- [ ] `[!]` `adminApi.ts` — getUsers, approveUser, rejectUser, exportXml, exportJson
- [ ] `[!]` `UsersPage.tsx` — table: username, name, email, role, status; pagination; filter by status
- [ ] `[!]` `UserDetailPage.tsx` — all fields, approve/reject for pending accounts
- [ ] `[!]` Export XML — triggers file download from `GET /admin/events/export/xml`
- [ ] `[!]` Export JSON — triggers file download from `GET /admin/events/export/json`

---

## 7. Frontend — Testing

- [ ] Unit tests: `authSlice`, `eventsSlice`, `messagingSlice`
- [ ] Unit tests: `useAuth`, `useWebSocket`
- [ ] Component tests: EventCard, Pagination, BookingForm (React Testing Library)
- [ ] ProtectedRoute tests
- [ ] E2E (Playwright): register → pending → login → browse → book → my bookings
- [ ] E2E: organizer create → publish → attendee books → organizer views booking
- [ ] E2E: admin approves user → exports XML
- [ ] E2E: send message → recipient receives via WebSocket → unread badge updates

---

## 8. Integration & System Testing

- [ ] `[!]` Concurrent booking — verify capacity not exceeded under load
- [ ] XML export validates against assignment DTD (`xmllint`)
- [ ] Full-text search with Greek text
- [ ] JWT expiry + refresh rotation
- [ ] Rate limiting on auth endpoints
- [ ] Event cancellation: bulk message INSERT + WS broadcast to all attendees
- [ ] Recommendation endpoint (cold-start user + returning user)
- [ ] WebSocket reconnect after server restart

---

## 9. Report (`./report/`)

- [ ] Cover page — title, team names, student IDs, date
- [ ] Table of contents
- [ ] Chapter 1: Introduction
- [ ] Chapter 2: Architecture overview (REST + WebSocket)
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
- [ ] `docs/api.md` (REST + WebSocket protocol)
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
- [ ] WebSocket connects and delivers messages in realtime
- [ ] Recommendation endpoint returns results
- [ ] Report PDF in `./report/`
- [ ] Source zip excludes `node_modules`, `dist`, `.env`, `backend/uploads/`
- [ ] Zip + PDF uploaded to e-class before deadline

---

## Submission Deadline

**June session**: 28 June 2026, 23:59
**September session**: 20 September 2026, 23:59
