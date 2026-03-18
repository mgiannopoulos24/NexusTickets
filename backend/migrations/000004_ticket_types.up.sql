CREATE TABLE IF NOT EXISTS ticket_types (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  quantity INTEGER NOT NULL,
  available INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ticket_types
  ADD CONSTRAINT ticket_types_price_chk CHECK (price >= 0);

ALTER TABLE ticket_types
  ADD CONSTRAINT ticket_types_quantity_chk CHECK (quantity >= 0);

ALTER TABLE ticket_types
  ADD CONSTRAINT ticket_types_available_chk CHECK (available >= 0 AND available <= quantity);

CREATE UNIQUE INDEX IF NOT EXISTS ticket_types_event_name_uq ON ticket_types (event_id, name);
CREATE INDEX IF NOT EXISTS ticket_types_event_id_idx ON ticket_types (event_id);
