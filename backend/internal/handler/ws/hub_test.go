package ws

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestHub_RegisterAndUnregister(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	userID := uuid.New()
	client := NewClient(hub, nil, userID)
	hub.Register(client)

	// Give hub time to process registration
	time.Sleep(10 * time.Millisecond)

	hub.mu.RLock()
	set, exists := hub.clients[userID]
	hub.mu.RUnlock()
	if !exists {
		t.Fatal("expected client to be registered")
	}
	if _, ok := set[client]; !ok {
		t.Fatal("expected client to be in set")
	}

	hub.unregister <- client
	time.Sleep(10 * time.Millisecond)

	hub.mu.RLock()
	set, exists = hub.clients[userID]
	hub.mu.RUnlock()
	if exists {
		t.Fatal("expected client to be unregistered")
	}
	if set != nil {
		t.Fatal("expected nil set")
	}
}

func TestHub_SendToUser(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	userID := uuid.New()
	send := make(chan []byte, 10)

	client := &Client{
		hub:    hub,
		conn:   nil,
		userID: userID,
		send:   send,
	}

	hub.Register(client)
	time.Sleep(10 * time.Millisecond)

	payload := []byte("hello")
	hub.SendToUser(userID, payload)

	select {
	case msg := <-send:
		if string(msg) != "hello" {
			t.Fatalf("expected 'hello', got %s", string(msg))
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for message")
	}
}

func TestHub_SendToUserNoClients(t *testing.T) {
	hub := NewHub()
	// Don't start Run() - SendToUser should not block
	done := make(chan struct{})
	go func() {
		hub.SendToUser(uuid.New(), []byte("test"))
		close(done)
	}()
	select {
	case <-done:
		// success - didn't block
	case <-time.After(time.Second):
		t.Fatal("SendToUser blocked when hub not running")
	}
}

func TestHub_MultipleClientsPerUser(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	userID := uuid.New()
	send1 := make(chan []byte, 10)
	send2 := make(chan []byte, 10)

	c1 := &Client{hub: hub, conn: nil, userID: userID, send: send1}
	c2 := &Client{hub: hub, conn: nil, userID: userID, send: send2}

	hub.Register(c1)
	hub.Register(c2)
	time.Sleep(10 * time.Millisecond)

	hub.SendToUser(userID, []byte("broadcast"))

	select {
	case <-send1:
	default:
		t.Fatal("c1 should have received the message")
	}
	select {
	case <-send2:
	default:
		t.Fatal("c2 should have received the message")
	}
}

func TestHub_SendToUserBlockedClient(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	userID := uuid.New()
	// Create a client with a full buffer (size 1, already has a message)
	send := make(chan []byte, 1)
	send <- []byte("stuck")

	client := &Client{hub: hub, conn: nil, userID: userID, send: send}
	hub.Register(client)
	time.Sleep(10 * time.Millisecond)

	// This should not block because of the default case in the select
	hub.SendToUser(userID, []byte("new message"))
}
