// Package integration drives the API end to end: real routes and middleware,
// real services, real Postgres and Redis. The unit tests fake the
// repositories; these are what exercise the SQL.
//
// The suite needs a Postgres it may create databases on, named by
// TEST_DATABASE_URL (for example postgres://test:test@localhost:55432/test).
// Without it every test here is skipped. Redis is read from TEST_REDIS_ADDR
// (default localhost:6379), using a database of its own that is flushed.
package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	redisv9 "github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"nexustickets/internal/config"
	"nexustickets/internal/db"
	"nexustickets/internal/domain"
	"nexustickets/internal/middleware"
	"nexustickets/internal/repository"
	pgrepo "nexustickets/internal/repository/postgres"
	"nexustickets/internal/service"
	"nexustickets/internal/wire"
)

// redisTestDB keeps the suite's keys (sessions, unread counters, rate-limit
// windows) away from the database the service tests use.
const redisTestDB = 9

const jwtSecret = "integration-test-secret-integration-test-secret"

// env is the running stack, shared by every test in the package. Tests make
// their own users and events, so they do not depend on each other's data.
type env struct {
	app   *fiber.App
	gorm  *gorm.DB
	redis *redisv9.Client
	deps  *wire.AppDependencies
	auth  *service.AuthService
	users repository.UserRepository
}

var (
	stack     *env
	skipWhy   string
	passwordH string
	seq       atomic.Int64
)

const password = "Secret-pass1"

func TestMain(m *testing.M) {
	os.Exit(run(m))
}

func run(m *testing.M) int {
	flag.Parse() // testing.Short needs the flags; m.Run would parse them later
	adminURL := os.Getenv("TEST_DATABASE_URL")
	if adminURL == "" || testing.Short() {
		skipWhy = "TEST_DATABASE_URL is not set"
		return m.Run()
	}

	dbName := fmt.Sprintf("nexustickets_it_%d", time.Now().UnixNano())
	admin, err := gorm.Open(postgres.Open(adminURL), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		fmt.Fprintln(os.Stderr, "integration: connect:", err)
		return 1
	}
	if err := admin.Exec("CREATE DATABASE " + dbName).Error; err != nil {
		fmt.Fprintln(os.Stderr, "integration: create database:", err)
		return 1
	}
	defer func() {
		_ = admin.Exec("DROP DATABASE IF EXISTS " + dbName + " WITH (FORCE)").Error
		if sqlDB, err := admin.DB(); err == nil {
			_ = sqlDB.Close()
		}
	}()

	u, err := url.Parse(adminURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, "integration: parse TEST_DATABASE_URL:", err)
		return 1
	}
	u.Path = "/" + dbName
	gdb, err := gorm.Open(postgres.Open(u.String()), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		fmt.Fprintln(os.Stderr, "integration: connect test database:", err)
		return 1
	}
	if err := db.AutoMigrate(gdb); err != nil {
		fmt.Fprintln(os.Stderr, "integration: migrate:", err)
		return 1
	}

	addr := os.Getenv("TEST_REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379"
	}
	rdb := redisv9.NewClient(&redisv9.Options{Addr: addr, Password: os.Getenv("REDIS_PASSWORD"), DB: redisTestDB})
	if err := rdb.FlushDB(context.Background()).Err(); err != nil {
		fmt.Fprintln(os.Stderr, "integration: redis:", err)
		return 1
	}
	defer func() {
		_ = rdb.FlushDB(context.Background()).Err()
		_ = rdb.Close()
	}()

	media, err := os.MkdirTemp("", "nexustickets-it-media-")
	if err != nil {
		fmt.Fprintln(os.Stderr, "integration: media dir:", err)
		return 1
	}
	defer func() { _ = os.RemoveAll(media) }()

	cfg := config.Config{AppEnv: "development", JWTSecret: jwtSecret, MediaStoragePath: media}
	deps, err := wire.InitializeApp(gdb, rdb, cfg)
	if err != nil {
		fmt.Fprintln(os.Stderr, "integration: wire:", err)
		return 1
	}
	go deps.Hub.Run()

	app := fiber.New(fiber.Config{ErrorHandler: middleware.ErrorHandler(zap.NewNop()), DisableStartupMessage: true})
	deps.RegisterRoutes(app.Group("/api/v1"), cfg, rdb)

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		return 1
	}
	passwordH = string(hash)

	userRepo := pgrepo.NewUserRepositoryPostgres(gdb)
	stack = &env{
		app:   app,
		gorm:  gdb,
		redis: rdb,
		deps:  deps,
		auth:  service.NewAuthService(userRepo, rdb, jwtSecret),
		users: userRepo,
	}
	return m.Run()
}

// setup returns the shared stack, or skips the test when there is none.
func setup(t *testing.T) *env {
	t.Helper()
	if testing.Short() {
		t.Skip("integration tests skipped in -short mode")
	}
	if stack == nil {
		t.Skip("integration tests skipped: " + skipWhy)
	}
	return stack
}

// unique gives names that do not collide between tests.
func unique(prefix string) string {
	return fmt.Sprintf("%s%d", prefix, seq.Add(1))
}

// user is an approved account with a signed-in session.
type user struct {
	domain.User
	token string
}

// newUser stores an approved user of the given role and signs them in.
func (e *env) newUser(t *testing.T, role domain.UserRole) user {
	t.Helper()
	name := unique(string(role))
	u, err := e.users.Create(context.Background(), domain.User{
		Username:      name,
		PasswordHash:  passwordH,
		FirstName:     "Test",
		LastName:      strings.ToUpper(name[:1]) + name[1:],
		Email:         name + "@example.com",
		Role:          role,
		AccountStatus: domain.AccountStatusApproved,
	})
	if err != nil {
		t.Fatalf("create %s: %v", role, err)
	}
	session, err := e.auth.Login(context.Background(), name, password)
	if err != nil {
		t.Fatalf("login %s: %v", name, err)
	}
	return user{User: u, token: session.AccessToken}
}

// reply is a decoded API envelope.
type reply struct {
	status int
	// body is the response as sent, for the endpoints that do not answer
	// with an envelope (the catalogue exports).
	body  []byte
	Data  json.RawMessage `json:"data"`
	Error *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
	Meta json.RawMessage `json:"meta"`
}

// into decodes the envelope's data.
func (r reply) into(t *testing.T, v any) {
	t.Helper()
	if err := json.Unmarshal(r.Data, v); err != nil {
		t.Fatalf("decode %s: %v", r.Data, err)
	}
}

func (r reply) errCode() string {
	if r.Error == nil {
		return ""
	}
	return r.Error.Code
}

// call sends one request as the given user ("" for a guest).
func (e *env) call(t *testing.T, method, path, token string, body any) reply {
	t.Helper()
	var rd io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("encode body: %v", err)
		}
		rd = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, rd)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := e.app.Test(req, 15000)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	defer func() { _ = res.Body.Close() }()
	raw, _ := io.ReadAll(res.Body)

	out := reply{status: res.StatusCode, body: raw}
	if len(raw) > 0 && strings.HasPrefix(res.Header.Get("Content-Type"), "application/json") {
		if err := json.Unmarshal(raw, &out); err != nil {
			t.Fatalf("%s %s: decode %q: %v", method, path, raw, err)
		}
	} else {
		out.Data = raw
	}
	return out
}

// must fails the test unless the reply has the wanted status.
func must(t *testing.T, r reply, want int) reply {
	t.Helper()
	if r.status != want {
		msg := string(r.Data)
		if r.Error != nil {
			msg = r.Error.Code + ": " + r.Error.Message
		}
		t.Fatalf("status %d, want %d (%s)", r.status, want, msg)
	}
	return r
}

type ticketTypeJSON struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Quantity  int     `json:"quantity"`
	Available int     `json:"available"`
}

type eventJSON struct {
	ID          string           `json:"id"`
	Title       string           `json:"title"`
	Status      string           `json:"status"`
	TicketTypes []ticketTypeJSON `json:"ticket_types"`
}

type bookingJSON struct {
	ID            string  `json:"id"`
	EventID       string  `json:"event_id"`
	TicketTypeID  string  `json:"ticket_type_id"`
	Quantity      int     `json:"quantity"`
	TotalCost     float64 `json:"total_cost"`
	Status        string  `json:"status"`
	ConfirmedAt   *string `json:"confirmed_at"`
	HoldExpiresAt *string `json:"hold_expires_at"`
}

type eventSpec struct {
	title, city, venue string
	tickets            int
	price              float64
	start              time.Time
}

// publishedEvent creates and publishes an event with one ticket type.
func (e *env) publishedEvent(t *testing.T, org user, spec eventSpec) eventJSON {
	t.Helper()
	if spec.title == "" {
		spec.title = unique("Εκδήλωση ")
	}
	if spec.city == "" {
		spec.city = "Αθήνα"
	}
	if spec.venue == "" {
		spec.venue = "Θέατρο Πόλης"
	}
	if spec.tickets == 0 {
		spec.tickets = 10
	}
	if spec.start.IsZero() {
		spec.start = time.Now().Add(30 * 24 * time.Hour)
	}
	created := must(t, e.call(t, http.MethodPost, "/api/v1/events/organizer", org.token, map[string]any{
		"title":       spec.title,
		"description": "Περιγραφή της εκδήλωσης " + spec.title,
		"venue":       spec.venue,
		"event_type":  "concert",
		"city":        spec.city,
		"start_at":    spec.start.UTC().Format(time.RFC3339),
		"end_at":      spec.start.Add(2 * time.Hour).UTC().Format(time.RFC3339),
		"capacity":    spec.tickets,
		"categories":  []string{"Μουσική"},
		"ticket_types": []map[string]any{
			{"name": "Κανονικό", "price": spec.price, "quantity": spec.tickets},
		},
	}), http.StatusCreated)
	var ev eventJSON
	created.into(t, &ev)

	must(t, e.call(t, http.MethodPatch, "/api/v1/events/organizer/"+ev.ID+"/publish", org.token, nil), http.StatusOK).into(t, &ev)
	if ev.Status != string(domain.EventStatusPublished) {
		t.Fatalf("event status %s after publish", ev.Status)
	}
	return ev
}

// available reads the seats left on an event's first ticket type.
func (e *env) available(t *testing.T, eventID string) int {
	t.Helper()
	var ev eventJSON
	must(t, e.call(t, http.MethodGet, "/api/v1/events/"+eventID, "", nil), http.StatusOK).into(t, &ev)
	return ev.TicketTypes[0].Available
}

// hold books seats and returns the pending booking.
func (e *env) hold(t *testing.T, who user, ev eventJSON, qty int) bookingJSON {
	t.Helper()
	var b bookingJSON
	must(t, e.call(t, http.MethodPost, "/api/v1/bookings", who.token, map[string]any{
		"event_id":       ev.ID,
		"ticket_type_id": ev.TicketTypes[0].ID,
		"quantity":       qty,
	}), http.StatusCreated).into(t, &b)
	return b
}

// ageBooking moves a booking's creation time into the past.
func (e *env) ageBooking(t *testing.T, bookingID string, by time.Duration) {
	t.Helper()
	err := e.gorm.Exec(`UPDATE bookings SET created_at = created_at - make_interval(secs => ?) WHERE id = ?`,
		by.Seconds(), uuid.MustParse(bookingID)).Error
	if err != nil {
		t.Fatalf("age booking: %v", err)
	}
}
