package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"nexustickets/internal/domain"
)

type mockUserRepo struct {
	users map[string]domain.User
	byID  map[uuid.UUID]domain.User
}

func newMockUserRepo() *mockUserRepo {
	return &mockUserRepo{
		users: make(map[string]domain.User),
		byID:  make(map[uuid.UUID]domain.User),
	}
}

func (m *mockUserRepo) add(u domain.User) {
	m.byID[u.ID] = u
	m.users[u.Username] = u
	m.users[u.Email] = u
}

func (m *mockUserRepo) GetByID(_ context.Context, id uuid.UUID) (domain.User, error) {
	u, ok := m.byID[id]
	if !ok {
		return domain.User{}, domain.ErrNotFound
	}
	return u, nil
}

func (m *mockUserRepo) GetByUsername(_ context.Context, username string) (domain.User, error) {
	u, ok := m.users[username]
	if !ok {
		return domain.User{}, domain.ErrNotFound
	}
	return u, nil
}

func (m *mockUserRepo) GetByEmail(_ context.Context, email string) (domain.User, error) {
	u, ok := m.users[email]
	if !ok {
		return domain.User{}, domain.ErrNotFound
	}
	return u, nil
}

func (m *mockUserRepo) Create(_ context.Context, user domain.User) (domain.User, error) {
	user.ID = uuid.New()
	user.CreatedAt = time.Now().UTC()
	user.UpdatedAt = time.Now().UTC()
	m.add(user)
	return user, nil
}

func (m *mockUserRepo) UpdateProfile(_ context.Context, user domain.User) (domain.User, error) {
	m.byID[user.ID] = user
	m.users[user.Username] = user
	m.users[user.Email] = user
	return user, nil
}

func (m *mockUserRepo) Approve(_ context.Context, id uuid.UUID) (domain.User, error) {
	u, ok := m.byID[id]
	if !ok {
		return domain.User{}, domain.ErrNotFound
	}
	u.AccountStatus = domain.AccountStatusApproved
	m.add(u)
	return u, nil
}

func (m *mockUserRepo) Reject(_ context.Context, id uuid.UUID) (domain.User, error) {
	u, ok := m.byID[id]
	if !ok {
		return domain.User{}, domain.ErrNotFound
	}
	u.AccountStatus = domain.AccountStatusRejected
	m.add(u)
	return u, nil
}

func (m *mockUserRepo) SetRole(_ context.Context, id uuid.UUID, role domain.UserRole) (domain.User, error) {
	u, ok := m.byID[id]
	if !ok {
		return domain.User{}, domain.ErrNotFound
	}
	u.Role = role
	m.add(u)
	return u, nil
}

func (m *mockUserRepo) ListByRole(_ context.Context, role domain.UserRole) ([]domain.User, error) {
	var out []domain.User
	for _, u := range m.byID {
		if u.Role == role && u.AccountStatus == domain.AccountStatusApproved {
			out = append(out, u)
		}
	}
	return out, nil
}

func (m *mockUserRepo) List(_ context.Context, limit, offset int) ([]domain.User, error) {
	var out []domain.User
	for _, u := range m.byID {
		out = append(out, u)
	}
	return out, nil
}

func (m *mockUserRepo) ListByIDs(_ context.Context, ids []uuid.UUID) (map[uuid.UUID]domain.User, error) {
	out := make(map[uuid.UUID]domain.User)
	for _, id := range ids {
		if u, ok := m.byID[id]; ok {
			out[id] = u
		}
	}
	return out, nil
}

func TestAuthService_Register(t *testing.T) {
	users := newMockUserRepo()
	svc := &AuthService{users: users, jwtSecret: "test-secret", accessTTL: 15 * time.Minute, refreshTTL: 7 * 24 * time.Hour}

	t.Run("success", func(t *testing.T) {
		user, err := svc.Register(context.Background(), RegisterInput{
			Username:        "newuser",
			Password:        "pass1234",
			ConfirmPassword: "pass1234",
			FirstName:       "John",
			LastName:        "Doe",
			Email:           "john@example.com",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if user.Username != "newuser" {
			t.Fatalf("expected newuser, got %s", user.Username)
		}
		if user.Role != domain.UserRoleAttendee {
			t.Fatalf("expected attendee role, got %s", user.Role)
		}
		if user.AccountStatus != domain.AccountStatusPending {
			t.Fatalf("expected pending status, got %s", user.AccountStatus)
		}
		if user.PasswordHash == "" || user.PasswordHash == "pass1234" {
			t.Fatal("password should be hashed")
		}
	})

	t.Run("password mismatch", func(t *testing.T) {
		_, err := svc.Register(context.Background(), RegisterInput{
			Username:        "user2",
			Password:        "pass1",
			ConfirmPassword: "pass2",
			FirstName:       "A",
			LastName:        "B",
			Email:           "a@b.com",
		})
		if err == nil {
			t.Fatal("expected error for mismatched passwords")
		}
	})

	t.Run("username taken", func(t *testing.T) {
		_, err := svc.Register(context.Background(), RegisterInput{
			Username:        "newuser",
			Password:        "pass1234",
			ConfirmPassword: "pass1234",
			FirstName:       "Jane",
			LastName:        "Doe",
			Email:           "jane@example.com",
		})
		if !errors.Is(err, domain.ErrUsernameTaken) {
			t.Fatalf("expected ErrUsernameTaken, got %v", err)
		}
	})

	t.Run("email taken", func(t *testing.T) {
		_, err := svc.Register(context.Background(), RegisterInput{
			Username:        "unique",
			Password:        "pass1234",
			ConfirmPassword: "pass1234",
			FirstName:       "Jane",
			LastName:        "Doe",
			Email:           "john@example.com",
		})
		if !errors.Is(err, domain.ErrEmailTaken) {
			t.Fatalf("expected ErrEmailTaken, got %v", err)
		}
	})
}

func TestAuthService_LoginValidation(t *testing.T) {
	users := newMockUserRepo()
	svc := &AuthService{users: users, jwtSecret: "test-secret", accessTTL: 15 * time.Minute, refreshTTL: 7 * 24 * time.Hour}

	hash, err := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}

	users.add(domain.User{
		ID:            uuid.New(),
		Username:      "testuser",
		PasswordHash:  string(hash),
		FirstName:     "Test",
		LastName:      "User",
		Email:         "test@example.com",
		Role:          domain.UserRoleAttendee,
		AccountStatus: domain.AccountStatusApproved,
	})

	t.Run("wrong password", func(t *testing.T) {
		_, err := svc.Login(context.Background(), "testuser", "wrong-password")
		if !errors.Is(err, domain.ErrUnauthorized) {
			t.Fatalf("expected ErrUnauthorized, got %v", err)
		}
	})

	t.Run("unknown user", func(t *testing.T) {
		_, err := svc.Login(context.Background(), "unknown", "password")
		if !errors.Is(err, domain.ErrUnauthorized) {
			t.Fatalf("expected ErrUnauthorized, got %v", err)
		}
	})

	t.Run("unapproved user", func(t *testing.T) {
		pendingHash, _ := bcrypt.GenerateFromPassword([]byte("pass"), bcrypt.MinCost)
		users.add(domain.User{
			ID:            uuid.New(),
			Username:      "pendinguser",
			PasswordHash:  string(pendingHash),
			FirstName:     "Pending",
			LastName:      "User",
			Email:         "pending@example.com",
			Role:          domain.UserRoleAttendee,
			AccountStatus: domain.AccountStatusPending,
		})
		_, err := svc.Login(context.Background(), "pendinguser", "pass")
		if !errors.Is(err, domain.ErrForbidden) {
			t.Fatalf("expected ErrForbidden, got %v", err)
		}
	})
}

func TestAuthService_IsUsernameAvailable(t *testing.T) {
	users := newMockUserRepo()
	svc := &AuthService{users: users, jwtSecret: "test-secret", accessTTL: 15 * time.Minute, refreshTTL: 7 * 24 * time.Hour}

	users.add(domain.User{
		ID:       uuid.New(),
		Username: "existing",
		Email:    "existing@example.com",
	})

	t.Run("available", func(t *testing.T) {
		avail, err := svc.IsUsernameAvailable(context.Background(), "newuser")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !avail {
			t.Fatal("expected available = true")
		}
	})

	t.Run("taken", func(t *testing.T) {
		avail, err := svc.IsUsernameAvailable(context.Background(), "existing")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if avail {
			t.Fatal("expected available = false")
		}
	})

	t.Run("empty username", func(t *testing.T) {
		_, err := svc.IsUsernameAvailable(context.Background(), "")
		if err == nil {
			t.Fatal("expected error for empty username")
		}
	})
}
