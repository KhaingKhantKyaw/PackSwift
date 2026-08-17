ALTER TABLE trip_readiness_items
  ADD COLUMN is_required BOOLEAN NOT NULL DEFAULT TRUE AFTER assistant_type;

DROP INDEX idx_trip_readiness_progress ON trip_readiness_items;
CREATE INDEX idx_trip_readiness_progress
  ON trip_readiness_items (trip_session_id, is_required, is_completed);
