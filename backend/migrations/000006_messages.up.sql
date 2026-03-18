CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  deleted_by_sender BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_by_recipient BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_sender_created_at_idx ON messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_recipient_created_at_idx ON messages (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_recipient_unread_idx ON messages (recipient_id) WHERE read_at IS NULL;
