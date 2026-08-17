USE packswift;

CREATE TABLE IF NOT EXISTS trip_itinerary_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_session_id BIGINT UNSIGNED NOT NULL,
  provider ENUM('google_places', 'packswift_catalog') NOT NULL DEFAULT 'packswift_catalog',
  place_id VARCHAR(255) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_trip_itinerary_items_trip
    FOREIGN KEY (trip_session_id) REFERENCES trip_sessions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_trip_itinerary_place (trip_session_id, provider, place_id),
  INDEX idx_trip_itinerary_position (trip_session_id, position)
);
