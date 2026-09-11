package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"nexustickets/internal/domain"
	repo "nexustickets/internal/repository"
)

// AdminAccount is the built-in administrator the assignment (§3) requires to
// exist from installation.
type AdminAccount struct {
	Username string
	Password string
	Email    string
}

// EnsureAdmin creates the built-in administrator when the database has no
// admin account at all. It runs on every start and is a no-op once an admin
// exists, so a deployment gets its admin without a manual seed step, and an
// admin later renamed or re-passworded is left alone.
func EnsureAdmin(ctx context.Context, users repo.UserRepository, acc AdminAccount) (created bool, err error) {
	admins, err := users.ListByRole(ctx, domain.UserRoleAdmin)
	if err != nil {
		return false, fmt.Errorf("list admins: %w", err)
	}
	if len(admins) > 0 {
		return false, nil
	}

	username := strings.TrimSpace(acc.Username)
	if username == "" || strings.TrimSpace(acc.Password) == "" {
		return false, errors.New("admin username and password are required")
	}
	if !ValidEmail(acc.Email) {
		return false, errors.New("admin email is not valid")
	}

	// The username may already be taken by a non-admin (e.g. someone
	// registered "admin" first). Refuse rather than silently promote them.
	if _, err := users.GetByUsername(ctx, username); err == nil {
		return false, fmt.Errorf("username %q is taken by a non-admin account; set ADMIN_USERNAME to another value", username)
	} else if !errors.Is(err, domain.ErrNotFound) {
		return false, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(acc.Password), passwordHashCost)
	if err != nil {
		return false, fmt.Errorf("hash admin password: %w", err)
	}

	if _, err := users.Create(ctx, domain.User{
		Username:      username,
		PasswordHash:  string(hash),
		FirstName:     "Admin",
		LastName:      "User",
		Email:         strings.TrimSpace(acc.Email),
		Role:          domain.UserRoleAdmin,
		AccountStatus: domain.AccountStatusApproved,
	}); err != nil {
		return false, fmt.Errorf("create admin: %w", err)
	}
	return true, nil
}
