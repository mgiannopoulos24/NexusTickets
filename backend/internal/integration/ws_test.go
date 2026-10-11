package integration

import (
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/url"
	"sync"
	"testing"
	"time"

	"github.com/fasthttp/websocket"

	"nexustickets/internal/domain"
)

// The WebSocket needs a real listener; app.Test only speaks plain HTTP. It is
// started once, on a free port, the first time a test asks for it.
var (
	listenOnce sync.Once
	listenAddr string
	listenErr  error
)

func (e *env) serve(t *testing.T) string {
	t.Helper()
	listenOnce.Do(func() {
		ln, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			listenErr = err
			return
		}
		listenAddr = ln.Addr().String()
		go func() { _ = e.app.Listener(ln) }()
	})
	if listenErr != nil {
		t.Fatalf("listen: %v", listenErr)
	}
	return listenAddr
}

// socket is one user's open mailbox connection.
type socket struct {
	t    *testing.T
	conn *websocket.Conn
}

type wsFrame struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

func (e *env) dial(t *testing.T, token string) (*websocket.Conn, *http.Response, error) {
	t.Helper()
	u := url.URL{Scheme: "ws", Host: e.serve(t), Path: "/api/v1/ws/messages", RawQuery: "token=" + url.QueryEscape(token)}
	return websocket.DefaultDialer.Dial(u.String(), nil)
}

func (e *env) connect(t *testing.T, who user) *socket {
	t.Helper()
	conn, _, err := e.dial(t, who.token)
	if err != nil {
		t.Fatalf("connect %s: %v", who.Username, err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	// The hub registers the client asynchronously; give it a moment so the
	// first push is not sent before the connection is known.
	time.Sleep(100 * time.Millisecond)
	return &socket{t: t, conn: conn}
}

// next waits for the next frame of the given type, skipping any others.
func (s *socket) next(typ string) json.RawMessage {
	s.t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for {
		_ = s.conn.SetReadDeadline(deadline)
		_, data, err := s.conn.ReadMessage()
		if err != nil {
			s.t.Fatalf("waiting for %q: %v", typ, err)
		}
		var f wsFrame
		if err := json.Unmarshal(data, &f); err != nil {
			s.t.Fatalf("frame is not JSON: %v\n%s", err, data)
		}
		if f.Type == typ {
			return f.Payload
		}
	}
}

func (s *socket) unread() int {
	s.t.Helper()
	var p struct {
		Count int `json:"count"`
	}
	if err := json.Unmarshal(s.next("unread_count"), &p); err != nil {
		s.t.Fatalf("unread payload: %v", err)
	}
	return p.Count
}

func TestWebSocket_DeliversMessagesLive(t *testing.T) {
	e := setup(t)
	org := e.newUser(t, domain.UserRoleOrganizer)
	fan := e.newUser(t, domain.UserRoleAttendee)
	ev := e.publishedEvent(t, org, eventSpec{})
	b := e.hold(t, fan, ev, 1)
	must(t, e.call(t, http.MethodPatch, "/api/v1/bookings/"+b.ID+"/confirm", fan.token, nil), http.StatusOK)

	inbox := e.connect(t, org)

	var sent struct {
		ID string `json:"id"`
	}
	must(t, e.call(t, http.MethodPost, "/api/v1/messages", fan.token, map[string]any{
		"recipient_id": org.ID.String(),
		"event_id":     ev.ID,
		"subject":      "Στάθμευση",
		"body":         "Υπάρχει χώρος στάθμευσης;",
	}), http.StatusCreated).into(t, &sent)

	var got struct {
		ID       string `json:"id"`
		SenderID string `json:"sender_id"`
		Subject  string `json:"subject"`
	}
	if err := json.Unmarshal(inbox.next("new_message"), &got); err != nil {
		t.Fatalf("new_message payload: %v", err)
	}
	if got.ID != sent.ID || got.SenderID != fan.ID.String() || got.Subject != "Στάθμευση" {
		t.Fatalf("pushed message %+v, sent %s", got, sent.ID)
	}
	if n := inbox.unread(); n != 1 {
		t.Fatalf("unread after one message: %d", n)
	}

	// Opening the message marks it read, and the badge follows.
	must(t, e.call(t, http.MethodGet, "/api/v1/messages/"+sent.ID, org.token, nil), http.StatusOK)
	if n := inbox.unread(); n != 0 {
		t.Fatalf("unread after reading: %d", n)
	}
}

func TestWebSocket_CancellationNoticeReachesEveryBooker(t *testing.T) {
	e := setup(t)
	org := e.newUser(t, domain.UserRoleOrganizer)
	ev := e.publishedEvent(t, org, eventSpec{tickets: 10})

	var fans []*socket
	for i := 0; i < 3; i++ {
		fan := e.newUser(t, domain.UserRoleAttendee)
		b := e.hold(t, fan, ev, 1)
		must(t, e.call(t, http.MethodPatch, "/api/v1/bookings/"+b.ID+"/confirm", fan.token, nil), http.StatusOK)
		fans = append(fans, e.connect(t, fan))
	}

	must(t, e.call(t, http.MethodPatch, "/api/v1/events/organizer/"+ev.ID+"/cancel", org.token, nil), http.StatusOK)

	for i, s := range fans {
		var got struct {
			SenderID string  `json:"sender_id"`
			EventID  *string `json:"event_id"`
		}
		if err := json.Unmarshal(s.next("new_message"), &got); err != nil {
			t.Fatalf("fan %d: payload: %v", i, err)
		}
		if got.SenderID != org.ID.String() || got.EventID == nil || *got.EventID != ev.ID {
			t.Fatalf("fan %d got %+v", i, got)
		}
		if n := s.unread(); n != 1 {
			t.Fatalf("fan %d unread: %d", i, n)
		}
	}
}

func TestWebSocket_RefusesBadTokens(t *testing.T) {
	e := setup(t)
	for name, token := range map[string]string{"missing": "", "garbage": "not-a-jwt"} {
		conn, res, err := e.dial(t, token)
		if conn != nil {
			_ = conn.Close()
		}
		if !errors.Is(err, websocket.ErrBadHandshake) || res == nil || res.StatusCode != http.StatusUnauthorized {
			status := 0
			if res != nil {
				status = res.StatusCode
			}
			t.Errorf("%s token: err=%v status=%d, want a 401 handshake", name, err, status)
		}
	}
}
