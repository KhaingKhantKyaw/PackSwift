ALTER TABLE trip_readiness_items
  ADD COLUMN smart_tag VARCHAR(160) NULL AFTER description;

CREATE TABLE IF NOT EXISTS itinerary_activities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  itinerary_id BIGINT UNSIGNED NOT NULL,
  sequence_number SMALLINT UNSIGNED NOT NULL,
  time_period ENUM('morning', 'afternoon', 'evening', 'nightlife') NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  place_name VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL,
  description TEXT NULL,
  thumbnail_url VARCHAR(500) NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  estimated_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  cost_currency CHAR(3) NOT NULL DEFAULT 'USD',
  transit_mode VARCHAR(50) NULL,
  transit_minutes SMALLINT UNSIGNED NULL,
  transit_distance_km DECIMAL(7, 2) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_itinerary_activities_day FOREIGN KEY (itinerary_id) REFERENCES itineraries(id) ON DELETE CASCADE,
  UNIQUE KEY uq_itinerary_activity_sequence (itinerary_id, sequence_number),
  INDEX idx_itinerary_activity_period (itinerary_id, time_period, start_time)
);

CREATE TABLE IF NOT EXISTS visa_rules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  origin_country_code CHAR(2) NOT NULL,
  destination_country_code CHAR(2) NOT NULL,
  status ENUM('visa_free', 'evisa_or_arrival', 'consular_required') NOT NULL,
  allowed_days SMALLINT UNSIGNED NULL,
  summary VARCHAR(500) NOT NULL,
  official_portal_url VARCHAR(500) NULL,
  source_note VARCHAR(255) NULL,
  checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_visa_rule_route (origin_country_code, destination_country_code),
  INDEX idx_visa_rule_destination (destination_country_code, status)
);

INSERT INTO visa_rules
  (origin_country_code, destination_country_code, status, allowed_days, summary, official_portal_url, source_note)
VALUES
  ('MM', 'TH', 'visa_free', 14, 'Short visits may qualify for visa-free access subject to passport and entry conditions.', 'https://www.thaievisa.go.th/', 'Confirm current eligibility with the official destination authority.'),
  ('TH', 'JP', 'visa_free', 15, 'Short tourism visits may qualify for visa-free entry subject to current conditions.', 'https://www.mofa.go.jp/j_info/visit/visa/', 'Confirm current eligibility with the official destination authority.'),
  ('MM', 'JP', 'evisa_or_arrival', NULL, 'An advance visa or electronic application may be required before departure.', 'https://www.mofa.go.jp/j_info/visit/visa/', 'Use the official destination authority before purchasing travel.'),
  ('TH', 'SG', 'visa_free', 30, 'Short tourism visits commonly qualify for visa-free access subject to entry approval.', 'https://www.ica.gov.sg/enter-transit-depart/entering-singapore', 'Confirm current eligibility with the official destination authority.')
ON DUPLICATE KEY UPDATE status = VALUES(status), allowed_days = VALUES(allowed_days), summary = VALUES(summary), official_portal_url = VALUES(official_portal_url), source_note = VALUES(source_note);
