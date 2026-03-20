package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"nexustickets/internal/domain"
)

// CreateBookingWithDecrement creates a booking and decrements ticket availability in one transaction.
func (r *bookingRepositoryPostgres) CreateBookingWithDecrement(
	ctx context.Context,
	booking domain.Booking,
	ticketTypeID uuid.UUID,
	quantity int,
) (domain.Booking, error) {
	if quantity <= 0 {
		return domain.Booking{}, fmt.Errorf("create booking: quantity must be > 0")
	}

	var out domain.Booking
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&TicketTypeModel{}).
			Where("id = ? AND available >= ?", ticketTypeID, quantity).
			Update("available", gorm.Expr("available - ?", quantity))
		if res.Error != nil {
			return fmt.Errorf("decrement availability: %w", res.Error)
		}
		if res.RowsAffected != 1 {
			var count int64
			if err := tx.Model(&TicketTypeModel{}).Where("id = ?", ticketTypeID).Count(&count).Error; err != nil {
				return fmt.Errorf("decrement availability: count ticket types: %w", err)
			}
			if count == 0 {
				return domain.ErrNotFound
			}
			return domain.ErrCapacityExceeded
		}

		booking.ID = ensureID(booking.ID)
		booking.CreatedAt = nowUTC()
		booking.UpdatedAt = nowUTC()
		m := bookingDomainToModel(booking)
		if err := tx.Create(&m).Error; err != nil {
			return fmt.Errorf("create booking: %w", err)
		}
		out = bookingModelToDomain(m)
		return nil
	})
	if err != nil {
		return domain.Booking{}, err
	}
	return out, nil
}
