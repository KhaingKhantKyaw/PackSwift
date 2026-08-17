ALTER TABLE saved_trips
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
  ADD INDEX idx_saved_trips_user_updated (user_id, updated_at);
