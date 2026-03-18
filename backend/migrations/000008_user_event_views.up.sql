CREATE TABLE IF NOT EXISTS user_event_views (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_event_views_user_viewed_at_idx ON user_event_views (user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS user_event_views_event_viewed_at_idx ON user_event_views (event_id, viewed_at DESC);
