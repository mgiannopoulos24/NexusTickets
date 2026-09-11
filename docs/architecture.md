# Architecture

NexusTickets is a browser ⇄ server application: a React single-page app talks
to a Go REST API over HTTPS, plus one WebSocket for push notifications. There is
no server-side rendering; the API is the only way in, and every request beyond
browsing is authenticated with a JWT and authorised by role.

```
┌──────────────────────────┐   HTTPS (REST, JSON envelope)   ┌───────────────────────────┐
│  Browser                 │ ──────────────────────────────▶ │  Go API (Fiber)           │
│  React 19 + Redux/RTKQ   │ ◀────────────────────────────── │  handler → service → repo │
│  react-leaflet (OSM)     │   WSS /api/v1/ws/messages       │  ws hub (push only)       │
└──────────────────────────┘ ◀────────────────────────────── └────────────┬──────────────┘
                                                                 ┌────────┴────────┐
                                                                 ▼                 ▼
                                                          PostgreSQL 16         Redis 7
                                                          (GORM)                (tokens, rate limit,
                                                                                 unread counters)
```

In development Vite serves the SPA on `https://localhost:5173` and proxies
`/api`, `/uploads` and the WebSocket to the backend; in production nginx does
the same from the built `dist/` (see `docs/deployment.md`).

## Backend

Go 1.22, Fiber v2, GORM, Wire. Layered as

```
cmd/server/main.go        bootstrap: config → logger → Postgres → Redis → AutoMigrate → ensure admin → routes → listen(TLS)
internal/handler          Fiber handlers: parse/validate request DTOs, call one service, write the envelope
internal/service          business rules; no HTTP types; depends on repository interfaces
internal/repository       interfaces + the GORM implementation (postgres/), models ⇄ domain mappers
internal/domain           entities, enums, sentinel errors (ErrNotFound, ErrCapacityExceeded, …)
internal/middleware       JWT auth (header / query for WS), RequireRole, CORS, request id/log, rate limit, error mapping
internal/export           XML/JSON catalogue structs matching the assignment DTD
internal/wire             compile-time dependency injection
```

Cross-cutting decisions:

- **Errors**: services return domain sentinel errors; `middleware.ErrorHandler`
  maps them to HTTP status codes once, so handlers stay thin.
- **Validation**: request DTOs are validated at the boundary; domain rules
  (capacity, lifecycle, ownership, booking-based messaging) live in services and
  are unit-tested with in-memory fakes of the repository interfaces.
- **Concurrency**: seat allocation is a single conditional `UPDATE` inside the
  booking transaction — no application-level locking; the WebSocket hub owns
  its client map through a goroutine + channels; the recommendation model is
  swapped atomically under an `RWMutex`.
- **Background work** (goroutines started in `main`): WebSocket hub, recommender
  retraining (startup + every 6 h), `published → completed` sweeper (15 min).

### Authentication and authorisation

`POST /auth/login` issues an access token (15 min, carries `sub` and `role`) and
a refresh token (7 days). Refresh tokens are identified by `jti` and stored in
Redis, so logout and rotation actually revoke them and a role change is picked
up at the next refresh. `middleware.JWTAuth` verifies the signature and expiry;
`RequireRole(...)` gates each route group. Guests reach only the public event
routes. An administrator also holds the organizer capabilities for their own
events. Ownership (an organizer editing *their* event, a user opening *their*
message or ticket) is checked in the service.

### Realtime

One WebSocket per open tab, authenticated via `?token=`. The hub keeps
`userID → set of connections`; the messaging service calls `hub.SendToUser`
after storing a message and after every change of the unread total. The channel
is server → client only, which keeps it trivially safe: nothing a client sends
is interpreted.

### Recommendations

Biased Matrix Factorization implemented from scratch
(`service/recommendation_engine.go`): SGD over an implicit-feedback matrix built
from confirmed bookings (3.0) and event-page views (1.0), predicting
`μ + b_u + b_i + p_u·q_i`. Users with only views still get a factor vector
(§13's "views only" case); users with nothing fall back to popularity.
`docs/recommendation.md` has the details and the offline evaluation on the
provided dataset.

## Frontend

React 19, TypeScript strict, Vite, Tailwind v4 + shadcn/ui, React Router v7,
Redux Toolkit with RTK Query.

```
src/app          store, RTK Query API slices (authApi, eventsApi, bookingsApi, messagesApi, usersApi), auth/messaging/events slices
src/routes       single route table; ProtectedRoute wraps protected + role-limited pages
src/pages        one component per screen (Home, events, auth, bookings, organizer/*, admin/*, messages)
src/components   ui/ (shadcn primitives), layout/ (Navbar with unread badge, AppShell mounting the socket), feature folders
src/hooks        useAuth, useWebSocket
src/utils        api.ts (fetchBaseQuery with bearer header + 401 → refresh → retry), wsClient.ts (singleton, reconnect)
src/types        API models mirrored from the Go DTOs
```

- **Server state** is entirely in RTK Query with tag invalidation
  (`Event`, `Booking`, `User`, `Message`); **client state** (session, filters,
  unread count) in three small slices. URL search params hold page state that
  should survive reload and be linkable (event filters, mailbox folder/page/open
  message, compose intent).
- **Auth flow**: tokens in `localStorage`; every 401 triggers one refresh and a
  retry; failure clears the session. `ProtectedRoute` redirects to `/login` and
  back; the administrator lands on `/admin/users` after login (§3).
- **Maps**: `react-leaflet` with OpenStreetMap tiles on the event page and in
  the event forms (§9).
- **Language**: the UI is Greek; formatting uses `Intl` with `el-GR`.

## Requirement → code map

| § | Where |
|---|---|
| 1–2 registration / login / pending | `auth_service.go`, `RegisterPage.tsx`, `LoginPage.tsx`, `PendingApprovalPage.tsx` |
| 3–4 built-in admin, user management | `service/bootstrap.go` (EnsureAdmin), `user_service.go`, `pages/admin/*` |
| 5–6 home + navigation | `Home.tsx`, `HomeQuickNav.tsx` |
| 7 event CRUD, capacity, publish/cancel/delete | `event_service.go`, `pages/organizer/*`, `TicketTypesEditor.tsx` |
| 8 browse / search / pagination | `Search` in `event_service.go`, `events_search_vector`, `EventsIndexPage.tsx`, `EventsFilters.tsx` |
| 9 detail, OSM map, booking with confirmation | `EventDetailPage.tsx`, `EventMapEmbed.tsx`, `BookingForm.tsx`, `booking_service.go`, `booking_tx.go` |
| 10 messaging | `messaging_service.go`, `handler/ws/*`, `pages/messages/MessagesPage.tsx`, `components/messages/*` (reached from the profile menu) |
| support (extra) | `support_service.go`, `support_handler.go`, `pages/support/SupportPage.tsx`, `pages/admin/AdminSupportPage.tsx` |
| 11 guest browsing | public event routes, `OptionalJWTAuth` |
| 12 XML/JSON export | `internal/export/catalog.go`, `catalog_export_service.go`, `AdminEventsPage.tsx` |
| 13 BMF recommender | `recommendation_engine.go`, `recommendation_service.go`, `Home.tsx` "Προτεινόμενα" |
| TLS / JWT / RBAC | `docker/tls`, `vite.config.ts`, `nginx.conf`, `middleware/auth.go`, `ws_auth.go` |
