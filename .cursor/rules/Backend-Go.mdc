---
description: Go backend rules — Fiber v2, GORM, Wire, PostgreSQL, WebSocket
globs: ["backend/**/*.go"]
alwaysApply: false
---

# Go Backend Rules

## Framework & Library Versions (pin these)
- **Go**: 1.22+
- **Fiber**: `github.com/gofiber/fiber/v2` v2.52+
- **Fiber WebSocket**: `github.com/gofiber/websocket/v2`
- **GORM**: `gorm.io/gorm` + `gorm.io/driver/postgres`
- **Wire**: `github.com/google/wire` for DI
- **JWT**: `github.com/golang-jwt/jwt/v5`
- **Validator**: `github.com/go-playground/validator/v10`
- **Redis**: `github.com/redis/go-redis/v9`
- **Migrate**: `github.com/golang-migrate/migrate/v4`
- **Zap**: `go.uber.org/zap` for structured logging
- **Testify**: `github.com/stretchr/testify` for tests
- **Cron**: `github.com/robfig/cron/v3` for recommendation retraining

## Project Layout (Clean Architecture)
```
internal/
  domain/
    entities/       # Event, User, Booking, TicketType, Message …
    valueobjects/   # BookingStatus, EventStatus, UserRole …
    errors.go
  repository/
    interfaces.go
    postgres/
  service/
    interfaces.go
    event_service.go
    booking_service.go
    user_service.go
    messaging_service.go
    recommendation/
      model.go
      train.go
      predict.go
      coldstart.go
      scheduler.go
  handler/
    v1/
      event_handler.go
      booking_handler.go
      auth_handler.go
      admin_handler.go
      messaging_handler.go   # REST: inbox, sent, delete
    ws/
      hub.go                 # WebSocket connection hub
      client.go              # individual WebSocket client
      messaging_ws.go        # WebSocket upgrade + message broadcast
  middleware/
    auth.go
    ws_auth.go               # JWT auth for WebSocket handshake
    ratelimit.go
    logger.go
    cors.go
  dto/
    request/
    response/
```

## Domain Entities — Style Rules
```go
// GOOD — domain entity, no framework tags
type Event struct {
    ID          uuid.UUID
    Title       string
    Status      EventStatus
    Organizer   User
    TicketTypes []TicketType
    Bookings    []Booking
    CreatedAt   time.Time
    UpdatedAt   time.Time
}

// GOOD — GORM model in repository layer only
type EventModel struct {
    ID    uuid.UUID `gorm:"type:uuid;primaryKey"`
    Title string    `gorm:"not null;size:255"`
}

// BAD — GORM tags in domain entity
```

## Handler Rules
```go
// ALWAYS use DTO structs — never bind directly to domain entities
type CreateEventRequest struct {
    Title       string    `json:"title"       validate:"required,min=3,max=255"`
    Description string    `json:"description" validate:"required"`
    StartAt     time.Time `json:"start_at"    validate:"required"`
}

// ALWAYS validate before doing anything
func (h *EventHandler) CreateEvent(c *fiber.Ctx) error {
    var req dto.CreateEventRequest
    if err := c.BodyParser(&req); err != nil {
        return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
    }
    if err := h.validator.Struct(&req); err != nil {
        return fiber.NewError(fiber.StatusUnprocessableEntity, err.Error())
    }
    // ...
}

// ALWAYS use fiber.NewError for HTTP errors — never panic
```

## WebSocket Architecture (Requirement 10)

### Hub Pattern
```go
// handler/ws/hub.go
type Hub struct {
    // userID → set of clients (one user can have multiple tabs)
    clients    map[uuid.UUID]map[*Client]bool
    broadcast  chan *WSMessage
    register   chan *Client
    unregister chan *Client
    mu         sync.RWMutex
}

func (h *Hub) Run() {
    for {
        select {
        case client := <-h.register:
            h.mu.Lock()
            if h.clients[client.UserID] == nil {
                h.clients[client.UserID] = make(map[*Client]bool)
            }
            h.clients[client.UserID][client] = true
            h.mu.Unlock()

        case client := <-h.unregister:
            h.mu.Lock()
            if clients, ok := h.clients[client.UserID]; ok {
                delete(clients, client)
                if len(clients) == 0 {
                    delete(h.clients, client.UserID)
                }
            }
            h.mu.Unlock()
            close(client.Send)

        case msg := <-h.broadcast:
            h.mu.RLock()
            if clients, ok := h.clients[msg.RecipientID]; ok {
                for client := range clients {
                    select {
                    case client.Send <- msg:
                    default:
                        close(client.Send)
                        delete(h.clients[msg.RecipientID], client)
                    }
                }
            }
            h.mu.RUnlock()
        }
    }
}
```

### Client
```go
// handler/ws/client.go
type Client struct {
    UserID uuid.UUID
    Hub    *Hub
    Conn   *websocket.Conn
    Send   chan *WSMessage
}

const (
    writeWait  = 10 * time.Second
    pongWait   = 60 * time.Second
    pingPeriod = (pongWait * 9) / 10
    maxMsgSize = 4096
)

func (c *Client) ReadPump() {
    defer func() {
        c.Hub.unregister <- c
        c.Conn.Close()
    }()
    c.Conn.SetReadLimit(maxMsgSize)
    c.Conn.SetReadDeadline(time.Now().Add(pongWait))
    c.Conn.SetPongHandler(func(string) error {
        c.Conn.SetReadDeadline(time.Now().Add(pongWait))
        return nil
    })
    for {
        var msg IncomingWSMessage
        if err := c.Conn.ReadJSON(&msg); err != nil {
            break
        }
        // handle incoming message types
    }
}

func (c *Client) WritePump() {
    ticker := time.NewTicker(pingPeriod)
    defer func() {
        ticker.Stop()
        c.Conn.Close()
    }()
    for {
        select {
        case msg, ok := <-c.Send:
            c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
            if !ok {
                c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
                return
            }
            c.Conn.WriteJSON(msg)
        case <-ticker.C:
            c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
            if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
                return
            }
        }
    }
}
```

### WebSocket Upgrade Handler
```go
// handler/ws/messaging_ws.go
// Route: GET /api/v1/ws/messages?token=<jwt>
func (h *MessagingWSHandler) Handle(c *websocket.Conn) {
    userID := c.Locals("userID").(uuid.UUID)
    client := &Client{
        UserID: userID,
        Hub:    h.hub,
        Conn:   c,
        Send:   make(chan *WSMessage, 256),
    }
    h.hub.register <- client
    go client.WritePump()
    client.ReadPump()
}
```

### WebSocket Auth Middleware
```go
// middleware/ws_auth.go
// JWT passed as query param because browsers cannot set custom headers on WebSocket upgrade
func WSAuth(secret string) fiber.Handler {
    return func(c *fiber.Ctx) error {
        token := c.Query("token")
        if token == "" {
            return fiber.ErrUnauthorized
        }
        claims, err := parseJWT(token, secret)
        if err != nil {
            return fiber.ErrUnauthorized
        }
        c.Locals("userID", claims.UserID)
        c.Locals("role", claims.Role)
        return c.Next()
    }
}
```

### WebSocket Message Envelope
```go
// All WS messages follow this shape
type WSMessage struct {
    Type        string          `json:"type"`        // "new_message" | "message_deleted" | "unread_count" | "error"
    Payload     json.RawMessage `json:"payload"`
    RecipientID uuid.UUID       `json:"-"`           // routing only, not sent to client
}

// Message types
const (
    WSTypeNewMessage    = "new_message"
    WSTypeDeleted       = "message_deleted"
    WSTypeUnreadCount   = "unread_count"
    WSTypeError         = "error"
)
```

### Sending a Message Flow
```
POST /api/v1/messages
  → messaging_service.SendMessage()
      → INSERT into messages table
      → hub.broadcast <- WSMessage{Type: "new_message", RecipientID: recipientID, Payload: messageJSON}
      → Redis INCR nexustickets:unread:{recipientID}
      → hub.broadcast <- WSMessage{Type: "unread_count", RecipientID: recipientID, Payload: {count: N}}
```

## Service Layer Rules
- Services MUST NOT import Fiber or any HTTP framework
- Services MUST NOT import GORM directly — only repository interfaces
- `MessagingService` takes a `Hub` dependency to broadcast after DB write
```go
type MessagingService struct {
    msgRepo  repository.MessageRepository
    userRepo repository.UserRepository
    hub      *ws.Hub
    redis    *redis.Client
}
```

## Repository Rules
- All DB operations accept `context.Context` as first parameter
- Use `db.WithContext(ctx)` on every GORM call
- Transactions for any multi-table write
- Never return GORM-specific errors to service layer — wrap them

## Error Handling Rules
```go
// domain/errors.go
var (
    ErrNotFound          = errors.New("not found")
    ErrUnauthorized      = errors.New("unauthorized")
    ErrForbidden         = errors.New("forbidden")
    ErrEventNotBookable  = errors.New("event is not open for booking")
    ErrCapacityExceeded  = errors.New("requested tickets exceed available capacity")
    ErrUsernameTaken     = errors.New("username already taken")
    ErrEmailTaken        = errors.New("email already taken")
    ErrEventNotDeletable = errors.New("event cannot be deleted after first booking")
    ErrEventNotCancellable = errors.New("event cannot be cancelled in current state")
)
```

## Authentication & Authorization
```go
func RequireRole(roles ...domain.UserRole) fiber.Handler {
    return func(c *fiber.Ctx) error {
        claims := c.Locals("user").(*jwt.Claims)
        for _, r := range roles {
            if claims.Role == r { return c.Next() }
        }
        return fiber.ErrForbidden
    }
}
```

## Capacity Management (Requirement 7d, 9)
- Atomic decrement: `UPDATE ticket_types SET available = available - $1 WHERE id = $2 AND available >= $1`
- If 0 rows affected → return `ErrCapacityExceeded`
- Validate sum of ticket type quantities ≤ event capacity on every create/update

## Event Lifecycle (Requirement 7c)
```
DRAFT → PUBLISHED → COMPLETED
                 ↘ CANCELLED
```
- DELETE only allowed in DRAFT or PUBLISHED with zero bookings
- CANCEL only allowed in PUBLISHED — sets status to CANCELLED, keeps all data
- On CANCEL: send bulk WebSocket + DB message to all attendees with bookings

## XML Export (Requirement 12)
- Struct tags must match assignment DTD exactly
- Streaming via `xml.Encoder` — never buffer all records
- EventID format: "EV" + UUID or sequential ID

## Recommendation Engine (Requirement 13)
- Implemented from scratch in `service/recommendation/`
- Biased Matrix Factorization: R̂(u,i) = μ + b_u + b_i + P_u · Q_i^T
- Train from bookings + views; cold-start fallback uses popularity + recency
- Retrain every 6h via cron; atomic model swap with `sync.RWMutex`

## Logging
```go
// Always structured, never fmt.Println
logger.Info("message sent via websocket",
    zap.String("sender_id", senderID.String()),
    zap.String("recipient_id", recipientID.String()),
)
logger.Error("ws broadcast failed", zap.Error(err))
```

## Database Migrations
- Numbered SQL files: `000001_init.up.sql` / `.down.sql`
- Never use `AutoMigrate` in production
- Run `migrate.Up()` at startup before server accepts traffic
