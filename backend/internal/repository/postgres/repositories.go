package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

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
			"first_name": m.FirstName,
			"last_name":  m.LastName,
			"email":      m.Email,
			"phone":      m.Phone,
			"address":    m.Address,
			"city":       m.City,
			"country":    m.Country,
			"latitude":   m.Latitude,
			"longitude":  m.Longitude,
			"vat_number": m.VATNumber,
			"updated_at": m.UpdatedAt,
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

// SetRole changes an account's role. Only attendee/organizer are assignable;
// the caller (UserService.ChangeRole) enforces that and refuses admin accounts.
func (r *userRepositoryPostgres) SetRole(ctx context.Context, id uuid.UUID, role domain.UserRole) (domain.User, error) {
	res := r.db.WithContext(ctx).Model(&UserModel{}).
		Where("id = ?", id).
		Updates(map[string]any{"role": string(role), "updated_at": nowUTC()})
	if res.Error != nil {
		return domain.User{}, fmt.Errorf("set user role: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return domain.User{}, domain.ErrNotFound
	}
	return r.GetByID(ctx, id)
}

// ListByRole returns approved accounts holding the given role.
func (r *userRepositoryPostgres) ListByRole(ctx context.Context, role domain.UserRole) ([]domain.User, error) {
	var models []UserModel
	err := r.db.WithContext(ctx).
		Where("role = ? AND account_status = ?", string(role), string(domain.AccountStatusApproved)).
		Order("username ASC").
		Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list users by role: %w", err)
	}
	out := make([]domain.User, 0, len(models))
	for _, m := range models {
		out = append(out, userModelToDomain(m))
	}
	return out, nil
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

func (r *userRepositoryPostgres) ListByIDs(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]domain.User, error) {
	if len(ids) == 0 {
		return map[uuid.UUID]domain.User{}, nil
	}
	var models []UserModel
	err := r.db.WithContext(ctx).Where("id IN ?", ids).Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list users by ids: %w", err)
	}
	out := make(map[uuid.UUID]domain.User, len(models))
	for _, m := range models {
		out[m.ID] = userModelToDomain(m)
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

func (r *eventRepositoryPostgres) Search(ctx context.Context, params repo.SearchEventsParams, limit, offset int) ([]domain.Event, bool, error) {
	if limit < 1 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	useKeyset := params.AfterStartAt != nil && params.AfterID != nil
	fetchLimit := limit + 1

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

	// Date range: events whose time window overlaps the filter window [StartAt, EndAt].
	if params.StartAt != nil && params.EndAt != nil {
		q = q.Where("start_time <= ? AND end_time >= ?", *params.EndAt, *params.StartAt)
	} else if params.StartAt != nil {
		q = q.Where("end_time >= ?", *params.StartAt)
	} else if params.EndAt != nil {
		q = q.Where("start_time <= ?", *params.EndAt)
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

	if useKeyset {
		q = q.Where(
			"(start_time < ? OR (start_time = ? AND id < ?))",
			*params.AfterStartAt, *params.AfterStartAt, *params.AfterID,
		)
	}

	q = q.Order("start_time DESC, id DESC")

	var models []EventModel
	var err error
	if useKeyset {
		err = q.Limit(fetchLimit).Find(&models).Error
	} else {
		err = q.Limit(fetchLimit).Offset(offset).Find(&models).Error
	}
	if err != nil {
		return nil, false, fmt.Errorf("search events: %w", err)
	}

	hasMore := len(models) > limit
	if hasMore {
		models = models[:limit]
	}

	out := make([]domain.Event, 0, len(models))
	for _, m := range models {
		out = append(out, eventModelToDomain(m))
	}
	return out, hasMore, nil
}

func (r *eventRepositoryPostgres) ListForExport(ctx context.Context, limit, offset int) ([]domain.Event, error) {
	if limit < 1 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	var models []EventModel
	err := r.db.WithContext(ctx).
		Order("start_time ASC, id ASC").
		Limit(limit).
		Offset(offset).
		Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list events for export: %w", err)
	}
	out := make([]domain.Event, 0, len(models))
	for _, m := range models {
		out = append(out, eventModelToDomain(m))
	}
	return out, nil
}

func (r *eventRepositoryPostgres) ListTicketTypesByEventIDs(ctx context.Context, eventIDs []uuid.UUID) (map[uuid.UUID][]domain.TicketType, error) {
	if len(eventIDs) == 0 {
		return map[uuid.UUID][]domain.TicketType{}, nil
	}
	var models []TicketTypeModel
	err := r.db.WithContext(ctx).
		Where("event_id IN ?", eventIDs).
		Order("event_id ASC, created_at ASC").
		Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list ticket types by event ids: %w", err)
	}
	out := make(map[uuid.UUID][]domain.TicketType)
	for _, m := range models {
		tt := ticketTypeModelToDomain(m)
		out[tt.EventID] = append(out[tt.EventID], tt)
	}
	return out, nil
}

func (r *eventRepositoryPostgres) ListPhotosByEventIDs(ctx context.Context, eventIDs []uuid.UUID) (map[uuid.UUID][]domain.EventPhoto, error) {
	if len(eventIDs) == 0 {
		return map[uuid.UUID][]domain.EventPhoto{}, nil
	}
	var models []EventPhotoModel
	err := r.db.WithContext(ctx).
		Where("event_id IN ?", eventIDs).
		Order("event_id ASC, position ASC").
		Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list photos by event ids: %w", err)
	}
	out := make(map[uuid.UUID][]domain.EventPhoto)
	for _, m := range models {
		p := eventPhotoModelToDomain(m)
		out[p.EventID] = append(out[p.EventID], p)
	}
	return out, nil
}

func (r *eventRepositoryPostgres) ListCategoriesByEventIDs(ctx context.Context, eventIDs []uuid.UUID) (map[uuid.UUID][]domain.Category, error) {
	if len(eventIDs) == 0 {
		return map[uuid.UUID][]domain.Category{}, nil
	}
	type row struct {
		EventID    uuid.UUID `gorm:"column:event_id"`
		CategoryID uuid.UUID `gorm:"column:category_id"`
		Name       string
		CreatedAt  time.Time
	}
	var rows []row
	err := r.db.WithContext(ctx).
		Table("event_categories AS ec").
		Select("ec.event_id, c.id AS category_id, c.name, c.created_at").
		Joins("JOIN categories c ON c.id = ec.category_id").
		Where("ec.event_id IN ?", eventIDs).
		Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("list categories by event ids: %w", err)
	}
	out := make(map[uuid.UUID][]domain.Category)
	for _, rrow := range rows {
		out[rrow.EventID] = append(out[rrow.EventID], domain.Category{
			ID:        rrow.CategoryID,
			Name:      rrow.Name,
			CreatedAt: rrow.CreatedAt,
		})
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
			"organizer_id":       m.OrganizerID,
			"title":              m.Title,
			"description":        m.Description,
			"venue":              m.Venue,
			"featured_image_url": m.FeaturedImageURL,
			"event_detail":       m.EventDetail,
			"address":            m.Address,
			"city":               m.City,
			"country":            m.Country,
			"latitude":           m.Latitude,
			"longitude":          m.Longitude,
			"start_time":         m.StartAt,
			"end_time":           m.EndAt,
			"capacity":           m.Capacity,
			"status":             m.Status,
			"updated_at":         m.UpdatedAt,
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

// MarkCompleted moves published events whose end time has passed into the
// COMPLETED terminal state (assignment §7). Returns how many rows changed.
func (r *eventRepositoryPostgres) MarkCompleted(ctx context.Context, before time.Time) (int64, error) {
	res := r.db.WithContext(ctx).Model(&EventModel{}).
		Where("status = ? AND end_time < ?", string(domain.EventStatusPublished), before.UTC()).
		Updates(map[string]any{"status": string(domain.EventStatusCompleted), "updated_at": nowUTC()})
	if res.Error != nil {
		return 0, fmt.Errorf("mark events completed: %w", res.Error)
	}
	return res.RowsAffected, nil
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

// SetTicketTypes reconciles the event's ticket types against the desired set.
//
// It deliberately does NOT delete-then-reinsert every row: bookings reference
// ticket_types via a non-deferrable FK with ON DELETE RESTRICT, so wiping the
// table would abort the transaction for any event that has ever been booked
// (and would silently re-issue sold seats on events that had not). Instead we
// diff by primary key — rows present in both are UPDATEd in place, rows only in
// the desired set are INSERTed, and rows only in the database are DELETEd.
//
// A delete of a ticket type that still has bookings will surface as an FK error
// from PostgreSQL; callers are expected to have refused that case already
// (see EventService.Update / DeleteTicketType).
func (r *eventRepositoryPostgres) SetTicketTypes(ctx context.Context, eventID uuid.UUID, ticketTypes []domain.TicketType) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var current []TicketTypeModel
		if err := tx.Where("event_id = ?", eventID).Find(&current).Error; err != nil {
			return fmt.Errorf("load ticket types: %w", err)
		}
		existing := make(map[uuid.UUID]TicketTypeModel, len(current))
		for _, m := range current {
			existing[m.ID] = m
		}

		keep := make(map[uuid.UUID]struct{}, len(ticketTypes))
		inserts := make([]TicketTypeModel, 0, len(ticketTypes))

		for _, tt := range ticketTypes {
			tt.EventID = eventID
			if prev, ok := existing[tt.ID]; ok && tt.ID != uuid.Nil {
				keep[tt.ID] = struct{}{}
				tt.CreatedAt = prev.CreatedAt
				tt.UpdatedAt = nowUTC()
				if err := tx.Model(&TicketTypeModel{}).
					Where("id = ?", tt.ID).
					Updates(map[string]any{
						"name":       tt.Name,
						"price":      tt.Price,
						"quantity":   tt.Quantity,
						"available":  tt.Available,
						"updated_at": tt.UpdatedAt,
					}).Error; err != nil {
					return fmt.Errorf("update ticket type: %w", err)
				}
				continue
			}

			tt.ID = ensureID(tt.ID)
			keep[tt.ID] = struct{}{}
			if tt.CreatedAt.IsZero() {
				tt.CreatedAt = nowUTC()
			}
			tt.UpdatedAt = nowUTC()
			inserts = append(inserts, ticketTypeDomainToModel(tt))
		}

		removed := make([]uuid.UUID, 0, len(current))
		for id := range existing {
			if _, ok := keep[id]; !ok {
				removed = append(removed, id)
			}
		}
		if len(removed) > 0 {
			if err := tx.Where("id IN ?", removed).Delete(&TicketTypeModel{}).Error; err != nil {
				return fmt.Errorf("delete ticket types: %w", err)
			}
		}

		if len(inserts) > 0 {
			if err := tx.Create(&inserts).Error; err != nil {
				return fmt.Errorf("insert ticket types: %w", err)
			}
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
	return false, domain.ErrCapacityExceeded
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

func (r *bookingRepositoryPostgres) ListDistinctConfirmedUserIDsByEvent(ctx context.Context, eventID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := r.db.WithContext(ctx).
		Model(&BookingModel{}).
		Where("event_id = ? AND status = ?", eventID, string(domain.BookingStatusConfirmed)).
		Distinct("user_id").
		Pluck("user_id", &ids).Error
	if err != nil {
		return nil, fmt.Errorf("list distinct confirmed user ids: %w", err)
	}
	return ids, nil
}

func (r *bookingRepositoryPostgres) ListByEventIDs(ctx context.Context, eventIDs []uuid.UUID) ([]domain.Booking, error) {
	if len(eventIDs) == 0 {
		return nil, nil
	}
	var models []BookingModel
	err := r.db.WithContext(ctx).
		Where("event_id IN ?", eventIDs).
		Order("event_id ASC, created_at ASC").
		Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list bookings by event ids: %w", err)
	}
	out := make([]domain.Booking, 0, len(models))
	for _, m := range models {
		out = append(out, bookingModelToDomain(m))
	}
	return out, nil
}

func (r *bookingRepositoryPostgres) ListAllConfirmed(ctx context.Context) ([]domain.Booking, error) {
	var models []BookingModel
	err := r.db.WithContext(ctx).
		Where("status = ?", string(domain.BookingStatusConfirmed)).
		Order("created_at ASC").
		Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list all confirmed bookings: %w", err)
	}
	out := make([]domain.Booking, 0, len(models))
	for _, m := range models {
		out = append(out, bookingModelToDomain(m))
	}
	return out, nil
}

// ExistsBetweenAttendeeAndOrganizer reports whether attendeeID holds a booking
// on any event organized by organizerID. It is the gate for direct messaging
// (assignment §10: messaging becomes available after a booking).
func (r *bookingRepositoryPostgres) ExistsBetweenAttendeeAndOrganizer(ctx context.Context, attendeeID, organizerID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&BookingModel{}).
		Joins("JOIN events e ON e.id = bookings.event_id").
		Where("bookings.user_id = ? AND e.organizer_id = ?", attendeeID, organizerID).
		Count(&count).Error
	if err != nil {
		return false, fmt.Errorf("check booking between users: %w", err)
	}
	return count > 0, nil
}

// ListCorrespondentIDs returns every user the given user shares a booking with:
// the organizers of events they booked, plus the attendees who booked events
// they organize. This is the address book for direct messaging (§10).
func (r *bookingRepositoryPostgres) ListCorrespondentIDs(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := r.db.WithContext(ctx).Raw(`
		SELECT DISTINCT e.organizer_id AS id
		FROM bookings b
		JOIN events e ON e.id = b.event_id
		WHERE b.user_id = ? AND e.organizer_id <> ?
		UNION
		SELECT DISTINCT b.user_id AS id
		FROM bookings b
		JOIN events e ON e.id = b.event_id
		WHERE e.organizer_id = ? AND b.user_id <> ?
	`, userID, userID, userID, userID).Scan(&ids).Error
	if err != nil {
		return nil, fmt.Errorf("list correspondents: %w", err)
	}
	return ids, nil
}

func (r *bookingRepositoryPostgres) CountByTicketType(ctx context.Context, ticketTypeID uuid.UUID) (int, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&BookingModel{}).
		Where("ticket_type_id = ?", ticketTypeID).
		Count(&count).Error
	if err != nil {
		return 0, fmt.Errorf("count bookings by ticket type: %w", err)
	}
	return int(count), nil
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

func (r *messageRepositoryPostgres) CreateBatch(ctx context.Context, messages []domain.Message) ([]domain.Message, error) {
	if len(messages) == 0 {
		return nil, nil
	}
	for i := range messages {
		messages[i].ID = ensureID(messages[i].ID)
		messages[i].CreatedAt = nowUTC()
	}
	models := make([]MessageModel, len(messages))
	for i := range messages {
		models[i] = messageDomainToModel(messages[i])
	}
	if err := r.db.WithContext(ctx).Create(&models).Error; err != nil {
		return nil, fmt.Errorf("create batch messages: %w", err)
	}
	out := make([]domain.Message, len(models))
	for i := range models {
		out[i] = messageModelToDomain(models[i])
	}
	return out, nil
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

func (r *messageRepositoryPostgres) ListThread(ctx context.Context, userID, otherID uuid.UUID, limit, offset int) ([]domain.Message, error) {
	if limit < 1 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	var models []MessageModel
	err := r.db.WithContext(ctx).
		Where(
			"((sender_id = ? AND recipient_id = ? AND deleted_by_sender = ?) OR (sender_id = ? AND recipient_id = ? AND deleted_by_recipient = ?))",
			userID, otherID, false,
			otherID, userID, false,
		).
		Limit(limit).
		Offset(offset).
		Order("created_at ASC, id ASC").
		Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list thread: %w", err)
	}
	out := make([]domain.Message, 0, len(models))
	for _, m := range models {
		out = append(out, messageModelToDomain(m))
	}
	return out, nil
}

func (r *messageRepositoryPostgres) ListCounterpartIDs(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error) {
	type row struct {
		OtherID uuid.UUID `gorm:"column:other_id"`
	}
	var rows []row
	err := r.db.WithContext(ctx).
		Model(&MessageModel{}).
		Select("CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END AS other_id, MAX(created_at) AS last_at", userID).
		Where(
			"(sender_id = ? AND deleted_by_sender = ?) OR (recipient_id = ? AND deleted_by_recipient = ?)",
			userID, false, userID, false,
		).
		Group("other_id").
		Order("MAX(created_at) DESC").
		Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("list counterpart ids: %w", err)
	}
	out := make([]uuid.UUID, 0, len(rows))
	for _, r := range rows {
		if r.OtherID != userID {
			out = append(out, r.OtherID)
		}
	}
	return out, nil
}

func (r *messageRepositoryPostgres) LastInThread(ctx context.Context, userID, otherID uuid.UUID) (domain.Message, error) {
	var m MessageModel
	err := r.db.WithContext(ctx).
		Where(
			"((sender_id = ? AND recipient_id = ? AND deleted_by_sender = ?) OR (sender_id = ? AND recipient_id = ? AND deleted_by_recipient = ?))",
			userID, otherID, false,
			otherID, userID, false,
		).
		Order("created_at DESC, id DESC").
		First(&m).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domain.Message{}, domain.ErrNotFound
		}
		return domain.Message{}, fmt.Errorf("last in thread: %w", err)
	}
	return messageModelToDomain(m), nil
}

func (r *messageRepositoryPostgres) UnreadCountsBySender(ctx context.Context, userID uuid.UUID) (map[uuid.UUID]int, error) {
	type row struct {
		SenderID uuid.UUID `gorm:"column:sender_id"`
		Total    int       `gorm:"column:total"`
	}
	var rows []row
	err := r.db.WithContext(ctx).
		Model(&MessageModel{}).
		Select("sender_id, COUNT(*) AS total").
		Where("recipient_id = ? AND read_at IS NULL AND deleted_by_recipient = ?", userID, false).
		Group("sender_id").
		Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("unread counts by sender: %w", err)
	}
	out := make(map[uuid.UUID]int, len(rows))
	for _, r := range rows {
		out[r.SenderID] = r.Total
	}
	return out, nil
}

func (r *messageRepositoryPostgres) MarkThreadAsRead(ctx context.Context, userID, otherID uuid.UUID) (int, error) {
	res := r.db.WithContext(ctx).Model(&MessageModel{}).
		Where(
			"recipient_id = ? AND sender_id = ? AND read_at IS NULL AND deleted_by_recipient = ?",
			userID, otherID, false,
		).
		Update("read_at", nowUTC())
	if res.Error != nil {
		return 0, fmt.Errorf("mark thread as read: %w", res.Error)
	}
	return int(res.RowsAffected), nil
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

func (r *messageRepositoryPostgres) GetByID(ctx context.Context, messageID uuid.UUID) (domain.Message, error) {
	var m MessageModel
	if err := r.db.WithContext(ctx).First(&m, "id = ?", messageID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domain.Message{}, domain.ErrNotFound
		}
		return domain.Message{}, fmt.Errorf("get message: %w", err)
	}
	return messageModelToDomain(m), nil
}

func (r *messageRepositoryPostgres) DeleteForEveryone(ctx context.Context, messageID uuid.UUID) error {
	// The row stays so the tombstone renders in order, but nothing of the
	// content survives.
	res := r.db.WithContext(ctx).Model(&MessageModel{}).
		Where("id = ?", messageID).
		Updates(map[string]any{
			"deleted_for_everyone": true,
			"body":                 "",
			"image_url":            "",
			"file_url":             "",
			"file_name":            "",
			"gif_url":              "",
		})
	if res.Error != nil {
		return fmt.Errorf("delete message for everyone: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *messageRepositoryPostgres) ListPreviews(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]domain.MessagePreview, error) {
	out := make(map[uuid.UUID]domain.MessagePreview, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	var models []MessageModel
	if err := r.db.WithContext(ctx).Where("id IN ?", ids).Find(&models).Error; err != nil {
		return nil, fmt.Errorf("list message previews: %w", err)
	}
	for _, m := range models {
		body := m.Body
		switch {
		case m.DeletedForEveryone:
			body = ""
		case body == "" && m.ImageURL != "":
			body = "📷 Φωτογραφία"
		case body == "" && m.GifURL != "":
			body = "GIF"
		case body == "" && m.FileURL != "":
			body = "📎 " + m.FileName
		}
		out[m.ID] = domain.MessagePreview{
			ID:       m.ID.String(),
			SenderID: m.SenderID,
			Body:     body,
			Deleted:  m.DeletedForEveryone,
		}
	}
	return out, nil
}

func (r *messageRepositoryPostgres) AddReaction(ctx context.Context, messageID, userID uuid.UUID, emoji string) error {
	reaction := MailboxReactionModel{
		ID:        uuid.New(),
		MessageID: messageID,
		UserID:    userID,
		Emoji:     emoji,
		CreatedAt: nowUTC(),
	}
	// Reacting twice with the same emoji is a no-op, not an error.
	err := r.db.WithContext(ctx).
		Clauses(clause.OnConflict{Columns: []clause.Column{
			{Name: "message_id"}, {Name: "user_id"}, {Name: "emoji"},
		}, DoNothing: true}).
		Create(&reaction).Error
	if err != nil {
		return fmt.Errorf("add reaction: %w", err)
	}
	return nil
}

func (r *messageRepositoryPostgres) RemoveReaction(ctx context.Context, messageID, userID uuid.UUID, emoji string) error {
	err := r.db.WithContext(ctx).
		Where("message_id = ? AND user_id = ? AND emoji = ?", messageID, userID, emoji).
		Delete(&MailboxReactionModel{}).Error
	if err != nil {
		return fmt.Errorf("remove reaction: %w", err)
	}
	return nil
}

func (r *messageRepositoryPostgres) ListReactions(ctx context.Context, messageIDs []uuid.UUID) (map[uuid.UUID][]domain.MailboxReaction, error) {
	out := make(map[uuid.UUID][]domain.MailboxReaction, len(messageIDs))
	if len(messageIDs) == 0 {
		return out, nil
	}
	var models []MailboxReactionModel
	err := r.db.WithContext(ctx).
		Where("message_id IN ?", messageIDs).
		Order("created_at ASC").
		Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list reactions: %w", err)
	}
	for _, m := range models {
		out[m.MessageID] = append(out[m.MessageID], domain.MailboxReaction{
			ID:        m.ID,
			MessageID: m.MessageID,
			UserID:    m.UserID,
			Emoji:     m.Emoji,
			CreatedAt: m.CreatedAt,
		})
	}
	return out, nil
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

// MarkAsReadByIDs marks only the given messages read. Listing the inbox marks
// the page the caller actually received, rather than the entire mailbox.
func (r *messageRepositoryPostgres) MarkAsReadByIDs(ctx context.Context, userID uuid.UUID, ids []uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}
	res := r.db.WithContext(ctx).Model(&MessageModel{}).
		Where("recipient_id = ? AND id IN ? AND read_at IS NULL AND deleted_by_recipient = ?", userID, ids, false).
		Update("read_at", nowUTC())
	if res.Error != nil {
		return fmt.Errorf("mark messages as read by ids: %w", res.Error)
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
		UserID:   userID,
		EventID:  eventID,
		ViewedAt: nowUTC(),
	}
	if err := r.db.WithContext(ctx).Create(&view).Error; err != nil {
		return fmt.Errorf("record user event view: %w", err)
	}
	return nil
}

func (r *userEventViewRepositoryPostgres) ListAll(ctx context.Context) ([]domain.UserEventView, error) {
	var models []UserEventViewModel
	err := r.db.WithContext(ctx).Order("viewed_at ASC").Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list all user event views: %w", err)
	}
	out := make([]domain.UserEventView, 0, len(models))
	for _, m := range models {
		out = append(out, domain.UserEventView{
			UserID:   m.UserID,
			EventID:  m.EventID,
			ViewedAt: m.ViewedAt,
		})
	}
	return out, nil
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
