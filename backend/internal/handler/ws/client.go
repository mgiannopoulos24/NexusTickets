package ws

import (
	"time"

	fiberws "github.com/gofiber/websocket/v2"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
)

// InboundHandler receives an application frame sent by a client. It runs on the
// connection's read goroutine, so it must not block.
type InboundHandler func(senderID uuid.UUID, frame []byte)

// Client wraps one WebSocket connection for a single authenticated user.
type Client struct {
	hub     *Hub
	conn    *fiberws.Conn
	userID  uuid.UUID
	send    chan []byte
	inbound InboundHandler
}

// OnInbound registers the handler for frames this client sends. Without one the
// connection stays receive-only, as it was before typing notifications.
func (c *Client) OnInbound(h InboundHandler) {
	c.inbound = h
}

// NewClient builds a client for the hub; the caller must register it with the hub before starting pumps.
func NewClient(hub *Hub, conn *fiberws.Conn, userID uuid.UUID) *Client {
	return &Client{
		hub:    hub,
		conn:   conn,
		userID: userID,
		send:   make(chan []byte, 256),
	}
}

// ReadPump reads from the client until the connection closes or errors.
// Application frames go to the inbound handler when one is registered.
func (c *Client) ReadPump() {
	defer func() {
		c.hub.unregister <- c
		_ = c.conn.Close()
	}()

	c.conn.SetReadLimit(MaxMessageBytes)
	if err := c.conn.SetReadDeadline(time.Now().Add(pongWait)); err != nil {
		return
	}
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		_, frame, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
		// Any traffic proves the peer is alive, so extend the read deadline
		// rather than relying on pongs alone.
		if err := c.conn.SetReadDeadline(time.Now().Add(pongWait)); err != nil {
			break
		}
		if c.inbound != nil && len(frame) > 0 {
			c.inbound(c.userID, frame)
		}
	}
}

// WritePump sends queued messages and periodic ping frames.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		_ = c.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			if !ok {
				_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
				_ = c.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
				return
			}
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
