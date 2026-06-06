// Package wire holds compile-time dependency injection wiring.
package wire

import (
	redisv9 "github.com/redis/go-redis/v9"

	"nexustickets/internal/config"
	repo "nexustickets/internal/repository"
	"nexustickets/internal/service"
)

func provideAuthService(users repo.UserRepository, redis *redisv9.Client, cfg config.Config) *service.AuthService {
	return service.NewAuthService(users, redis, cfg.JWTSecret)
}

func provideEventService(events repo.EventRepository, bookings repo.BookingRepository, categories repo.CategoryRepository, photos repo.EventPhotoRepository, views repo.UserEventViewRepository, cfg config.Config, messaging *service.MessagingService) *service.EventService {
	return service.NewEventService(events, bookings, categories, photos, views, cfg.MediaStoragePath, messaging)
}

func provideRecommendationService(cfg config.Config, redis *redisv9.Client) *service.RecommendationService {
	return service.NewRecommendationService(cfg.RecDataDir, redis)
}
