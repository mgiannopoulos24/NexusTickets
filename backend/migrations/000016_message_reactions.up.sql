CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS message_reactions_message_idx ON message_reactions (message_id);
CREATE INDEX IF NOT EXISTS message_reactions_user_idx ON message_reactions (user_id);