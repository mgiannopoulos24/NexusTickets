// Package wire holds compile-time dependency injection wiring.
package wire

import (
	redisv9 "github.com/redis/go-redis/v9"

	"nexustickets/internal/config"
	"nexustickets/internal/handler/ws"
	repo "nexustickets/internal/repository"
	"nexustickets/internal/service"
)

func provideAuthService(users repo.UserRepository, redis *redisv9.Client, cfg config.Config) *service.AuthService {
	return service.NewAuthService(users, redis, cfg.JWTSecret)
}

func provideEventService(events repo.EventRepository, bookings repo.BookingRepository, categories repo.CategoryRepository, photos repo.EventPhotoRepository, views repo.UserEventViewRepository, cfg config.Config, messaging *service.MessagingService, recommender *service.RecommendationService) *service.EventService {
	svc := service.NewEventService(events, bookings, categories, photos, views, cfg.MediaStoragePath, messaging)
	svc.SetRecommender(recommender)
	return svc
}

func provideMessagingService(
	messages repo.MessageRepository,
	users repo.UserRepository,
	bookings repo.BookingRepository,
	events repo.EventRepository,
	rdb *redisv9.Client,
	hub *ws.Hub,
	cfg config.Config,
) *service.MessagingService {
	svc := service.NewMessagingService(messages, users, bookings, events, rdb, hub)
	return svc
}

func provideRecommendationService(bookings repo.BookingRepository, views repo.UserEventViewRepository) *service.RecommendationService {
	return service.NewRecommendationService(bookings, views)
}
