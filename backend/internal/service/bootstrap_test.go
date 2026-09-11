package service

import (
	"context"
	"testing"

	"golang.org/x/crypto/bcrypt"

	"nexustickets/internal/domain"
)

func TestEnsureAdmin(t *testing.T) {
	ctx := context.Background()
	acc := AdminAccount{Username: "admin", Password: "ChangeMe123!", Email: "admin@example.com"}

	t.Run("creates the admin on an empty database", func(t *testing.T) {
		users := newMockUserRepo()
		created, err := EnsureAdmin(ctx, users, acc)
		if err != nil {
			t.Fatalf("EnsureAdmin: %v", err)
		}
		if !created {
			t.Fatalf("expected the admin to be created")
		}
		u, err := users.GetByUsername(ctx, "admin")
		if err != nil {
			t.Fatalf("admin not stored: %v", err)
		}
		if u.Role != domain.UserRoleAdmin || u.AccountStatus != domain.AccountStatusApproved {
			t.Fatalf("expected an approved admin, got role=%s status=%s", u.Role, u.AccountStatus)
		}
		if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(acc.Password)); err != nil {
			t.Fatalf("password was not hashed from the configured value")
		}
	})

	t.Run("is a no-op once any admin exists", func(t *testing.T) {
		users := newMockUserRepo()
		existing := mustUser(t, users, domain.UserRoleAdmin)
		created, err := EnsureAdmin(ctx, users, acc)
		if err != nil {
			t.Fatalf("EnsureAdmin: %v", err)
		}
		if created {
			t.Fatalf("must not create a second admin")
		}
		if _, err := users.GetByUsername(ctx, "admin"); err == nil && existing.Username != "admin" {
			t.Fatalf("configured admin must not be added next to an existing one")
		}
	})

	t.Run("refuses to promote a non-admin holding the username", func(t *testing.T) {
		users := newMockUserRepo()
		users.add(domain.User{Username: "admin", Email: "x@example.com", Role: domain.UserRoleAttendee})
		if _, err := EnsureAdmin(ctx, users, acc); err == nil {
			t.Fatalf("expected an error when the username belongs to a non-admin")
		}
	})

	t.Run("validates the configured account", func(t *testing.T) {
		users := newMockUserRepo()
		if _, err := EnsureAdmin(ctx, users, AdminAccount{Username: "admin", Password: "", Email: "a@b.c"}); err == nil {
			t.Fatalf("expected an error for an empty password")
		}
		if _, err := EnsureAdmin(ctx, users, AdminAccount{Username: "admin", Password: "pw", Email: "nope"}); err == nil {
			t.Fatalf("expected an error for an invalid email")
		}
	})
}
