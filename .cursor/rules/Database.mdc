---
description: PostgreSQL + Redis database design and query rules
globs: ["backend/migrations/**", "backend/internal/repository/**/*.go"]
alwaysApply: false
---

# Database Rules — PostgreSQL 16 + Redis 7

## PostgreSQL Design Principles
- Primary keys: `UUID v7` (time-sortable) — type `uuid`
- All timestamps: `TIMESTAMPTZ` — stored as UTC
- Soft deletes where history is required (bookings, events): `deleted_at TIMESTAMPTZ`
- Use `ENUM` types for fixed-value columns
- All foreign keys have explicit `ON DELETE` behavior

## Core Schema

### Users (Requirement 2, 3, 4)
```sql
CREATE TYPE user_role AS ENUM ('admin', 'organizer', 'attendee');
CREATE TYPE account_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(50)    NOT NULL UNIQUE,
    email         VARCHAR(255)   NOT NULL UNIQUE,
    password_hash VARCHAR(255)   NOT NULL,
    first_name    VARCHAR(100)   NOT NULL,
    last_name     VARCHAR(100)   NOT NULL,
    phone         VARCHAR(30),
    address       TEXT,
    city          VARCHAR(100),
    country       VARCHAR(100),
    vat_number    VARCHAR(30),
    role          user_role      NOT NULL DEFAULT 'attendee',
    status        account_status NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);
```

### Events (Requirement 7, 8)
```sql
CREATE TYPE event_status AS ENUM ('draft', 'published', 'completed', 'cancelled');

CREATE TABLE events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title         VARCHAR(255) NOT NULL,
    event_type    VARCHAR(100) NOT NULL,
    venue         VARCHAR(255) NOT NULL,
    address       TEXT         NOT NULL,
    city          VARCHAR(100) NOT NULL,
    country       VARCHAR(100) NOT NULL,
    latitude      NUMERIC(10,7),
    longitude     NUMERIC(10,7),
    start_at      TIMESTAMPTZ  NOT NULL,
    end_at        TIMESTAMPTZ  NOT NULL,
    capacity      INTEGER      NOT NULL CHECK (capacity > 0),
    description   TEXT         NOT NULL,
    status        event_status NOT NULL DEFAULT 'draft',
    organizer_id  UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ,
    search_vector TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('greek', title || ' ' || description)
    ) STORED
);
CREATE INDEX idx_events_search    ON events USING GIN (search_vector);
CREATE INDEX idx_events_status    ON events (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_organizer ON events (organizer_id);
CREATE INDEX idx_events_start_at  ON events (start_at);
```

### Categories (Requirement 7a, 8)
```sql
CREATE TABLE categories (
    id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE event_categories (
    event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
    PRIMARY KEY (event_id, category_id)
);
```

### Ticket Types (Requirement 7a, 7d)
```sql
CREATE TABLE ticket_types (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id   UUID          NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name       VARCHAR(100)  NOT NULL,
    price      NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    quantity   INTEGER       NOT NULL CHECK (quantity > 0),
    available  INTEGER       NOT NULL CHECK (available >= 0),
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_available_lte_quantity CHECK (available <= quantity)
);
```

### Bookings (Requirement 9)
```sql
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled');

CREATE TABLE bookings (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id          UUID           NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    attendee_id       UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    ticket_type_id    UUID           NOT NULL REFERENCES ticket_types(id) ON DELETE RESTRICT,
    number_of_tickets INTEGER        NOT NULL CHECK (number_of_tickets > 0),
    total_cost        NUMERIC(10,2)  NOT NULL,
    status            booking_status NOT NULL DEFAULT 'confirmed',
    booked_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_bookings_attendee ON bookings (attendee_id);
CREATE INDEX idx_bookings_event    ON bookings (event_id);
```

### Messages (Requirement 10)
```sql
CREATE TABLE messages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id         UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    recipient_id      UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    event_id          UUID         REFERENCES events(id) ON DELETE SET NULL,
    subject           VARCHAR(255),
    body              TEXT         NOT NULL,
    is_read           BOOLEAN      NOT NULL DEFAULT FALSE,
    sender_deleted    BOOLEAN      NOT NULL DEFAULT FALSE,
    recipient_deleted BOOLEAN      NOT NULL DEFAULT FALSE,
    sent_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_messages_recipient ON messages (recipient_id) WHERE NOT recipient_deleted;
CREATE INDEX idx_messages_sender    ON messages (sender_id)    WHERE NOT sender_deleted;
CREATE INDEX idx_messages_event     ON messages (event_id);
```

### Event Photos (Requirement 7a)
```sql
CREATE TABLE event_photos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    filename    VARCHAR(500) NOT NULL,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    uploaded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

### User Event Views (Requirement 13 — cold-start)
```sql
CREATE TABLE user_event_views (
    user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
    event_id  UUID REFERENCES events(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, event_id)
);
```

## Critical Query Patterns

### Atomic Capacity Decrement (Requirement 9)
```sql
-- NEVER SELECT then UPDATE in two round trips
UPDATE ticket_types
SET    available = available - $1,
       updated_at = NOW()
WHERE  id = $2
  AND  available >= $1
RETURNING id, available;
-- 0 rows affected → ErrCapacityExceeded → rollback
```

### Full-text Search in Greek (Requirement 8)
```sql
SELECT * FROM events
WHERE  search_vector @@ plainto_tsquery('greek', $1)
  AND  status = 'published'
  AND  deleted_at IS NULL
ORDER BY ts_rank(search_vector, plainto_tsquery('greek', $1)) DESC;
```

### Keyset Pagination (Requirement 8)
```sql
SELECT * FROM events
WHERE  status = 'published'
  AND  deleted_at IS NULL
  AND  (start_at, id) > ($last_start_at, $last_id)
ORDER BY start_at ASC, id ASC
LIMIT $page_size;
```

### Bulk Cancel Notification (Requirement 10)
```sql
-- Get all attendees with confirmed bookings for a cancelled event
SELECT DISTINCT u.id, u.username
FROM bookings b
JOIN users u ON u.id = b.attendee_id
WHERE b.event_id = $1
  AND b.status = 'confirmed';
-- Then INSERT bulk messages + broadcast WS to each attendee
```

## Redis Usage Patterns

```
# Namespaces
nexustickets:session:{token_jti}     → JWT refresh token (TTL = refresh expiry)
nexustickets:ratelimit:auth:{ip}     → sliding window counter (TTL = 1 min)
nexustickets:unread:{user_id}        → unread message count (INT)
nexustickets:rec:{user_id}           → cached recommendation list (TTL = 1h)
nexustickets:capacity_lock:{event_id}→ distributed lock for booking (TTL = 5s)
```

### Redis Unread Count Pattern (Requirement 10)
```
On message send:
  INCR nexustickets:unread:{recipient_id}
  → WebSocket hub broadcasts WSTypeUnreadCount to recipient

On messages read (open inbox):
  SET nexustickets:unread:{user_id} 0
  → Redux state updated to 0

On GET /messages/unread-count:
  GET nexustickets:unread:{user_id}  (fallback: COUNT from DB)
```

## Migration Rules
- File naming: `000001_create_users.up.sql` / `.down.sql`
- Never edit a migration already run — create a new one
- Idempotent where possible (`CREATE TABLE IF NOT EXISTS`)
- Run `migrate.Up()` at startup before traffic is accepted

## GORM-Specific Rules
- `db.WithContext(ctx)` on EVERY query
- `db.Transaction(func(tx *gorm.DB) error { ... })` for multi-step writes
- Never `Preload("*")` — always explicit preloads
- Row-level locking: `db.Set("gorm:query_option", "FOR UPDATE").First(&model)`
