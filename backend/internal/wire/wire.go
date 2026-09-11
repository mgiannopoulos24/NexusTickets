//go:build wireinject
// +build wireinject

package wire

import (
	"github.com/google/wire"
	redisv9 "github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"nexustickets/internal/config"
	"nexustickets/internal/handler"
	wshub "nexustickets/internal/handler/ws"
	repo "nexustickets/internal/repository"
	"nexustickets/internal/repository/postgres"
	"nexustickets/internal/service"
)

type AppDependencies struct {
	Hub                   *wshub.Hub
	AuthHandler           *handler.AuthHandler
	UserHandler           *handler.UserHandler
	EventHandler          *handler.EventHandler
	CategoryHandler       *handler.CategoryHandler
	BookingHandler        *handler.BookingHandler
	MessageHandler        *handler.MessageHandler
	SupportHandler        *handler.SupportHandler
	AdminExportHandler    *handler.AdminExportHandler
	RecommendationService *service.RecommendationService
	// EventService is exposed so main can run the COMPLETED sweeper.
	EventService *service.EventService
	// Users is exposed so main can make sure the built-in admin exists.
	Users repo.UserRepository
}

var RepositorySet = wire.NewSet(
	postgres.NewUserRepositoryPostgres,
	postgres.NewEventRepositoryPostgres,
	postgres.NewTicketTypeRepositoryPostgres,
	postgres.NewBookingRepositoryPostgres,
	postgres.NewMessageRepositoryPostgres,
	postgres.NewCategoryRepositoryPostgres,
	postgres.NewEventPhotoRepositoryPostgres,
	postgres.NewUserEventViewRepositoryPostgres,
	postgres.NewSupportRepositoryPostgres,
)

var ServiceSet = wire.NewSet(
	provideAuthService,
	service.NewUserService,
	provideMessagingService,
	provideEventService,
	service.NewBookingService,
	service.NewCatalogExportService,
	service.NewSupportService,
	provideRecommendationService,
)

var HandlerSet = wire.NewSet(
	handler.NewAuthHandler,
	handler.NewUserHandler,
	handler.NewEventHandler,
	handler.NewCategoryHandler,
	handler.NewBookingHandler,
	handler.NewMessageHandler,
	handler.NewAdminExportHandler,
	handler.NewSupportHandler,
)

func InitializeApp(db *gorm.DB, redisClient *redisv9.Client, cfg config.Config) (*AppDependencies, error) {
	wire.Build(
		RepositorySet,
		ServiceSet,
		HandlerSet,
		wshub.NewHub,
		wire.Struct(new(AppDependencies), "*"),
	)
	return nil, nil
}
