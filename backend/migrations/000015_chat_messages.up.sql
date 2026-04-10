CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content TEXT,
  image_url TEXT,
  file_url TEXT,
  file_name TEXT,
  gif_url TEXT,
  reply_to_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_room_created_idx ON chat_messages (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_sender_idx ON chat_messages (sender_id);