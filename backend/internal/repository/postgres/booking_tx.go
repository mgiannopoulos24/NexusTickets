package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

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

// Confirm turns a live hold into a confirmed booking. The status and age are
// checked in the UPDATE itself, so a hold the sweeper releases at the same
// moment cannot also be confirmed.
func (r *bookingRepositoryPostgres) Confirm(ctx context.Context, bookingID uuid.UUID, holdCutoff time.Time) (domain.Booking, error) {
	now := nowUTC()
	var m BookingModel
	res := r.db.WithContext(ctx).
		Model(&m).
		Clauses(clause.Returning{}).
		Where("id = ? AND status = ? AND created_at > ?", bookingID, string(domain.BookingStatusPending), holdCutoff).
		Updates(map[string]any{
			"status":       string(domain.BookingStatusConfirmed),
			"confirmed_at": now,
			"updated_at":   now,
		})
	if res.Error != nil {
		return domain.Booking{}, fmt.Errorf("confirm booking: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return domain.Booking{}, domain.ErrBookingNotPending
	}
	return bookingModelToDomain(m), nil
}

func (r *bookingRepositoryPostgres) Release(ctx context.Context, bookingID uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		n, err := releaseHolds(tx, "id = ?", bookingID)
		if err != nil {
			return err
		}
		if n == 0 {
			return domain.ErrBookingNotPending
		}
		return nil
	})
}

func (r *bookingRepositoryPostgres) ReleaseExpired(ctx context.Context, holdCutoff time.Time) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var err error
		n, err = releaseHolds(tx, "created_at <= ?", holdCutoff)
		return err
	})
	return n, err
}

func (r *bookingRepositoryPostgres) CancelByEvent(ctx context.Context, eventID uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if _, err := releaseHolds(tx, "event_id = ?", eventID); err != nil {
			return err
		}
		// Confirmed tickets stay counted as sold: the event is over for good,
		// and the figures record what had been booked when it was cancelled.
		err := tx.Model(&BookingModel{}).
			Where("event_id = ? AND status = ?", eventID, string(domain.BookingStatusConfirmed)).
			Updates(map[string]any{
				"status":     string(domain.BookingStatusCancelled),
				"updated_at": nowUTC(),
			}).Error
		if err != nil {
			return fmt.Errorf("cancel event bookings: %w", err)
		}
		return nil
	})
}

// releaseHolds cancels the PENDING bookings matching the condition and returns
// their seats to the ticket types they were taken from.
func releaseHolds(tx *gorm.DB, cond string, args ...any) (int64, error) {
	var released []BookingModel
	err := tx.Model(&released).
		Clauses(clause.Returning{Columns: []clause.Column{{Name: "ticket_type_id"}, {Name: "quantity"}}}).
		Where("status = ?", string(domain.BookingStatusPending)).
		Where(cond, args...).
		Updates(map[string]any{
			"status":     string(domain.BookingStatusCancelled),
			"updated_at": nowUTC(),
		}).Error
	if err != nil {
		return 0, fmt.Errorf("release booking holds: %w", err)
	}

	seats := make(map[uuid.UUID]int, len(released))
	for _, b := range released {
		seats[b.TicketTypeID] += b.Quantity
	}
	for ttID, qty := range seats {
		err := tx.Model(&TicketTypeModel{}).
			Where("id = ?", ttID).
			Update("available", gorm.Expr("LEAST(available + ?, quantity)", qty)).Error
		if err != nil {
			return 0, fmt.Errorf("return held seats: %w", err)
		}
	}
	return int64(len(released)), nil
}

// dropAbandonedHolds deletes the holds matching the condition that lapsed or
// were released without ever being confirmed. They record no sale, and the
// bookings foreign keys would otherwise stop the event or ticket type they
// point at from being deleted. Bookings that were confirmed are never touched.
func dropAbandonedHolds(tx *gorm.DB, cond string, args ...any) error {
	err := tx.Where("status = ? AND confirmed_at IS NULL", string(domain.BookingStatusCancelled)).
		Where(cond, args...).
		Delete(&BookingModel{}).Error
	if err != nil {
		return fmt.Errorf("drop abandoned holds: %w", err)
	}
	return nil
}
