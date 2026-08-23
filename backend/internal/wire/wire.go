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
	ChatHandler           *handler.ChatHandler
	AdminExportHandler    *handler.AdminExportHandler
	RecommendationService *service.RecommendationService
	// EventService is exposed so main can run the COMPLETED sweeper.
	EventService *service.EventService
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
	postgres.NewChatRoomRepository,
)

var ServiceSet = wire.NewSet(
	provideAuthService,
	service.NewUserService,
	service.NewChatService,
	provideMessagingService,
	provideEventService,
	service.NewBookingService,
	service.NewCatalogExportService,
	provideRecommendationService,
)

var HandlerSet = wire.NewSet(
	handler.NewAuthHandler,
	handler.NewUserHandler,
	handler.NewEventHandler,
	handler.NewCategoryHandler,
	handler.NewBookingHandler,
	handler.NewMessageHandler,
	handler.NewChatHandler,
	handler.NewAdminExportHandler,
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
