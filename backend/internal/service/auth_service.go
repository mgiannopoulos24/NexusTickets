package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	redisv9 "github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"

	"nexustickets/internal/domain"
	repo "nexustickets/internal/repository"
)

const (
	passwordHashCost = 12
	tokenTypeAccess  = "access"
	tokenTypeRefresh = "refresh"
)

type AuthService struct {
	users      repo.UserRepository
	redis      *redisv9.Client
	jwtSecret  string
	accessTTL  time.Duration
	refreshTTL time.Duration
}

type RegisterInput struct {
	Username        string
	Password        string
	ConfirmPassword string
	FirstName       string
	LastName        string
	Email           string
	Phone           *string
	Address         *string
	City            *string
	Country         *string
	VATNumber       *string
}

type LoginResult struct {
	AccessToken      string
	RefreshToken     string
	AccessExpiresIn  int64
	RefreshExpiresIn int64
}

type AuthClaims struct {
	Role      string `json:"role"`
	TokenType string `json:"token_type"`
	jwt.RegisteredClaims
}

func NewAuthService(users repo.UserRepository, redis *redisv9.Client, jwtSecret string) *AuthService {
	return &AuthService{
		users:      users,
		redis:      redis,
		jwtSecret:  strings.TrimSpace(jwtSecret),
		accessTTL:  15 * time.Minute,
		refreshTTL: 7 * 24 * time.Hour,
	}
}

func (s *AuthService) Register(ctx context.Context, in RegisterInput) (domain.User, error) {
	if strings.TrimSpace(in.Password) == "" || strings.TrimSpace(in.ConfirmPassword) == "" {
		return domain.User{}, fmt.Errorf("password and confirm password are required")
	}
	if in.Password != in.ConfirmPassword {
		return domain.User{}, fmt.Errorf("password and confirm password must match")
	}

	if _, err := s.users.GetByUsername(ctx, in.Username); err == nil {
		return domain.User{}, domain.ErrUsernameTaken
	} else if !errors.Is(err, domain.ErrNotFound) {
		return domain.User{}, err
	}
	if _, err := s.users.GetByEmail(ctx, in.Email); err == nil {
		return domain.User{}, domain.ErrEmailTaken
	} else if !errors.Is(err, domain.ErrNotFound) {
		return domain.User{}, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), passwordHashCost)
	if err != nil {
		return domain.User{}, fmt.Errorf("hash password: %w", err)
	}

	created, err := s.users.Create(ctx, domain.User{
		Username:      strings.TrimSpace(in.Username),
		PasswordHash:  string(hash),
		FirstName:     strings.TrimSpace(in.FirstName),
		LastName:      strings.TrimSpace(in.LastName),
		Email:         strings.TrimSpace(in.Email),
		Phone:         in.Phone,
		Address:       in.Address,
		City:          in.City,
		Country:       in.Country,
		VATNumber:     in.VATNumber,
		Role:          domain.UserRoleAttendee,
		AccountStatus: domain.AccountStatusPending,
	})
	if err != nil {
		return domain.User{}, err
	}

	return created, nil
}

func (s *AuthService) IsUsernameAvailable(ctx context.Context, username string) (bool, error) {
	u := strings.TrimSpace(username)
	if u == "" {
		return false, fmt.Errorf("username is required")
	}
	if _, err := s.users.GetByUsername(ctx, u); err == nil {
		return false, nil
	} else if errors.Is(err, domain.ErrNotFound) {
		return true, nil
	} else {
		return false, err
	}
}

func (s *AuthService) Login(ctx context.Context, username, password string) (LoginResult, error) {
	user, err := s.users.GetByUsername(ctx, strings.TrimSpace(username))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return LoginResult{}, domain.ErrUnauthorized
		}
		return LoginResult{}, err
	}

	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) != nil {
		return LoginResult{}, domain.ErrUnauthorized
	}
	if user.AccountStatus != domain.AccountStatusApproved {
		return LoginResult{}, domain.ErrForbidden
	}

	return s.issueTokenPair(ctx, user.ID.String(), string(user.Role))
}

func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (LoginResult, error) {
	claims, err := s.parseToken(refreshToken, tokenTypeRefresh)
	if err != nil {
		return LoginResult{}, domain.ErrUnauthorized
	}

	storedUserID, err := s.redis.Get(ctx, refreshKey(claims.ID)).Result()
	if err != nil {
		if errors.Is(err, redisv9.Nil) {
			return LoginResult{}, domain.ErrUnauthorized
		}
		return LoginResult{}, fmt.Errorf("get refresh token jti: %w", err)
	}
	if storedUserID != claims.Subject {
		return LoginResult{}, domain.ErrUnauthorized
	}

	if err := s.redis.Del(ctx, refreshKey(claims.ID)).Err(); err != nil {
		return LoginResult{}, fmt.Errorf("delete old refresh jti: %w", err)
	}

	return s.issueTokenPair(ctx, claims.Subject, claims.Role)
}

func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	claims, err := s.parseToken(refreshToken, tokenTypeRefresh)
	if err != nil {
		return domain.ErrUnauthorized
	}
	if err := s.redis.Del(ctx, refreshKey(claims.ID)).Err(); err != nil {
		return fmt.Errorf("revoke refresh token: %w", err)
	}
	return nil
}

func (s *AuthService) issueTokenPair(ctx context.Context, userID, role string) (LoginResult, error) {
	now := time.Now().UTC()

	accessJTI := uuid.NewString()
	accessExp := now.Add(s.accessTTL)
	accessToken, err := s.signToken(AuthClaims{
		Role:      role,
		TokenType: tokenTypeAccess,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ID:        accessJTI,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(accessExp),
		},
	})
	if err != nil {
		return LoginResult{}, err
	}

	refreshJTI := uuid.NewString()
	refreshExp := now.Add(s.refreshTTL)
	refreshToken, err := s.signToken(AuthClaims{
		Role:      role,
		TokenType: tokenTypeRefresh,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ID:        refreshJTI,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(refreshExp),
		},
	})
	if err != nil {
		return LoginResult{}, err
	}

	if err := s.redis.Set(ctx, refreshKey(refreshJTI), userID, s.refreshTTL).Err(); err != nil {
		return LoginResult{}, fmt.Errorf("store refresh jti: %w", err)
	}

	return LoginResult{
		AccessToken:      accessToken,
		RefreshToken:     refreshToken,
		AccessExpiresIn:  int64(s.accessTTL.Seconds()),
		RefreshExpiresIn: int64(s.refreshTTL.Seconds()),
	}, nil
}

func (s *AuthService) signToken(claims AuthClaims) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", fmt.Errorf("sign token: %w", err)
	}
	return signed, nil
}

func (s *AuthService) parseToken(tokenStr string, expectedType string) (*AuthClaims, error) {
	claims := &AuthClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(s.jwtSecret), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	if claims.TokenType != expectedType || claims.Subject == "" || claims.ID == "" {
		return nil, fmt.Errorf("invalid token claims")
	}
	return claims, nil
}

func refreshKey(jti string) string {
	return "auth:refresh:" + jti
}
