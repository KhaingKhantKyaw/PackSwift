ALTER TABLE trip_sessions
  ADD COLUMN trip_scope ENUM('domestic', 'international') NOT NULL DEFAULT 'international' AFTER destination_name,
  ADD COLUMN origin_name VARCHAR(160) NULL AFTER trip_scope,
  ADD COLUMN origin_country VARCHAR(120) NULL AFTER origin_name,
  ADD COLUMN origin_airport_code VARCHAR(10) NULL AFTER origin_country,
  ADD COLUMN adult_count SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER travelers,
  ADD COLUMN child_count SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER adult_count;

UPDATE trip_sessions
SET adult_count = GREATEST(travelers, 1),
    child_count = 0
WHERE adult_count = 1 AND child_count = 0;
