CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY,
  organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  venue TEXT NOT NULL,
  address TEXT,
  city TEXT NOT NULL,
  country TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  capacity INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector(
      'greek',
      coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(venue, '') || ' ' ||
      coalesce(city, '')
    )
  ) STORED
);

ALTER TABLE events
  ADD CONSTRAINT events_capacity_chk CHECK (capacity >= 0);

ALTER TABLE events
  ADD CONSTRAINT events_time_chk CHECK (end_time >= start_time);

ALTER TABLE events
  ADD CONSTRAINT events_status_chk CHECK (status IN ('draft', 'published', 'cancelled', 'deleted'));

CREATE INDEX IF NOT EXISTS events_organizer_id_idx ON events (organizer_id);
CREATE INDEX IF NOT EXISTS events_status_start_time_idx ON events (status, start_time);
CREATE INDEX IF NOT EXISTS events_city_idx ON events (city);
CREATE INDEX IF NOT EXISTS events_search_vector_gin_idx ON events USING GIN (search_vector);
