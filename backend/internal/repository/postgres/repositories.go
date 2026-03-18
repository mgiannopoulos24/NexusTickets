package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"nexustickets/internal/domain"
	repo "nexustickets/internal/repository"
)

func ensureID(id uuid.UUID) uuid.UUID {
	if id == uuid.Nil {
		return uuid.New()
	}
	return id
}

func nowUTC() time.Time { return time.Now().UTC() }

// NewUserRepositoryPostgres creates a UserRepository backed by GORM.
func NewUserRepositoryPostgres(db *gorm.DB) repo.UserRepository {
	return &userRepositoryPostgres{db: db}
}

type userRepositoryPostgres struct {
	db *gorm.DB
}

func (r *userRepositoryPostgres) GetByID(ctx context.Context, id uuid.UUID) (domain.User, error) {
	var m UserModel
	err := r.db.WithContext(ctx).First(&m, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domain.User{}, domain.ErrNotFound
		}
		return domain.User{}, fmt.Errorf("get user by id: %w", err)
	}
	return userModelToDomain(m), nil
}

func (r *userRepositoryPostgres) GetByUsername(ctx context.Context, username string) (domain.User, error) {
	var m UserModel
	err := r.db.WithContext(ctx).First(&m, "username = ?", username).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domain.User{}, domain.ErrNotFound
		}
		return domain.User{}, fmt.Errorf("get user by username: %w", err)
	}
	return userModelToDomain(m), nil
}

func (r *userRepositoryPostgres) GetByEmail(ctx context.Context, email string) (domain.User, error) {
	var m UserModel
	err := r.db.WithContext(ctx).First(&m, "email = ?", email).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domain.User{}, domain.ErrNotFound
		}
		return domain.User{}, fmt.Errorf("get user by email: %w", err)
	}
	return userModelToDomain(m), nil
}

func (r *userRepositoryPostgres) Create(ctx context.Context, user domain.User) (domain.User, error) {
	user.ID = ensureID(user.ID)
	user.CreatedAt = nowUTC()
	user.UpdatedAt = nowUTC()

	m := userDomainToModel(user)
	if err := r.db.WithContext(ctx).Create(&m).Error; err != nil {
		return domain.User{}, fmt.Errorf("create user: %w", err)
	}
	return userModelToDomain(m), nil
}

func (r *userRepositoryPostgres) UpdateProfile(ctx context.Context, user domain.User) (domain.User, error) {
	if user.ID == uuid.Nil {
		return domain.User{}, fmt.Errorf("update profile: missing user id")
	}

	user.UpdatedAt = nowUTC()
	m := userDomainToModel(user)

	err := r.db.WithContext(ctx).
		Model(&UserModel{}).
		Where("id = ?", user.ID).
		Updates(map[string]interface{}{
			"first_name":     m.FirstName,
			"last_name":      m.LastName,
			"email":          m.Email,
			"phone":          m.Phone,
			"address":        m.Address,
			"city":           m.City,
			"country":        m.Country,
			"latitude":       m.Latitude,
			"longitude":      m.Longitude,
			"vat_number":     m.VATNumber,
			"updated_at":     m.UpdatedAt,
		}).Error
	if err != nil {
		return domain.User{}, fmt.Errorf("update profile: %w", err)
	}

	updated, err := r.GetByID(ctx, user.ID)
	if err != nil {
		return domain.User{}, err
	}
	return updated, nil
}

func (r *userRepositoryPostgres) Approve(ctx context.Context, id uuid.UUID) (domain.User, error) {
	err := r.db.WithContext(ctx).Model(&UserModel{}).
		Where("id = ?", id).
		Update("account_status", string(domain.AccountStatusApproved)).Error
	if err != nil {
		return domain.User{}, fmt.Errorf("approve user: %w", err)
	}
	return r.GetByID(ctx, id)
}

func (r *userRepositoryPostgres) Reject(ctx context.Context, id uuid.UUID) (domain.User, error) {
	err := r.db.WithContext(ctx).Model(&UserModel{}).
		Where("id = ?", id).
		Update("account_status", string(domain.AccountStatusRejected)).Error
	if err != nil {
		return domain.User{}, fmt.Errorf("reject user: %w", err)
	}
	return r.GetByID(ctx, id)
}

func (r *userRepositoryPostgres) List(ctx context.Context, limit, offset int) ([]domain.User, error) {
	if limit < 1 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	var models []UserModel
	err := r.db.WithContext(ctx).Limit(limit).Offset(offset).Order("created_at DESC").Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}

	out := make([]domain.User, 0, len(models))
	for _, m := range models {
		out = append(out, userModelToDomain(m))
	}
	return out, nil
}

// NewEventRepositoryPostgres creates an EventRepository backed by GORM.
func NewEventRepositoryPostgres(db *gorm.DB) repo.EventRepository {
	return &eventRepositoryPostgres{db: db}
}

type eventRepositoryPostgres struct {
	db *gorm.DB
}

func (r *eventRepositoryPostgres) Create(ctx context.Context, event domain.Event) (domain.Event, error) {
	event.ID = ensureID(event.ID)
	event.CreatedAt = nowUTC()
	event.UpdatedAt = nowUTC()

	m := eventDomainToModel(event)
	if err := r.db.WithContext(ctx).Create(&m).Error; err != nil {
		return domain.Event{}, fmt.Errorf("create event: %w", err)
	}
	return eventModelToDomain(m), nil
}

func (r *eventRepositoryPostgres) GetByID(ctx context.Context, id uuid.UUID) (domain.Event, error) {
	var m EventModel
	err := r.db.WithContext(ctx).First(&m, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domain.Event{}, domain.ErrNotFound
		}
		return domain.Event{}, fmt.Errorf("get event by id: %w", err)
	}
	return eventModelToDomain(m), nil
}

func (r *eventRepositoryPostgres) ListOrganizer(ctx context.Context, organizerID uuid.UUID, limit, offset int) ([]domain.Event, error) {
	if limit < 1 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	var models []EventModel
	err := r.db.WithContext(ctx).
		Where("organizer_id = ?", organizerID).
		Limit(limit).
		Offset(offset).
		Order("start_time DESC").
		Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list organizer events: %w", err)
	}

	out := make([]domain.Event, 0, len(models))
	for _, m := range models {
		out = append(out, eventModelToDomain(m))
	}
	return out, nil
}

func (r *eventRepositoryPostgres) ListPublic(ctx context.Context, limit, offset int) ([]domain.Event, error) {
	if limit < 1 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	var models []EventModel
	err := r.db.WithContext(ctx).
		Where("status = ?", string(domain.EventStatusPublished)).
		Limit(limit).
		Offset(offset).
		Order("start_time DESC").
		Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list public events: %w", err)
	}

	out := make([]domain.Event, 0, len(models))
	for _, m := range models {
		out = append(out, eventModelToDomain(m))
	}
	return out, nil
}

func (r *eventRepositoryPostgres) Search(ctx context.Context, params repo.SearchEventsParams, limit, offset int) ([]domain.Event, error) {
	if limit < 1 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	q := r.db.WithContext(ctx).Model(&EventModel{}).Distinct()
	if params.Status != "" {
		q = q.Where("status = ?", string(params.Status))
	}
	if params.Title != "" {
		q = q.Where("title ILIKE ?", "%"+params.Title+"%")
	}
	if params.FullText != "" {
		q = q.Where("search_vector @@ plainto_tsquery('greek', ?)", params.FullText)
	}
	if params.City != "" {
		q = q.Where("city ILIKE ?", "%"+params.City+"%")
	}
	if params.StartAt != nil {
		q = q.Where("start_time >= ?", *params.StartAt)
	}
	if params.EndAt != nil {
		q = q.Where("end_time <= ?", *params.EndAt)
	}

	// Price filters apply if any ticket type matches the range.
	if params.MinPrice != nil && params.MaxPrice != nil {
		q = q.Where(
			"EXISTS (SELECT 1 FROM ticket_types tt WHERE tt.event_id = events.id AND tt.price BETWEEN ? AND ?)",
			*params.MinPrice,
			*params.MaxPrice,
		)
	} else if params.MinPrice != nil {
		q = q.Where(
			"EXISTS (SELECT 1 FROM ticket_types tt WHERE tt.event_id = events.id AND tt.price >= ?)",
			*params.MinPrice,
		)
	} else if params.MaxPrice != nil {
		q = q.Where(
			"EXISTS (SELECT 1 FROM ticket_types tt WHERE tt.event_id = events.id AND tt.price <= ?)",
			*params.MaxPrice,
		)
	}

	if len(params.CategoryIDs) > 0 {
		q = q.Joins("JOIN event_categories ec ON ec.event_id = events.id").
			Where("ec.category_id IN ?", params.CategoryIDs)
	}

	var models []EventModel
	err := q.Limit(limit).Offset(offset).Order("start_time DESC").Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("search events: %w", err)
	}

	out := make([]domain.Event, 0, len(models))
	for _, m := range models {
		out = append(out, eventModelToDomain(m))
	}
	return out, nil
}

func (r *eventRepositoryPostgres) Update(ctx context.Context, event domain.Event) (domain.Event, error) {
	if event.ID == uuid.Nil {
		return domain.Event{}, fmt.Errorf("update event: missing event id")
	}
	event.UpdatedAt = nowUTC()
	m := eventDomainToModel(event)

	err := r.db.WithContext(ctx).
		Model(&EventModel{}).
		Where("id = ?", event.ID).
		Updates(map[string]interface{}{
			"organizer_id":  m.OrganizerID,
			"title":         m.Title,
			"description":   m.Description,
			"venue":         m.Venue,
			"address":       m.Address,
			"city":          m.City,
			"country":       m.Country,
			"latitude":      m.Latitude,
			"longitude":     m.Longitude,
			"start_time":    m.StartAt,
			"end_time":      m.EndAt,
			"capacity":      m.Capacity,
			"status":        m.Status,
			"updated_at":    m.UpdatedAt,
		}).Error
	if err != nil {
		return domain.Event{}, fmt.Errorf("update event: %w", err)
	}

	return r.GetByID(ctx, event.ID)
}

func (r *eventRepositoryPostgres) Delete(ctx context.Context, id uuid.UUID) error {
	res := r.db.WithContext(ctx).Delete(&EventModel{}, "id = ?", id)
	if res.Error != nil {
		return fmt.Errorf("delete event: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *eventRepositoryPostgres) SetStatus(ctx context.Context, id uuid.UUID, status domain.EventStatus) error {
	res := r.db.WithContext(ctx).Model(&EventModel{}).
		Where("id = ?", id).
		Update("status", string(status))
	if res.Error != nil {
		return fmt.Errorf("set event status: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *eventRepositoryPostgres) SetCategories(ctx context.Context, eventID uuid.UUID, categoryIDs []uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("event_id = ?", eventID).Delete(&EventCategoryModel{}).Error; err != nil {
			return fmt.Errorf("clear event categories: %w", err)
		}
		if len(categoryIDs) == 0 {
			return nil
		}

		rows := make([]EventCategoryModel, 0, len(categoryIDs))
		for _, cID := range categoryIDs {
			if cID == uuid.Nil {
				continue
			}
			rows = append(rows, EventCategoryModel{EventID: eventID, CategoryID: cID})
		}
		if len(rows) == 0 {
			return nil
		}
		if err := tx.Create(&rows).Error; err != nil {
			return fmt.Errorf("insert event categories: %w", err)
		}
		return nil
	})
}

func (r *eventRepositoryPostgres) GetCategories(ctx context.Context, eventID uuid.UUID) ([]domain.Category, error) {
	var models []CategoryModel
	err := r.db.WithContext(ctx).
		Table("categories").
		Joins("JOIN event_categories ec ON ec.category_id = categories.id").
		Where("ec.event_id = ?", eventID).
		Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("get event categories: %w", err)
	}

	out := make([]domain.Category, 0, len(models))
	for _, m := range models {
		out = append(out, categoryModelToDomain(m))
	}
	return out, nil
}

func (r *eventRepositoryPostgres) SetTicketTypes(ctx context.Context, eventID uuid.UUID, ticketTypes []domain.TicketType) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("event_id = ?", eventID).Delete(&TicketTypeModel{}).Error; err != nil {
			return fmt.Errorf("clear ticket types: %w", err)
		}
		if len(ticketTypes) == 0 {
			return nil
		}

		rows := make([]TicketTypeModel, 0, len(ticketTypes))
		for _, tt := range ticketTypes {
			tt.ID = ensureID(tt.ID)
			tt.EventID = eventID
			if tt.CreatedAt.IsZero() {
				tt.CreatedAt = nowUTC()
			}
			if tt.UpdatedAt.IsZero() {
				tt.UpdatedAt = nowUTC()
			}
			rows = append(rows, ticketTypeDomainToModel(tt))
		}
		if len(rows) == 0 {
			return nil
		}
		if err := tx.Create(&rows).Error; err != nil {
			return fmt.Errorf("insert ticket types: %w", err)
		}
		return nil
	})
}

func (r *eventRepositoryPostgres) GetTicketTypes(ctx context.Context, eventID uuid.UUID) ([]domain.TicketType, error) {
	var models []TicketTypeModel
	err := r.db.WithContext(ctx).
		Where("event_id = ?", eventID).
		Order("created_at ASC").
		Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("get ticket types: %w", err)
	}

	out := make([]domain.TicketType, 0, len(models))
	for _, m := range models {
		out = append(out, ticketTypeModelToDomain(m))
	}
	return out, nil
}

func (r *eventRepositoryPostgres) GetPhotos(ctx context.Context, eventID uuid.UUID) ([]domain.EventPhoto, error) {
	var models []EventPhotoModel
	err := r.db.WithContext(ctx).
		Where("event_id = ?", eventID).
		Order("position ASC").
		Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("get event photos: %w", err)
	}

	out := make([]domain.EventPhoto, 0, len(models))
	for _, m := range models {
		out = append(out, eventPhotoModelToDomain(m))
	}
	return out, nil
}

// NewTicketTypeRepositoryPostgres creates a TicketTypeRepository backed by GORM.
func NewTicketTypeRepositoryPostgres(db *gorm.DB) repo.TicketTypeRepository {
	return &ticketTypeRepositoryPostgres{db: db}
}

type ticketTypeRepositoryPostgres struct {
	db *gorm.DB
}

func (r *ticketTypeRepositoryPostgres) Create(ctx context.Context, ticketType domain.TicketType) (domain.TicketType, error) {
	ticketType.ID = ensureID(ticketType.ID)
	ticketType.CreatedAt = nowUTC()
	ticketType.UpdatedAt = nowUTC()

	m := ticketTypeDomainToModel(ticketType)
	if err := r.db.WithContext(ctx).Create(&m).Error; err != nil {
		return domain.TicketType{}, fmt.Errorf("create ticket type: %w", err)
	}
	return ticketTypeModelToDomain(m), nil
}

func (r *ticketTypeRepositoryPostgres) GetByID(ctx context.Context, id uuid.UUID) (domain.TicketType, error) {
	var m TicketTypeModel
	err := r.db.WithContext(ctx).First(&m, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domain.TicketType{}, domain.ErrNotFound
		}
		return domain.TicketType{}, fmt.Errorf("get ticket type: %w", err)
	}
	return ticketTypeModelToDomain(m), nil
}

func (r *ticketTypeRepositoryPostgres) ListByEvent(ctx context.Context, eventID uuid.UUID) ([]domain.TicketType, error) {
	var models []TicketTypeModel
	err := r.db.WithContext(ctx).Where("event_id = ?", eventID).Order("created_at ASC").Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list ticket types: %w", err)
	}
	out := make([]domain.TicketType, 0, len(models))
	for _, m := range models {
		out = append(out, ticketTypeModelToDomain(m))
	}
	return out, nil
}

func (r *ticketTypeRepositoryPostgres) Update(ctx context.Context, ticketType domain.TicketType) (domain.TicketType, error) {
	if ticketType.ID == uuid.Nil {
		return domain.TicketType{}, fmt.Errorf("update ticket type: missing id")
	}
	ticketType.UpdatedAt = nowUTC()
	m := ticketTypeDomainToModel(ticketType)

	err := r.db.WithContext(ctx).
		Model(&TicketTypeModel{}).
		Where("id = ?", ticketType.ID).
		Updates(map[string]interface{}{
			"name":       m.Name,
			"price":      m.Price,
			"quantity":   m.Quantity,
			"available":  m.Available,
			"updated_at": m.UpdatedAt,
		}).Error
	if err != nil {
		return domain.TicketType{}, fmt.Errorf("update ticket type: %w", err)
	}
	return r.GetByID(ctx, ticketType.ID)
}

func (r *ticketTypeRepositoryPostgres) Delete(ctx context.Context, id uuid.UUID) error {
	res := r.db.WithContext(ctx).Delete(&TicketTypeModel{}, "id = ?", id)
	if res.Error != nil {
		return fmt.Errorf("delete ticket type: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *ticketTypeRepositoryPostgres) DecrementAvailabilityAtomic(ctx context.Context, ticketTypeID uuid.UUID, quantity int) (bool, error) {
	if quantity <= 0 {
		return false, fmt.Errorf("decrement availability: quantity must be > 0")
	}

	res := r.db.WithContext(ctx).
		Model(&TicketTypeModel{}).
		Where("id = ? AND available >= ?", ticketTypeID, quantity).
		Update("available", gorm.Expr("available - ?", quantity))
	if res.Error != nil {
		return false, fmt.Errorf("decrement availability: %w", res.Error)
	}

	if res.RowsAffected == 1 {
		return true, nil
	}

	// Distinguish between "not enough capacity" and "ticket type doesn't exist".
	var count int64
	if err := r.db.WithContext(ctx).Model(&TicketTypeModel{}).Where("id = ?", ticketTypeID).Count(&count).Error; err != nil {
		return false, fmt.Errorf("decrement availability: count ticket types: %w", err)
	}
	if count == 0 {
		return false, domain.ErrNotFound
	}
	return false, nil
}

// NewBookingRepositoryPostgres creates a BookingRepository backed by GORM.
func NewBookingRepositoryPostgres(db *gorm.DB) repo.BookingRepository {
	return &bookingRepositoryPostgres{db: db}
}

type bookingRepositoryPostgres struct {
	db *gorm.DB
}

func (r *bookingRepositoryPostgres) Create(ctx context.Context, booking domain.Booking) (domain.Booking, error) {
	booking.ID = ensureID(booking.ID)
	booking.CreatedAt = nowUTC()
	booking.UpdatedAt = nowUTC()

	m := bookingDomainToModel(booking)
	if err := r.db.WithContext(ctx).Create(&m).Error; err != nil {
		return domain.Booking{}, fmt.Errorf("create booking: %w", err)
	}
	return bookingModelToDomain(m), nil
}

func (r *bookingRepositoryPostgres) GetByID(ctx context.Context, id uuid.UUID) (domain.Booking, error) {
	var m BookingModel
	err := r.db.WithContext(ctx).First(&m, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domain.Booking{}, domain.ErrNotFound
		}
		return domain.Booking{}, fmt.Errorf("get booking: %w", err)
	}
	return bookingModelToDomain(m), nil
}

func (r *bookingRepositoryPostgres) ListByUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.Booking, error) {
	if limit < 1 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	var models []BookingModel
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Limit(limit).
		Offset(offset).
		Order("created_at DESC").
		Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list bookings by user: %w", err)
	}
	out := make([]domain.Booking, 0, len(models))
	for _, m := range models {
		out = append(out, bookingModelToDomain(m))
	}
	return out, nil
}

func (r *bookingRepositoryPostgres) ListByEvent(ctx context.Context, eventID uuid.UUID, limit, offset int) ([]domain.Booking, error) {
	if limit < 1 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	var models []BookingModel
	err := r.db.WithContext(ctx).
		Where("event_id = ?", eventID).
		Limit(limit).
		Offset(offset).
		Order("created_at DESC").
		Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list bookings by event: %w", err)
	}
	out := make([]domain.Booking, 0, len(models))
	for _, m := range models {
		out = append(out, bookingModelToDomain(m))
	}
	return out, nil
}

func (r *bookingRepositoryPostgres) ListConfirmedByEvent(ctx context.Context, eventID uuid.UUID, limit, offset int) ([]domain.Booking, error) {
	if limit < 1 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	var models []BookingModel
	err := r.db.WithContext(ctx).
		Where("event_id = ? AND status = ?", eventID, string(domain.BookingStatusConfirmed)).
		Limit(limit).
		Offset(offset).
		Order("created_at DESC").
		Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list confirmed bookings by event: %w", err)
	}
	out := make([]domain.Booking, 0, len(models))
	for _, m := range models {
		out = append(out, bookingModelToDomain(m))
	}
	return out, nil
}

func (r *bookingRepositoryPostgres) SetStatus(ctx context.Context, bookingID uuid.UUID, status domain.BookingStatus) error {
	res := r.db.WithContext(ctx).Model(&BookingModel{}).
		Where("id = ?", bookingID).
		Update("status", string(status))
	if res.Error != nil {
		return fmt.Errorf("set booking status: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// NewMessageRepositoryPostgres creates a MessageRepository backed by GORM.
func NewMessageRepositoryPostgres(db *gorm.DB) repo.MessageRepository {
	return &messageRepositoryPostgres{db: db}
}

type messageRepositoryPostgres struct {
	db *gorm.DB
}

func (r *messageRepositoryPostgres) Create(ctx context.Context, message domain.Message) (domain.Message, error) {
	message.ID = ensureID(message.ID)
	message.CreatedAt = nowUTC()

	m := messageDomainToModel(message)
	if err := r.db.WithContext(ctx).Create(&m).Error; err != nil {
		return domain.Message{}, fmt.Errorf("create message: %w", err)
	}
	return messageModelToDomain(m), nil
}

func (r *messageRepositoryPostgres) ListInbox(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.Message, error) {
	if limit < 1 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	var models []MessageModel
	err := r.db.WithContext(ctx).
		Where("recipient_id = ? AND deleted_by_recipient = ?", userID, false).
		Limit(limit).
		Offset(offset).
		Order("created_at DESC").
		Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list inbox: %w", err)
	}
	out := make([]domain.Message, 0, len(models))
	for _, m := range models {
		out = append(out, messageModelToDomain(m))
	}
	return out, nil
}

func (r *messageRepositoryPostgres) ListSent(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.Message, error) {
	if limit < 1 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	var models []MessageModel
	err := r.db.WithContext(ctx).
		Where("sender_id = ? AND deleted_by_sender = ?", userID, false).
		Limit(limit).
		Offset(offset).
		Order("created_at DESC").
		Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list sent: %w", err)
	}
	out := make([]domain.Message, 0, len(models))
	for _, m := range models {
		out = append(out, messageModelToDomain(m))
	}
	return out, nil
}

func (r *messageRepositoryPostgres) DeleteForUser(ctx context.Context, messageID uuid.UUID, userID uuid.UUID) error {
	var m MessageModel
	err := r.db.WithContext(ctx).First(&m, "id = ?", messageID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domain.ErrNotFound
		}
		return fmt.Errorf("delete message for user: fetch message: %w", err)
	}

	if m.SenderID == userID {
		m.DeletedBySender = true
	} else if m.RecipientID == userID {
		m.DeletedByRecipient = true
	} else {
		return domain.ErrForbidden
	}

	if err := r.db.WithContext(ctx).Model(&MessageModel{}).
		Where("id = ?", messageID).
		Updates(map[string]interface{}{
			"deleted_by_sender":    m.DeletedBySender,
			"deleted_by_recipient": m.DeletedByRecipient,
		}).Error; err != nil {
		return fmt.Errorf("delete message for user: update: %w", err)
	}
	return nil
}

func (r *messageRepositoryPostgres) MarkAsRead(ctx context.Context, userID uuid.UUID) error {
	res := r.db.WithContext(ctx).Model(&MessageModel{}).
		Where("recipient_id = ? AND read_at IS NULL AND deleted_by_recipient = ?", userID, false).
		Update("read_at", nowUTC())
	if res.Error != nil {
		return fmt.Errorf("mark messages as read: %w", res.Error)
	}
	return nil
}

func (r *messageRepositoryPostgres) GetUnreadCount(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&MessageModel{}).
		Where("recipient_id = ? AND read_at IS NULL AND deleted_by_recipient = ?", userID, false).
		Count(&count).Error
	if err != nil {
		return 0, fmt.Errorf("get unread count: %w", err)
	}
	return int(count), nil
}

// NewCategoryRepositoryPostgres creates a CategoryRepository backed by GORM.
func NewCategoryRepositoryPostgres(db *gorm.DB) repo.CategoryRepository {
	return &categoryRepositoryPostgres{db: db}
}

type categoryRepositoryPostgres struct {
	db *gorm.DB
}

func (r *categoryRepositoryPostgres) Create(ctx context.Context, category domain.Category) (domain.Category, error) {
	category.ID = ensureID(category.ID)
	category.CreatedAt = nowUTC()

	m := categoryDomainToModel(category)
	if err := r.db.WithContext(ctx).Create(&m).Error; err != nil {
		return domain.Category{}, fmt.Errorf("create category: %w", err)
	}
	return categoryModelToDomain(m), nil
}

func (r *categoryRepositoryPostgres) GetByID(ctx context.Context, id uuid.UUID) (domain.Category, error) {
	var m CategoryModel
	err := r.db.WithContext(ctx).First(&m, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domain.Category{}, domain.ErrNotFound
		}
		return domain.Category{}, fmt.Errorf("get category by id: %w", err)
	}
	return categoryModelToDomain(m), nil
}

func (r *categoryRepositoryPostgres) GetByName(ctx context.Context, name string) (domain.Category, error) {
	var m CategoryModel
	err := r.db.WithContext(ctx).First(&m, "name = ?", name).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domain.Category{}, domain.ErrNotFound
		}
		return domain.Category{}, fmt.Errorf("get category by name: %w", err)
	}
	return categoryModelToDomain(m), nil
}

func (r *categoryRepositoryPostgres) ListAll(ctx context.Context) ([]domain.Category, error) {
	var models []CategoryModel
	err := r.db.WithContext(ctx).Order("name ASC").Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list all categories: %w", err)
	}
	out := make([]domain.Category, 0, len(models))
	for _, m := range models {
		out = append(out, categoryModelToDomain(m))
	}
	return out, nil
}

// NewEventPhotoRepositoryPostgres creates an EventPhotoRepository backed by GORM.
func NewEventPhotoRepositoryPostgres(db *gorm.DB) repo.EventPhotoRepository {
	return &eventPhotoRepositoryPostgres{db: db}
}

type eventPhotoRepositoryPostgres struct {
	db *gorm.DB
}

func (r *eventPhotoRepositoryPostgres) Add(ctx context.Context, photo domain.EventPhoto) (domain.EventPhoto, error) {
	photo.ID = ensureID(photo.ID)
	photo.CreatedAt = nowUTC()

	m := eventPhotoDomainToModel(photo)
	if err := r.db.WithContext(ctx).Create(&m).Error; err != nil {
		return domain.EventPhoto{}, fmt.Errorf("add event photo: %w", err)
	}
	return eventPhotoModelToDomain(m), nil
}

func (r *eventPhotoRepositoryPostgres) ListByEvent(ctx context.Context, eventID uuid.UUID) ([]domain.EventPhoto, error) {
	var models []EventPhotoModel
	err := r.db.WithContext(ctx).Where("event_id = ?", eventID).Order("position ASC").Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list event photos: %w", err)
	}
	out := make([]domain.EventPhoto, 0, len(models))
	for _, m := range models {
		out = append(out, eventPhotoModelToDomain(m))
	}
	return out, nil
}

func (r *eventPhotoRepositoryPostgres) Delete(ctx context.Context, photoID uuid.UUID) error {
	res := r.db.WithContext(ctx).Delete(&EventPhotoModel{}, "id = ?", photoID)
	if res.Error != nil {
		return fmt.Errorf("delete event photo: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// NewUserEventViewRepositoryPostgres creates a UserEventViewRepository backed by GORM.
func NewUserEventViewRepositoryPostgres(db *gorm.DB) repo.UserEventViewRepository {
	return &userEventViewRepositoryPostgres{db: db}
}

type userEventViewRepositoryPostgres struct {
	db *gorm.DB
}

func (r *userEventViewRepositoryPostgres) Record(ctx context.Context, userID, eventID uuid.UUID) error {
	view := UserEventViewModel{
		ID:       uuid.New(),
		UserID:  userID,
		EventID: eventID,
		ViewedAt: nowUTC(),
	}
	if err := r.db.WithContext(ctx).Create(&view).Error; err != nil {
		return fmt.Errorf("record user event view: %w", err)
	}
	return nil
}

func (r *userEventViewRepositoryPostgres) CountByEvent(ctx context.Context, eventID uuid.UUID) (int, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&UserEventViewModel{}).
		Where("event_id = ?", eventID).
		Count(&count).Error
	if err != nil {
		return 0, fmt.Errorf("count by event views: %w", err)
	}
	return int(count), nil
}

