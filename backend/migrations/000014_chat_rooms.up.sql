CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY,
  is_group BOOLEAN NOT NULL DEFAULT FALSE,
  name TEXT,
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  is_read_only BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_rooms_event_idx ON chat_rooms (event_id) WHERE event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS chat_room_participants (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS chat_room_participants_user_idx ON chat_room_participants (user_id);