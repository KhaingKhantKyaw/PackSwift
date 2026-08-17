-- Store only durable Google Place IDs and PackSwift request context.
-- Google photo names and place content are intentionally never cached.
CREATE TABLE IF NOT EXISTS destination_places_cache (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider ENUM('google_places') NOT NULL DEFAULT 'google_places',
  provider_place_id VARCHAR(255) NOT NULL,
  destination_key VARCHAR(160) NOT NULL,
  request_category VARCHAR(50) NOT NULL,
  first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_destination_place_reference (
    provider,
    provider_place_id,
    destination_key
  ),
  INDEX idx_destination_place_lookup (
    destination_key,
    request_category,
    last_seen_at
  )
);
