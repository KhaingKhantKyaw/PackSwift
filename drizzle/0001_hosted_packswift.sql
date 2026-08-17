PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS hosted_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform_email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hosted_saved_trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plan_id TEXT NOT NULL,
  destination TEXT NOT NULL,
  travel_month TEXT NOT NULL,
  budget REAL NOT NULL,
  trip_data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES hosted_users(id) ON DELETE CASCADE,
  UNIQUE (user_id, plan_id)
);

CREATE INDEX IF NOT EXISTS idx_hosted_saved_trips_user
  ON hosted_saved_trips(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS hosted_trip_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  trip_data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES hosted_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hosted_trip_sessions_user
  ON hosted_trip_sessions(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS hosted_readiness_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_session_id INTEGER NOT NULL,
  item_key TEXT NOT NULL,
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT NOT NULL,
  assistant_type TEXT NOT NULL DEFAULT 'manual',
  is_completed INTEGER NOT NULL DEFAULT 0,
  completion_source TEXT,
  confirmation_reference TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_session_id) REFERENCES hosted_trip_sessions(id) ON DELETE CASCADE,
  UNIQUE (trip_session_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_hosted_readiness_progress
  ON hosted_readiness_items(trip_session_id, is_completed);

CREATE TABLE IF NOT EXISTS hosted_packing_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_session_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_session_id) REFERENCES hosted_trip_sessions(id) ON DELETE CASCADE,
  UNIQUE (trip_session_id, category, item_name)
);

CREATE INDEX IF NOT EXISTS idx_hosted_packing_trip
  ON hosted_packing_items(trip_session_id, category);

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
