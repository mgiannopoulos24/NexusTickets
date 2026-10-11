# REST API reference

Base path: `/api/v1`. Every response uses one envelope:

```json
{ "data": <payload | null>, "error": null | { "code": "...", "message": "..." }, "meta": null | { ... } }
```

Paginated lists take `limit` (default 20) and `offset`; the mailbox and the
admin lists report `meta.total`. Times are RFC 3339 in UTC. IDs are UUIDs.

## Authentication and roles

Login returns an **access token** (15 min) and a **refresh token** (7 days,
rotated on every refresh, revocable — its `jti` lives in Redis). Send
`Authorization: Bearer <access_token>`. The WebSocket takes the token as a
query parameter (`?token=`) because browsers cannot set headers on it.

| Role | Can |
|---|---|
| guest (no token) | browse and search events, view an event |
| attendee | + book, mailbox, own bookings, profile |
| organizer | + create/manage own events, see their bookings, notify attendees |
| admin | everything an organizer can do for their own events, + user management, edit any event, support queue, XML/JSON export |

Registration creates a `pending` account; only `approved` accounts can log in.

Error codes: `400` validation, `401` missing/expired token or bad credentials,
`403` wrong role / not the owner / messaging without a booking, `404`,
`409` username or e-mail taken and capacity exceeded, `422` domain rule (event
not bookable, ticket types exceed capacity, cannot delete/cancel in this state),
`429` rate limited.

## Auth — `/auth` (5 requests/min per IP)

| Method | Path | Body / query | Notes |
|---|---|---|---|
| GET | `/auth/username-available?username=` | | `{ "available": bool }` — live check on the register form |
| POST | `/auth/register` | `username, password, confirm_password, first_name, last_name, email, phone, address, city, country, vat_number` (9 digits), `latitude?, longitude?, role?` (`attendee` default or `organizer`) | 201, account is `pending` |
| POST | `/auth/login` | `username, password` | `access_token, refresh_token, token_type, access_expires_in, refresh_expires_in` |
| POST | `/auth/refresh` | `refresh_token` | new pair; the old refresh token is revoked; picks up role changes |
| POST | `/auth/logout` | `refresh_token` | revokes it |

## Users — `/users` (auth)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/users/me` | any | profile |
| PATCH | `/users/me` | any | partial update of profile fields |
| GET | `/users/admin?limit&offset` | admin | all users |
| GET | `/users/admin/:id` | admin | one user |
| PATCH | `/users/admin/:id/approve` | admin | `pending → approved` |
| PATCH | `/users/admin/:id/reject` | admin | `pending → rejected` |
| PATCH | `/users/admin/:id/role` | admin | `{ "role": "attendee" \| "organizer" }` |

## Events — `/events`

Public:

| Method | Path | Notes |
|---|---|---|
| GET | `/events?limit&offset` | published events, soonest first |
| GET | `/events/search` | see filters below; `meta.has_more`, `meta.next_after_start`, `meta.next_after_id` for keyset paging |
| GET | `/events/recommended?limit` | BMF recommendations for the caller (optional token; popular events for guests / cold start) |
| GET | `/events/:id` | full event with ticket types and photos; records a view for signed-in users; drafts only visible to their organizer / admin |
| GET | `/categories` | all categories |

Search filters (`/events/search`): `q` (full-text over title, description, venue, city — Greek stemming, every word matched as a prefix so it works while typing; also a substring match on title, venue and city), `title` (substring), `category_ids` (comma-separated), `city`, `start_at` / `end_at` (RFC 3339 range), `min_price` / `max_price` (any ticket type in range), plus `limit`/`offset` or `after_start`+`after_id`.

Organizer (`/events/organizer`, roles `organizer` and `admin`, own events only):

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/events/organizer/me?limit&offset` | | my events, all statuses |
| POST | `/events/organizer` | `title, description, venue, event_type, address?, city, country?, latitude?, longitude?, start_at, end_at, capacity, categories[] (names, ≥1), ticket_types[] ({name, price, quantity}), event_detail?` | 201 as `draft`; Σ quantity ≤ capacity |
| PATCH | `/events/organizer/:id` | any subset of the above; `ticket_types` with `id` updates, without creates, omitted ones are deleted (refused if booked) | not allowed on `cancelled` / `completed` |
| DELETE | `/events/organizer/:id` | | only `draft`, or `published` with zero bookings |
| PATCH | `/events/organizer/:id/publish` | | `draft → published`; needs ≥1 category and ≥1 ticket type |
| PATCH | `/events/organizer/:id/cancel` | | `published → cancelled`; its bookings become `cancelled` (rows kept, held seats returned); every confirmed booker gets a cancellation message |
| POST | `/events/organizer/:id/ticket-types` | `{name, price, quantity}` | |
| PATCH | `/events/organizer/:id/ticket-types/:ticketTypeId` | `{name?, price?, quantity?}` | quantity cannot drop below sold seats |
| DELETE | `/events/organizer/:id/ticket-types/:ticketTypeId` | | refused while it has pending or confirmed bookings |
| POST | `/events/organizer/:id/featured-image` | multipart `file` | JPEG/PNG/WebP/GIF by content, ≤ 5 MB |
| POST | `/events/organizer/:id/photos` | multipart `file` | gallery (`<Media><Photo>`) |
| DELETE | `/events/organizer/:id/photos/:photoId` | | |

Admin (`/events/admin`, role `admin`): `GET /?q=&status=&limit&offset` (every event, newest first, free-text over title/venue/city, `meta.total`), `GET /:id`, `PATCH /:id` (same body as the organizer update plus `status`), `POST /:id/featured-image`.

Event lifecycle: `draft → published → completed` (automatic when `end_at` passes, swept every 15 min) or `published → cancelled`.

## Bookings — `/bookings` (auth)

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/bookings` | attendee, organizer, admin | `{ event_id, ticket_type_id, quantity }` → 201 with a **`pending`** booking that holds the seats for 10 minutes (`hold_expires_at`); event must be `published` and not ended; availability is decremented atomically (`UPDATE … WHERE available >= n`), `409` when short; `total_cost` computed server-side |
| PATCH | `/bookings/:id/confirm` | the booker | `pending → confirmed` (sets `confirmed_at`); final from then on (§9). `409 booking_not_pending` if not pending; `422` if the hold has lapsed or the event can no longer be booked (the hold is released) |
| PATCH | `/bookings/:id/cancel` | the booker | `pending → cancelled`, seats returned at once; `409 booking_not_pending` for a confirmed booking |
| GET | `/bookings/me?limit&offset` | same | own bookings with event / ticket type summaries (`event.organizer_id` lets the client open a message to the organizer) |
| GET | `/bookings/:id` | attendee, organizer | own booking, or a booking on one of the organizer's events |
| GET | `/bookings/organizer/events/:eventId?limit&offset` | organizer | all bookings of one of my events, with attendee identity |

**Lifecycle.** `pending` (seats held) → `confirmed` by the booker, or → `cancelled` when the booker backs out, the hold lapses (a sweeper runs every minute) or the event is cancelled. A confirmed booking keeps `confirmed_at` even if its event is cancelled later; that is what opens messaging, counts towards the organizer's totals and feeds the recommender. Holds that lapsed without confirmation do not block deleting the event or its ticket types.

## Messages — `/messages` (auth; assignment §10)

Two users may write to each other once a confirmed booking links them (attendee ↔ organizer of a booked event). The one other opening: an administrator, who can attend any event, may write to the organizer of any event still open for booking (published, not ended) without a booking, and that organizer may reply. Requests to the administration are **support tickets** (below), not messages.

| Method | Path | Notes |
|---|---|---|
| GET | `/messages/inbox?limit&offset` | received, newest first; `meta.total`; listing does **not** mark anything read |
| GET | `/messages/sent?limit&offset` | sent, newest first |
| GET | `/messages/:id` | one message; for the recipient this **marks it read** and updates the unread counter |
| GET | `/messages/unread-count` | `{ "count": n }` (Redis-cached) |
| GET | `/messages/recipients` | who the caller may write to: their booking contacts, plus, for an administrator, the organizers of every open event |
| POST | `/messages` | `{ recipient_id, subject, body, event_id? }` → 201; `403` without a booking link |
| POST | `/messages/events/:eventId/notify` | organizer of the event only; `{ subject, body }` → `{ "recipients": n }`; one message per confirmed booker |
| DELETE | `/messages/:id` | removes the message from the **caller's** folder only |

Message shape: `id, sender_id, recipient_id, event_id, subject, body, read_at (null = unread), created_at, sender {id, username, full_name, role}, recipient {…}, event {id, title}?`.

### WebSocket — `GET /api/v1/ws/messages?token=<access_token>`

Server → client only, JSON frames `{ "type", "payload" }`:

| type | payload | when |
|---|---|---|
| `new_message` | the message (`id, sender_id, recipient_id, event_id, subject, body, created_at`) | a message landed in the caller's inbox |
| `unread_count` | `{ "count": n }` | whenever the caller's unread total changes (send, open, delete) |

The client seeds the badge from `GET /messages/unread-count` and then follows the socket. Ping/pong keepalive every 54 s; reconnect with backoff on the client.

## Support tickets — `/support` (auth)

A ticket is one user's request to the administration with its own thread. Status: `open` (waiting for the administration) → `answered` (an admin replied last) → `closed`. A user's reply reopens; a closed ticket takes no replies.

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/support/tickets` | any | `{ subject, body }` → 201 ticket (status `open`) |
| GET | `/support/tickets/me?limit&offset` | any | own tickets, most recently active first; `meta.total` |
| GET | `/support/tickets/:id` | owner, admin | `{ ticket, messages[] }`; each message carries `from_admin` |
| POST | `/support/tickets/:id/messages` | owner, admin | `{ body }` → 201 thread; admin ⇒ `answered`, owner ⇒ `open`; `422` when closed |
| PATCH | `/support/tickets/:id/close` | owner, admin | idempotent |
| GET | `/support/admin/tickets?status=&limit&offset` | admin | the queue; `status` in `open` / `answered` / `closed` |
| GET | `/support/admin/counts` | admin | `{ open, answered, closed }` |

## Admin export — `/admin/events/export` (admin; assignment §12)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/events/export/xml` | streamed `events.xml` with `<!DOCTYPE Events SYSTEM "events-catalog.dtd">`, valid against `docs/events-catalog.dtd` |
| GET | `/admin/events/export/json` | streamed `events.json`: `{ "events": [ … same structure … ] }` |

Both include every event of every organizer with its ticket types, bookings and photos, read in batches of 100.

## Misc

`GET /health`, `GET /ping`. Uploaded media is served under `/uploads/media/…`.
