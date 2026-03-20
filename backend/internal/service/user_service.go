package service

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"

	"nexustickets/internal/domain"
	repo "nexustickets/internal/repository"
)

type UserService struct {
	users repo.UserRepository
}

type UpdateProfileInput struct {
	FirstName *string
	LastName  *string
	Email     *string
	Phone     *string
	Address   *string
	City      *string
	Country   *string
	Latitude  *float64
	Longitude *float64
	VATNumber *string
}

func NewUserService(users repo.UserRepository) *UserService {
	return &UserService{users: users}
}

func (s *UserService) ListUsers(ctx context.Context, limit, offset int) ([]domain.User, error) {
	return s.users.List(ctx, limit, offset)
}

func (s *UserService) GetUser(ctx context.Context, id uuid.UUID) (domain.User, error) {
	return s.users.GetByID(ctx, id)
}

func (s *UserService) ApproveUser(ctx context.Context, id uuid.UUID) (domain.User, error) {
	return s.users.Approve(ctx, id)
}

func (s *UserService) RejectUser(ctx context.Context, id uuid.UUID) (domain.User, error) {
	return s.users.Reject(ctx, id)
}

func (s *UserService) UpdateProfile(ctx context.Context, userID uuid.UUID, in UpdateProfileInput) (domain.User, error) {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return domain.User{}, err
	}

	if in.Email != nil {
		email := strings.TrimSpace(*in.Email)
		if email != "" && !strings.EqualFold(email, user.Email) {
			existing, getErr := s.users.GetByEmail(ctx, email)
			if getErr == nil && existing.ID != user.ID {
				return domain.User{}, domain.ErrEmailTaken
			}
			if getErr != nil && !errors.Is(getErr, domain.ErrNotFound) {
				return domain.User{}, getErr
			}
			user.Email = email
		}
	}
	if in.FirstName != nil {
		user.FirstName = strings.TrimSpace(*in.FirstName)
	}
	if in.LastName != nil {
		user.LastName = strings.TrimSpace(*in.LastName)
	}
	if in.Phone != nil {
		user.Phone = in.Phone
	}
	if in.Address != nil {
		user.Address = in.Address
	}
	if in.City != nil {
		user.City = in.City
	}
	if in.Country != nil {
		user.Country = in.Country
	}
	if in.Latitude != nil {
		user.Latitude = in.Latitude
	}
	if in.Longitude != nil {
		user.Longitude = in.Longitude
	}
	if in.VATNumber != nil {
		user.VATNumber = in.VATNumber
	}

	return s.users.UpdateProfile(ctx, user)
}
