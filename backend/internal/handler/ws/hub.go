package ws

import (
	"sync"

	"github.com/google/uuid"
)

// Hub tracks authenticated WebSocket clients per user and delivers outbound frames.
type Hub struct {
	mu sync.RWMutex
	// clients maps a user to all active connections for that user.
	clients map[uuid.UUID]map[*Client]struct{}

	register   chan *Client
	unregister chan *Client
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[uuid.UUID]map[*Client]struct{}),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run processes client registration until the hub is no longer needed.
func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			set, ok := h.clients[c.userID]
			if !ok {
				set = make(map[*Client]struct{})
				h.clients[c.userID] = set
			}
			set[c] = struct{}{}
			h.mu.Unlock()

		case c := <-h.unregister:
			h.mu.Lock()
			if set, ok := h.clients[c.userID]; ok {
				delete(set, c)
				if len(set) == 0 {
					delete(h.clients, c.userID)
				}
			}
			h.mu.Unlock()
			close(c.send)
		}
	}
}

// Register queues a client for tracking; the hub must be running (see Run).
func (h *Hub) Register(c *Client) {
	h.register <- c
}

// SendToUser delivers a text frame to every open connection for the given user.
func (h *Hub) SendToUser(userID uuid.UUID, payload []byte) {
	// The lock is held while sending: Run removes a client under the write
	// lock before closing its channel, so every channel seen here is open.
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients[userID] {
		select {
		case c.send <- payload:
		default:
		}
	}
}
