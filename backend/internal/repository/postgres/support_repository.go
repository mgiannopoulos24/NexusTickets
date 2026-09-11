package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"nexustickets/internal/domain"
	repo "nexustickets/internal/repository"
)

// NewSupportRepositoryPostgres creates a SupportRepository backed by GORM.
func NewSupportRepositoryPostgres(db *gorm.DB) repo.SupportRepository {
	return &supportRepositoryPostgres{db: db}
}

type supportRepositoryPostgres struct {
	db *gorm.DB
}

func (r *supportRepositoryPostgres) CreateTicket(ctx context.Context, ticket domain.SupportTicket, opening domain.SupportMessage) (domain.SupportTicket, error) {
	now := nowUTC()
	ticket.ID = ensureID(ticket.ID)
	ticket.CreatedAt = now
	ticket.UpdatedAt = now
	opening.ID = ensureID(opening.ID)
	opening.TicketID = ticket.ID
	opening.CreatedAt = now

	tm := supportTicketDomainToModel(ticket)
	mm := supportMessageDomainToModel(opening)
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&tm).Error; err != nil {
			return fmt.Errorf("create support ticket: %w", err)
		}
		if err := tx.Create(&mm).Error; err != nil {
			return fmt.Errorf("create support ticket opening message: %w", err)
		}
		return nil
	})
	if err != nil {
		return domain.SupportTicket{}, err
	}
	return supportTicketModelToDomain(tm), nil
}

func (r *supportRepositoryPostgres) GetTicket(ctx context.Context, ticketID uuid.UUID) (domain.SupportTicket, error) {
	var m SupportTicketModel
	if err := r.db.WithContext(ctx).First(&m, "id = ?", ticketID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domain.SupportTicket{}, domain.ErrNotFound
		}
		return domain.SupportTicket{}, fmt.Errorf("get support ticket: %w", err)
	}
	return supportTicketModelToDomain(m), nil
}

func (r *supportRepositoryPostgres) listTickets(ctx context.Context, scope *gorm.DB, limit, offset int) ([]domain.SupportTicket, int, error) {
	if limit < 1 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	var total int64
	if err := scope.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count support tickets: %w", err)
	}
	var models []SupportTicketModel
	if err := scope.Order("updated_at DESC").Limit(limit).Offset(offset).Find(&models).Error; err != nil {
		return nil, 0, fmt.Errorf("list support tickets: %w", err)
	}
	out := make([]domain.SupportTicket, 0, len(models))
	for _, m := range models {
		out = append(out, supportTicketModelToDomain(m))
	}
	return out, int(total), nil
}

func (r *supportRepositoryPostgres) ListTicketsByUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.SupportTicket, int, error) {
	scope := r.db.WithContext(ctx).Model(&SupportTicketModel{}).Where("user_id = ?", userID)
	return r.listTickets(ctx, scope, limit, offset)
}

func (r *supportRepositoryPostgres) ListTickets(ctx context.Context, status *domain.SupportTicketStatus, limit, offset int) ([]domain.SupportTicket, int, error) {
	scope := r.db.WithContext(ctx).Model(&SupportTicketModel{})
	if status != nil {
		scope = scope.Where("status = ?", string(*status))
	}
	return r.listTickets(ctx, scope, limit, offset)
}

func (r *supportRepositoryPostgres) CountTicketsByStatus(ctx context.Context) (map[domain.SupportTicketStatus]int, error) {
	var rows []struct {
		Status string
		N      int
	}
	err := r.db.WithContext(ctx).Model(&SupportTicketModel{}).
		Select("status, count(*) AS n").
		Group("status").
		Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("count support tickets by status: %w", err)
	}
	out := make(map[domain.SupportTicketStatus]int, len(rows))
	for _, row := range rows {
		out[domain.SupportTicketStatus(row.Status)] = row.N
	}
	return out, nil
}

func (r *supportRepositoryPostgres) AddMessage(ctx context.Context, message domain.SupportMessage, status domain.SupportTicketStatus) (domain.SupportMessage, error) {
	message.ID = ensureID(message.ID)
	message.CreatedAt = nowUTC()
	m := supportMessageDomainToModel(message)
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&m).Error; err != nil {
			return fmt.Errorf("create support message: %w", err)
		}
		res := tx.Model(&SupportTicketModel{}).
			Where("id = ?", message.TicketID).
			Updates(map[string]any{"status": string(status), "updated_at": message.CreatedAt})
		if res.Error != nil {
			return fmt.Errorf("update support ticket after reply: %w", res.Error)
		}
		if res.RowsAffected == 0 {
			return domain.ErrNotFound
		}
		return nil
	})
	if err != nil {
		return domain.SupportMessage{}, err
	}
	return supportMessageModelToDomain(m), nil
}

func (r *supportRepositoryPostgres) ListMessages(ctx context.Context, ticketID uuid.UUID) ([]domain.SupportMessage, error) {
	var models []SupportMessageModel
	err := r.db.WithContext(ctx).
		Where("ticket_id = ?", ticketID).
		Order("created_at ASC").
		Find(&models).Error
	if err != nil {
		return nil, fmt.Errorf("list support messages: %w", err)
	}
	out := make([]domain.SupportMessage, 0, len(models))
	for _, m := range models {
		out = append(out, supportMessageModelToDomain(m))
	}
	return out, nil
}

func (r *supportRepositoryPostgres) SetTicketStatus(ctx context.Context, ticketID uuid.UUID, status domain.SupportTicketStatus) error {
	res := r.db.WithContext(ctx).Model(&SupportTicketModel{}).
		Where("id = ?", ticketID).
		Updates(map[string]any{"status": string(status), "updated_at": nowUTC()})
	if res.Error != nil {
		return fmt.Errorf("set support ticket status: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}
