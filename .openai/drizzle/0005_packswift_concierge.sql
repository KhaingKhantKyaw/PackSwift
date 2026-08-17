CREATE TABLE IF NOT EXISTS hosted_trip_itinerary_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_session_id INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'packswift_catalog',
  place_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_session_id) REFERENCES hosted_trip_sessions(id) ON DELETE CASCADE,
  UNIQUE (trip_session_id, provider, place_id)
);

CREATE INDEX IF NOT EXISTS idx_hosted_trip_itinerary_position
ON hosted_trip_itinerary_items(trip_session_id, position);

CREATE TABLE IF NOT EXISTS hosted_ai_rate_limits (
  requester_hash TEXT NOT NULL,
  window_bucket INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (requester_hash, window_bucket)
);

PRAGMA optimize;
