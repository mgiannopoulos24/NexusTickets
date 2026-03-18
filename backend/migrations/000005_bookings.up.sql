CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  ticket_type_id UUID NOT NULL REFERENCES ticket_types(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  total_cost NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bookings
  ADD CONSTRAINT bookings_quantity_chk CHECK (quantity > 0);

ALTER TABLE bookings
  ADD CONSTRAINT bookings_total_cost_chk CHECK (total_cost >= 0);

ALTER TABLE bookings
  ADD CONSTRAINT bookings_status_chk CHECK (status IN ('pending', 'confirmed', 'cancelled'));

CREATE INDEX IF NOT EXISTS bookings_user_id_created_at_idx ON bookings (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_event_id_created_at_idx ON bookings (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_ticket_type_id_idx ON bookings (ticket_type_id);
