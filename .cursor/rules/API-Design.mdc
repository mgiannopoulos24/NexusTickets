---
description: REST API + WebSocket design conventions
globs: ["backend/internal/handler/**/*.go", "backend/cmd/**/*.go"]
alwaysApply: false
---

# API Design Rules

## URL Conventions
- Base path: `/api/v1/`
- Plural nouns: `/events`, `/bookings`, `/users`
- Kebab-case: `/ticket-types`
- Nested routes max one level deep: `/events/:id/bookings` ✓

## HTTP Method Semantics
```
GET    /events              → list
GET    /events/:id          → single
POST   /events              → create
PATCH  /events/:id          → partial update
DELETE /events/:id          → delete
POST   /events/:id/publish  → state transition
POST   /events/:id/cancel   → state transition
```

## Complete Route Map

```
# Auth (public)
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout

# Events (public browse — Req 8, 11)
GET    /api/v1/events        ?page&size&category&title&q&from&to&min_price&max_price&city
GET    /api/v1/events/:id
GET    /api/v1/events/recommended   [auth required — Req 13]

# Events (organizer — Req 7)
POST   /api/v1/events                        [organizer]
PATCH  /api/v1/events/:id                    [organizer, own]
DELETE /api/v1/events/:id                    [organizer, own, before bookings]
POST   /api/v1/events/:id/publish            [organizer, own]
POST   /api/v1/events/:id/cancel             [organizer, own]
GET    /api/v1/events/:id/bookings           [organizer, own]

# Ticket Types (Req 7a, 7d)
POST   /api/v1/events/:id/ticket-types       [organizer]
PATCH  /api/v1/events/:id/ticket-types/:tid  [organizer]
DELETE /api/v1/events/:id/ticket-types/:tid  [organizer]

# Photos (Req 7a)
POST   /api/v1/events/:id/photos             [organizer] multipart/form-data
DELETE /api/v1/events/:id/photos/:pid        [organizer]

# Bookings (Req 9)
POST   /api/v1/bookings                      [attendee, organizer]
GET    /api/v1/bookings/my                   [attendee, organizer]
GET    /api/v1/bookings/:id                  [attendee (own) or organizer (event owner)]

# Messaging REST (Req 10)
GET    /api/v1/messages/inbox                [auth]
GET    /api/v1/messages/sent                 [auth]
GET    /api/v1/messages/unread-count         [auth]
POST   /api/v1/messages                      [auth]
DELETE /api/v1/messages/:id                  [auth, own]

# WebSocket (Req 10 — realtime)
GET    /api/v1/ws/messages?token=<jwt>       [WS upgrade, auth via query param]

# Admin (Req 4, 12)
GET    /api/v1/admin/users                   [admin]
GET    /api/v1/admin/users/:id               [admin]
PATCH  /api/v1/admin/users/:id/approve       [admin]
PATCH  /api/v1/admin/users/:id/reject        [admin]
GET    /api/v1/admin/events/export/xml       [admin]
GET    /api/v1/admin/events/export/json      [admin]

# User profile
GET    /api/v1/users/me                      [auth]
PATCH  /api/v1/users/me                      [auth]
```

## WebSocket Protocol (Requirement 10)

### Connection
```
Client → Server: GET /api/v1/ws/messages?token=<access_jwt>
Server → Client: 101 Switching Protocols  (or 401 if token invalid)
```

### Message Envelope (both directions)
```json
{ "type": "<message_type>", "payload": { ... } }
```

### Server → Client message types
```json
// New message received
{ "type": "new_message", "payload": {
    "id": "uuid",
    "senderId": "uuid",
    "senderName": "Nick Jones",
    "subject": "...",
    "body": "...",
    "eventId": "uuid | null",
    "sentAt": "2025-07-12T20:30:00Z"
}}

// Unread count update (sent after every new message)
{ "type": "unread_count", "payload": { "count": 5 } }

// Message deleted (from sender side)
{ "type": "message_deleted", "payload": { "id": "uuid" } }
```

### Reconnection
- Client reconnects automatically after close (3s initial, exponential backoff up to 30s)
- Server does NOT store messages during disconnect — client fetches missed messages via REST `GET /messages/inbox` on reconnect

## Response Envelope (REST)
```json
// Success — single
{ "data": { ... }, "error": null }

// Success — collection
{ "data": [...], "error": null, "meta": { "page": 1, "page_size": 10, "total": 243, "total_pages": 25 } }

// Error
{ "data": null, "error": "capacity_exceeded", "details": { "field": "message" } }
```

## HTTP Status Codes
```
200 OK
201 Created
204 No Content
400 Bad Request        — malformed input
401 Unauthorized       — missing/invalid JWT
403 Forbidden          — wrong role or not owner
404 Not Found
409 Conflict           — duplicate username/email
422 Unprocessable      — validation errors with field details
429 Too Many Requests  — rate limit
500 Internal Server Error — never leak stack traces
```

## CORS Configuration
```go
app.Use(cors.New(cors.Config{
    AllowOrigins:     "https://yourdomain.com,http://localhost:5173",
    AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    AllowHeaders:     "Content-Type,Authorization",
    AllowCredentials: true,
    MaxAge:           86400,
}))
```

## File Upload Rules
- Photos: `multipart/form-data`, max 5MB, MIME: `image/jpeg`, `image/png`, `image/webp`
- Validate MIME from file header bytes — never from extension
- Store at `MEDIA_STORAGE_PATH/{event_id}/`; never in DB as BLOB
- Response returns relative path; frontend prepends `VITE_MEDIA_BASE_URL`

## XML Export (Requirement 12)
```go
// Streaming — never buffer all records
c.Set("Content-Type", "application/xml; charset=utf-8")
c.Set("Content-Disposition", `attachment; filename="events.xml"`)
encoder := xml.NewEncoder(c.Response().BodyWriter())
// batch: 100 records at a time
```

XML structs MUST match assignment DTD exactly:
- `EventID` attribute on `Event`
- `Category` can repeat (multiple per event)
- `GeoLocation` with `Latitude`/`Longitude` attributes
- `TicketTypeID` attribute on `TicketType`
- `BookingID` on `Booking`, `UserID` on `Attendee` and `Organizer`
