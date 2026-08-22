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

// ChangeRole switches an account between the attendee and organizer roles
// (assignment §Introduction / §6). Admin accounts are refused so an admin
// cannot accidentally demote the only administrator, and admin is not an
// assignable target so the endpoint cannot be used for privilege escalation.
//
// The caller keeps their old JWT until it expires (15 min) or they refresh;
// AuthService.RefreshToken re-reads the role from the database.
func (s *UserService) ChangeRole(ctx context.Context, userID uuid.UUID, role domain.UserRole) (domain.User, error) {
	if !domain.ValidAssignableRole(role) {
		return domain.User{}, domain.ErrInvalidRole
	}

	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return domain.User{}, err
	}
	if user.Role == domain.UserRoleAdmin {
		return domain.User{}, domain.ErrForbidden
	}
	if user.Role == role {
		return user, nil
	}

	return s.users.SetRole(ctx, userID, role)
}

func (s *UserService) UpdateProfile(ctx context.Context, userID uuid.UUID, in UpdateProfileInput) (domain.User, error) {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return domain.User{}, err
	}

	if in.Email != nil {
		email := strings.TrimSpace(*in.Email)
		if email != "" && !ValidEmail(email) {
			return domain.User{}, domain.Invalid("email address is not valid")
		}
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
		if strings.TrimSpace(*in.Phone) != "" && !ValidPhone(*in.Phone) {
			return domain.User{}, domain.Invalid("phone number is not valid")
		}
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
		if strings.TrimSpace(*in.VATNumber) != "" && !ValidVATNumber(*in.VATNumber) {
			return domain.User{}, domain.Invalid("VAT number must be 9 digits")
		}
		user.VATNumber = in.VATNumber
	}

	return s.users.UpdateProfile(ctx, user)
}
