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
		&postgres.ChatRoomModel{},
		&postgres.ChatRoomParticipantModel{},
		&postgres.ChatMessageModel{},
		&postgres.MessageReactionModel{},
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
		{"events_status_chk", "events", "CHECK (status IN ('draft', 'published', 'cancelled', 'deleted'))"},
		{"ticket_types_price_chk", "ticket_types", "CHECK (price >= 0)"},
		{"ticket_types_quantity_chk", "ticket_types", "CHECK (quantity >= 0)"},
		{"ticket_types_available_chk", "ticket_types", "CHECK (available >= 0 AND available <= quantity)"},
		{"bookings_quantity_chk", "bookings", "CHECK (quantity > 0)"},
		{"bookings_total_cost_chk", "bookings", "CHECK (total_cost >= 0)"},
		{"bookings_status_chk", "bookings", "CHECK (status IN ('pending', 'confirmed', 'cancelled'))"},
		{"event_photos_position_chk", "event_photos", "CHECK (position >= 0)"},
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
		{"fk_event_photos_event", "event_photos", "FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE"},
		{"fk_uev_user", "user_event_views", "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"},
		{"fk_uev_event", "user_event_views", "FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE"},
		{"fk_chat_rooms_created_by", "chat_rooms", "FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL"},
		{"fk_chat_rooms_event", "chat_rooms", "FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL"},
		{"fk_crp_room", "chat_room_participants", "FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE"},
		{"fk_crp_user", "chat_room_participants", "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"},
		{"fk_cm_room", "chat_messages", "FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE"},
		{"fk_cm_sender", "chat_messages", "FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE RESTRICT"},
		{"fk_cm_reply_to", "chat_messages", "FOREIGN KEY (reply_to_id) REFERENCES chat_messages(id) ON DELETE SET NULL"},
		{"fk_mr_message", "message_reactions", "FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE"},
		{"fk_mr_user", "message_reactions", "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"},
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
		`CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_no_duplicate_reaction ON message_reactions (message_id, user_id, reaction_type)`,

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
		`CREATE INDEX IF NOT EXISTS event_photos_event_id_idx ON event_photos (event_id)`,
		`CREATE INDEX IF NOT EXISTS user_event_views_user_viewed_at_idx ON user_event_views (user_id, viewed_at DESC)`,
		`CREATE INDEX IF NOT EXISTS user_event_views_event_viewed_at_idx ON user_event_views (event_id, viewed_at DESC)`,
		`CREATE INDEX IF NOT EXISTS chat_rooms_event_idx ON chat_rooms (event_id) WHERE event_id IS NOT NULL`,
		`CREATE INDEX IF NOT EXISTS chat_room_participants_user_idx ON chat_room_participants (user_id)`,
		`CREATE INDEX IF NOT EXISTS chat_messages_room_created_idx ON chat_messages (room_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS chat_messages_sender_idx ON chat_messages (sender_id)`,
		`CREATE INDEX IF NOT EXISTS message_reactions_message_idx ON message_reactions (message_id)`,
		`CREATE INDEX IF NOT EXISTS message_reactions_user_idx ON message_reactions (user_id)`,
	}

	for _, stmt := range schemaSQL {
		if err := db.Exec(stmt).Error; err != nil {
			return fmt.Errorf("schema statement failed: %w\nSQL: %s", err, stmt)
		}
	}

	return nil
}
