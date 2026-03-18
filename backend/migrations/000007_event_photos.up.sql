CREATE TABLE IF NOT EXISTS event_photos (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE event_photos
  ADD CONSTRAINT event_photos_position_chk CHECK (position >= 0);

CREATE INDEX IF NOT EXISTS event_photos_event_id_idx ON event_photos (event_id);
CREATE UNIQUE INDEX IF NOT EXISTS event_photos_event_position_uq ON event_photos (event_id, position);
