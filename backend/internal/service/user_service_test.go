package service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"nexustickets/internal/domain"
)

func TestUserService_ListUsers(t *testing.T) {
	users := newMockUserRepo()
	svc := NewUserService(users)

	u1 := domain.User{ID: uuid.New(), Username: "user1", Email: "u1@e.com", Role: domain.UserRoleAttendee, AccountStatus: domain.AccountStatusApproved}
	u2 := domain.User{ID: uuid.New(), Username: "user2", Email: "u2@e.com", Role: domain.UserRoleOrganizer, AccountStatus: domain.AccountStatusPending}
	users.add(u1)
	users.add(u2)

	result, err := svc.ListUsers(context.Background(), 10, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 2 {
		t.Fatalf("expected 2 users, got %d", len(result))
	}
}

func TestUserService_GetUser(t *testing.T) {
	users := newMockUserRepo()
	svc := NewUserService(users)

	u := domain.User{ID: uuid.New(), Username: "testuser", Email: "test@e.com"}
	users.add(u)

	t.Run("found", func(t *testing.T) {
		got, err := svc.GetUser(context.Background(), u.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.ID != u.ID {
			t.Fatalf("expected id %s, got %s", u.ID, got.ID)
		}
	})

	t.Run("not found", func(t *testing.T) {
		_, err := svc.GetUser(context.Background(), uuid.New())
		if !errors.Is(err, domain.ErrNotFound) {
			t.Fatalf("expected ErrNotFound, got %v", err)
		}
	})
}

func TestUserService_ApproveReject(t *testing.T) {
	users := newMockUserRepo()
	svc := NewUserService(users)

	u := domain.User{
		ID:            uuid.New(),
		Username:      "pending",
		Email:         "pending@e.com",
		AccountStatus: domain.AccountStatusPending,
	}
	users.add(u)

	t.Run("approve", func(t *testing.T) {
		got, err := svc.ApproveUser(context.Background(), u.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.AccountStatus != domain.AccountStatusApproved {
			t.Fatalf("expected approved, got %s", got.AccountStatus)
		}
	})

	u.AccountStatus = domain.AccountStatusPending
	users.add(u)

	t.Run("reject", func(t *testing.T) {
		got, err := svc.RejectUser(context.Background(), u.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.AccountStatus != domain.AccountStatusRejected {
			t.Fatalf("expected rejected, got %s", got.AccountStatus)
		}
	})
}

func TestUserService_UpdateProfile(t *testing.T) {
	users := newMockUserRepo()
	svc := NewUserService(users)

	u := domain.User{
		ID:        uuid.New(),
		Username:  "testuser",
		Email:     "old@e.com",
		FirstName: "Old",
		LastName:  "Name",
	}
	users.add(u)

	t.Run("update name and email", func(t *testing.T) {
		newEmail := "new@e.com"
		got, err := svc.UpdateProfile(context.Background(), u.ID, UpdateProfileInput{
			FirstName: strPtr("New"),
			Email:     &newEmail,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.FirstName != "New" {
			t.Fatalf("expected 'New', got %s", got.FirstName)
		}
		if got.Email != newEmail {
			t.Fatalf("expected %s, got %s", newEmail, got.Email)
		}
		if got.LastName != "Name" {
			t.Fatalf("expected 'Name', got %s", got.LastName)
		}
	})

	t.Run("email already taken", func(t *testing.T) {
		other := domain.User{ID: uuid.New(), Username: "other", Email: "other@e.com"}
		users.add(other)

		takenEmail := "other@e.com"
		_, err := svc.UpdateProfile(context.Background(), u.ID, UpdateProfileInput{
			Email: &takenEmail,
		})
		if !errors.Is(err, domain.ErrEmailTaken) {
			t.Fatalf("expected ErrEmailTaken, got %v", err)
		}
	})

	t.Run("same email is ok", func(t *testing.T) {
		email := "new@e.com"
		got, err := svc.UpdateProfile(context.Background(), u.ID, UpdateProfileInput{
			Email: &email,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Email != email {
			t.Fatalf("expected %s, got %s", email, got.Email)
		}
	})
}
