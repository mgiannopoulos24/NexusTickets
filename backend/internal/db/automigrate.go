package db

import (
	"fmt"

	"gorm.io/gorm"

	"nexustickets/internal/repository/postgres"
)

// addConstraint adds a constraint only if it doesn't already exist.
// PostgreSQL does not support ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS,
// so we use a PL/pgSQL DO block that checks pg_constraint first.
func addConstraint(db *gorm.DB, name, table, definition string) error {
	sql := fmt.Sprintf(`DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = '%[1]s' AND connamespace = 'public'::regnamespace
	) THEN
		ALTER TABLE %[2]s ADD CONSTRAINT %[1]s %[3]s;
	END IF;
END $$;`, name, table, definition)
	return db.Exec(sql).Error
}

func AutoMigrate(db *gorm.DB) error {
	// Drop generated search_vector column so GORM can freely alter
	// referenced columns (title, description, venue, city) without
	// PostgreSQL complaining about generated column dependencies.
	// Safe to call on first run (no events table yet) — error is ignored.
	_ = db.Exec(`ALTER TABLE events DROP COLUMN IF EXISTS search_vector`).Error

	// The status CHECK was widened to admit 'completed' (assignment §7: DRAFT,
	// PUBLISHED, COMPLETED, CANCELLED). Drop the narrower v1 constraint so the
	// v2 one below can take its place on existing databases.
	_ = db.Exec(`ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_chk`).Error

	// The messaging subsystem was reduced to the mailbox the assignment asks
	// for (§10: inbox / sent, unread indicator, delete). Drop the leftovers of
	// the earlier chat-room implementation and the attachment / reaction /
	// tombstone columns on messages. GORM never drops on its own.
	for _, stmt := range []string{
		`DROP TABLE IF EXISTS message_reactions`,
		`DROP TABLE IF EXISTS chat_messages`,
		`DROP TABLE IF EXISTS chat_room_participants`,
		`DROP TABLE IF EXISTS chat_rooms`,
		`DROP TABLE IF EXISTS mailbox_message_reactions`,
		`ALTER TABLE messages DROP COLUMN IF EXISTS image_url`,
		`ALTER TABLE messages DROP COLUMN IF EXISTS file_url`,
		`ALTER TABLE messages DROP COLUMN IF EXISTS file_name`,
		`ALTER TABLE messages DROP COLUMN IF EXISTS gif_url`,
		`ALTER TABLE messages DROP COLUMN IF EXISTS reply_to_id`,
		`ALTER TABLE messages DROP COLUMN IF EXISTS deleted_for_everyone`,
	} {
		_ = db.Exec(stmt).Error
	}

	models := []interface{}{
		&postgres.UserModel{},
		&postgres.CategoryModel{},
		&postgres.EventModel{},
		&postgres.EventCategoryModel{},
		&postgres.TicketTypeModel{},
		&postgres.BookingModel{},
		&postgres.MessageModel{},
		&postgres.EventPhotoModel{},
		&postgres.UserEventViewModel{},
		&postgres.SupportTicketModel{},
		&postgres.SupportMessageModel{},
	}

	if err := db.AutoMigrate(models...); err != nil {
		return fmt.Errorf("auto migrate: %w", err)
	}

	// CHECK constraints
	for _, c := range []struct{ name, table, def string }{
		{"users_role_chk", "users", "CHECK (role IN ('admin', 'organizer', 'attendee', 'guest'))"},
		{"users_account_status_chk", "users", "CHECK (account_status IN ('pending', 'approved', 'rejected'))"},
		{"events_capacity_chk", "events", "CHECK (capacity >= 0)"},
		{"events_time_chk", "events", "CHECK (end_time >= start_time)"},
		{"events_status_chk_v2", "events", "CHECK (status IN ('draft', 'published', 'completed', 'cancelled', 'deleted'))"},
		{"ticket_types_price_chk", "ticket_types", "CHECK (price >= 0)"},
		{"ticket_types_quantity_chk", "ticket_types", "CHECK (quantity >= 0)"},
		{"ticket_types_available_chk", "ticket_types", "CHECK (available >= 0 AND available <= quantity)"},
		{"bookings_quantity_chk", "bookings", "CHECK (quantity > 0)"},
		{"bookings_total_cost_chk", "bookings", "CHECK (total_cost >= 0)"},
		{"bookings_status_chk", "bookings", "CHECK (status IN ('pending', 'confirmed', 'cancelled'))"},
		{"event_photos_position_chk", "event_photos", "CHECK (position >= 0)"},
		{"support_tickets_status_chk", "support_tickets", "CHECK (status IN ('open', 'answered', 'closed'))"},
	} {
		if err := addConstraint(db, c.name, c.table, c.def); err != nil {
			return fmt.Errorf("constraint %s: %w", c.name, err)
		}
	}

	// FK constraints
	for _, c := range []struct{ name, table, def string }{
		{"fk_events_organizer", "events", "FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE RESTRICT"},
		{"fk_ec_event", "event_categories", "FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE"},
		{"fk_ec_category", "event_categories", "FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT"},
		{"fk_ticket_types_event", "ticket_types", "FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE"},
		{"fk_bookings_user", "bookings", "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT"},
		{"fk_bookings_event", "bookings", "FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT"},
		{"fk_bookings_ticket_type", "bookings", "FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT"},
		{"fk_messages_sender", "messages", "FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE RESTRICT"},
		{"fk_messages_recipient", "messages", "FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE RESTRICT"},
		{"fk_messages_event", "messages", "FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL"},
		{"fk_event_photos_event", "event_photos", "FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE"},
		{"fk_uev_user", "user_event_views", "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"},
		{"fk_uev_event", "user_event_views", "FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE"},
		{"fk_support_tickets_user", "support_tickets", "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT"},
		{"fk_support_messages_ticket", "support_ticket_messages", "FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE"},
		{"fk_support_messages_author", "support_ticket_messages", "FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT"},
	} {
		if err := addConstraint(db, c.name, c.table, c.def); err != nil {
			return fmt.Errorf("constraint %s: %w", c.name, err)
		}
	}

	schemaSQL := []string{
		// Full-text search
		`ALTER TABLE events ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (to_tsvector('greek', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(venue, '') || ' ' || coalesce(city, ''))) STORED`,

		// Composite unique indexes
		`CREATE UNIQUE INDEX IF NOT EXISTS ticket_types_event_name_uq ON ticket_types (event_id, name)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS event_photos_event_position_uq ON event_photos (event_id, position)`,

		// Additional indexes
		`CREATE INDEX IF NOT EXISTS events_search_vector_gin_idx ON events USING GIN (search_vector)`,
		`CREATE INDEX IF NOT EXISTS events_organizer_id_idx ON events (organizer_id)`,
		`CREATE INDEX IF NOT EXISTS events_status_start_time_idx ON events (status, start_time)`,
		`CREATE INDEX IF NOT EXISTS events_city_idx ON events (city)`,
		`CREATE INDEX IF NOT EXISTS event_categories_category_id_idx ON event_categories (category_id)`,
		`CREATE INDEX IF NOT EXISTS ticket_types_event_id_idx ON ticket_types (event_id)`,
		`CREATE INDEX IF NOT EXISTS bookings_user_id_created_at_idx ON bookings (user_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS bookings_event_id_created_at_idx ON bookings (event_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS bookings_ticket_type_id_idx ON bookings (ticket_type_id)`,
		`CREATE INDEX IF NOT EXISTS messages_sender_created_at_idx ON messages (sender_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS messages_recipient_created_at_idx ON messages (recipient_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS messages_recipient_unread_idx ON messages (recipient_id) WHERE read_at IS NULL`,
		`CREATE INDEX IF NOT EXISTS messages_event_id_idx ON messages (event_id) WHERE event_id IS NOT NULL`,
		`CREATE INDEX IF NOT EXISTS support_tickets_user_updated_idx ON support_tickets (user_id, updated_at DESC)`,
		`CREATE INDEX IF NOT EXISTS support_tickets_status_updated_idx ON support_tickets (status, updated_at DESC)`,
		`CREATE INDEX IF NOT EXISTS support_messages_ticket_created_idx ON support_ticket_messages (ticket_id, created_at)`,
		`CREATE INDEX IF NOT EXISTS event_photos_event_id_idx ON event_photos (event_id)`,
		`CREATE INDEX IF NOT EXISTS user_event_views_user_viewed_at_idx ON user_event_views (user_id, viewed_at DESC)`,
		`CREATE INDEX IF NOT EXISTS user_event_views_event_viewed_at_idx ON user_event_views (event_id, viewed_at DESC)`,
	}

	for _, stmt := range schemaSQL {
		if err := db.Exec(stmt).Error; err != nil {
			return fmt.Errorf("schema statement failed: %w\nSQL: %s", err, stmt)
		}
	}

	return nil
}
