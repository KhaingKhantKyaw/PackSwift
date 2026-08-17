CREATE TABLE IF NOT EXISTS trip_readiness_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_session_id BIGINT UNSIGNED NOT NULL,
  item_key VARCHAR(60) NOT NULL,
  category VARCHAR(60) NOT NULL,
  item_name VARCHAR(180) NOT NULL,
  description VARCHAR(500) NOT NULL,
  assistant_type ENUM('manual', 'flight', 'accommodation', 'shopping') NOT NULL DEFAULT 'manual',
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completion_source ENUM('manual', 'assistant') NULL,
  confirmation_reference VARCHAR(120) NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trip_readiness_trip
    FOREIGN KEY (trip_session_id) REFERENCES trip_sessions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_trip_readiness_item (trip_session_id, item_key),
  INDEX idx_trip_readiness_progress (trip_session_id, is_completed)
);
