ALTER TABLE hosted_readiness_items
  ADD COLUMN is_required INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS idx_hosted_readiness_progress;
CREATE INDEX IF NOT EXISTS idx_hosted_readiness_progress
  ON hosted_readiness_items(trip_session_id, is_required, is_completed);
