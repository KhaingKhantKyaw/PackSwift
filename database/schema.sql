CREATE DATABASE IF NOT EXISTS packswift
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE packswift;

-- PackSwift is a planning assistant. Remove tables from retired commerce flows.
DROP TABLE IF EXISTS gear_purchases;
DROP TABLE IF EXISTS hotel_bookings;
DROP TABLE IF EXISTS flight_bookings;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS expense_splits;
DROP TABLE IF EXISTS trip_expenses;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_username (username)
);

CREATE TABLE IF NOT EXISTS destinations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(160) NOT NULL,
  destination_type ENUM('country', 'city', 'place') NOT NULL,
  name VARCHAR(160) NOT NULL,
  city_name VARCHAR(160) NULL,
  country_name VARCHAR(160) NOT NULL,
  country_code CHAR(2) NULL,
  canonical_overview TEXT NULL,
  primary_airport_code VARCHAR(10) NULL,
  latitude DECIMAL(10, 7) NULL,
  longitude DECIMAL(10, 7) NULL,
  source_name VARCHAR(80) NULL,
  source_reference VARCHAR(180) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_destinations_slug (slug),
  UNIQUE KEY uq_destinations_source (source_name, source_reference),
  INDEX idx_destinations_country_city (country_name, city_name),
  INDEX idx_destinations_name (name),
  FULLTEXT KEY ft_destinations_search (
    name,
    city_name,
    country_name,
    canonical_overview
  )
);

CREATE TABLE IF NOT EXISTS planner_activities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  city_id VARCHAR(32) NOT NULL,
  city_name VARCHAR(120) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL,
  description VARCHAR(600) NOT NULL,
  cost_usd DECIMAL(10, 2) NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  image_alt VARCHAR(255) NOT NULL,
  image_credit VARCHAR(255) NULL,
  image_source_url VARCHAR(500) NULL,
  suitable_groups JSON NOT NULL,
  purpose_tags JSON NOT NULL,
  budget_tier ENUM('budget', 'mid', 'luxury') NOT NULL,
  pace_level ENUM('slow', 'balanced', 'fast') NOT NULL,
  experience_tags JSON NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_planner_activity_city_slug (city_id, slug),
  INDEX idx_planner_activity_filter (city_id, budget_tier, pace_level, is_active)
);

-- Google permits durable storage of Place IDs, but not cached photo resource
-- names or copied place content. PackSwift therefore stores only provider IDs
-- and its own request context; live names, ratings, descriptions, and photos
-- are refreshed from Places API when displayed.
CREATE TABLE IF NOT EXISTS destination_places_cache (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider ENUM('google_places') NOT NULL DEFAULT 'google_places',
  provider_place_id VARCHAR(255) NOT NULL,
  destination_key VARCHAR(160) NOT NULL,
  destination_name VARCHAR(160) NOT NULL,
  destination_scope ENUM('country', 'city') NOT NULL,
  country_name VARCHAR(160) NULL,
  request_category VARCHAR(80) NOT NULL,
  search_query VARCHAR(500) NOT NULL,
  category_tags JSON NOT NULL,
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

CREATE TABLE IF NOT EXISTS trip_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(36) NOT NULL UNIQUE,
  user_id INT NULL,
  destination_id BIGINT UNSIGNED NULL,
  destination_slug VARCHAR(120) NOT NULL,
  destination_name VARCHAR(160) NOT NULL,
  trip_scope ENUM('domestic', 'international') NOT NULL DEFAULT 'international',
  origin_name VARCHAR(160) NULL,
  origin_country VARCHAR(120) NULL,
  origin_airport_code VARCHAR(10) NULL,
  arrival_airport_code VARCHAR(10) NULL,
  arrival_at DATETIME NULL,
  hotel_name VARCHAR(180) NULL,
  hotel_address VARCHAR(255) NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  budget_amount DECIMAL(12, 2) NOT NULL,
  budget_currency CHAR(3) NOT NULL,
  travelers SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  adult_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  child_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  trip_purpose VARCHAR(50) NULL,
  pace VARCHAR(30) NULL,
  interests_json JSON NOT NULL,
  preferences_json JSON NULL,
  recommendation_score DECIMAL(5, 2) NOT NULL,
  summary TEXT NOT NULL,
  status ENUM('draft', 'planned', 'ready', 'completed', 'archived') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trip_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_trip_sessions_destination
    FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE SET NULL,
  INDEX idx_trip_sessions_user_updated (user_id, updated_at),
  INDEX idx_trip_sessions_destination (destination_slug),
  INDEX idx_trip_sessions_destination_user (destination_id, user_id)
);

ALTER TABLE trip_sessions
  MODIFY status ENUM('draft', 'planned', 'ready', 'completed', 'archived')
  NOT NULL DEFAULT 'draft';

UPDATE trip_sessions
SET status = 'ready'
WHERE status = 'completed';

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

CREATE TABLE IF NOT EXISTS destination_insights (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_session_id BIGINT UNSIGNED NOT NULL,
  country_code CHAR(2) NULL,
  country_name VARCHAR(120) NOT NULL,
  region_name VARCHAR(120) NULL,
  currency_code CHAR(3) NULL,
  languages_json JSON NULL,
  budget_summary VARCHAR(500) NOT NULL,
  preparation_summary TEXT NULL,
  source_name VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_destination_insights_trip
    FOREIGN KEY (trip_session_id) REFERENCES trip_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weather_snapshots (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_session_id BIGINT UNSIGNED NOT NULL,
  average_low_c DECIMAL(5, 2) NULL,
  average_high_c DECIMAL(5, 2) NULL,
  rainfall_level ENUM('low', 'moderate', 'high') NOT NULL,
  climate_summary VARCHAR(500) NOT NULL,
  source_name VARCHAR(120) NULL,
  observed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_weather_snapshots_trip
    FOREIGN KEY (trip_session_id) REFERENCES trip_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attractions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_session_id BIGINT UNSIGNED NOT NULL,
  external_reference VARCHAR(160) NULL,
  attraction_name VARCHAR(180) NOT NULL,
  category VARCHAR(100) NULL,
  description_text TEXT NULL,
  latitude DECIMAL(10, 7) NULL,
  longitude DECIMAL(10, 7) NULL,
  relevance_score DECIMAL(5, 2) NULL,
  source_name VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attractions_trip
    FOREIGN KEY (trip_session_id) REFERENCES trip_sessions(id) ON DELETE CASCADE,
  INDEX idx_attractions_trip_score (trip_session_id, relevance_score)
);

CREATE TABLE IF NOT EXISTS itineraries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_session_id BIGINT UNSIGNED NOT NULL,
  day_number SMALLINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  morning_activity VARCHAR(255) NOT NULL,
  afternoon_activity VARCHAR(255) NOT NULL,
  evening_activity VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_itineraries_trip
    FOREIGN KEY (trip_session_id) REFERENCES trip_sessions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_itineraries_day (trip_session_id, day_number)
);

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
  CONSTRAINT fk_itinerary_activities_day
    FOREIGN KEY (itinerary_id) REFERENCES itineraries(id) ON DELETE CASCADE,
  UNIQUE KEY uq_itinerary_activity_sequence (itinerary_id, sequence_number),
  INDEX idx_itinerary_activity_period (itinerary_id, time_period, start_time)
);

CREATE TABLE IF NOT EXISTS itinerary_timeline_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_session_id BIGINT UNSIGNED NOT NULL,
  day_number SMALLINT UNSIGNED NOT NULL,
  sequence_number SMALLINT UNSIGNED NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  item_type ENUM(
    'arrival',
    'immigration',
    'baggage',
    'airport-transfer',
    'hotel',
    'activity',
    'meal',
    'free-time',
    'safety',
    'departure'
  ) NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  location_name VARCHAR(180) NULL,
  transit_mode VARCHAR(80) NULL,
  estimated_duration_minutes SMALLINT UNSIGNED NULL,
  estimated_cost DECIMAL(10, 2) NULL,
  cost_currency CHAR(3) NULL,
  safety_note TEXT NULL,
  source_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_timeline_items_trip
    FOREIGN KEY (trip_session_id) REFERENCES trip_sessions(id) ON DELETE CASCADE,
  CONSTRAINT chk_timeline_day CHECK (day_number >= 1),
  CONSTRAINT chk_timeline_sequence CHECK (sequence_number >= 1),
  CONSTRAINT chk_timeline_duration
    CHECK (
      estimated_duration_minutes IS NULL
      OR estimated_duration_minutes >= 0
    ),
  UNIQUE KEY uq_timeline_trip_sequence (
    trip_session_id,
    day_number,
    sequence_number
  ),
  INDEX idx_timeline_trip_day (
    trip_session_id,
    day_number,
    start_time
  )
);

CREATE TABLE IF NOT EXISTS packing_lists (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_session_id BIGINT UNSIGNED NOT NULL,
  traveler_group ENUM('general', 'men', 'women', 'children', 'pet') NOT NULL DEFAULT 'general',
  category VARCHAR(80) NOT NULL,
  item_name VARCHAR(160) NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  reason_text VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_packing_lists_trip
    FOREIGN KEY (trip_session_id) REFERENCES trip_sessions(id) ON DELETE CASCADE,
  INDEX idx_packing_lists_trip_category (trip_session_id, category)
);

CREATE TABLE IF NOT EXISTS cultural_guides (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_session_id BIGINT UNSIGNED NOT NULL,
  category VARCHAR(80) NOT NULL,
  guidance_text TEXT NOT NULL,
  priority ENUM('helpful', 'important') NOT NULL DEFAULT 'helpful',
  source_name VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cultural_guides_trip
    FOREIGN KEY (trip_session_id) REFERENCES trip_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS travel_advisories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_session_id BIGINT UNSIGNED NOT NULL,
  advisory_level ENUM('information', 'caution', 'important') NOT NULL DEFAULT 'information',
  title VARCHAR(180) NOT NULL,
  advisory_text TEXT NOT NULL,
  source_url VARCHAR(500) NULL,
  effective_at TIMESTAMP NULL,
  checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_travel_advisories_trip
    FOREIGN KEY (trip_session_id) REFERENCES trip_sessions(id) ON DELETE CASCADE,
  INDEX idx_travel_advisories_trip_level (trip_session_id, advisory_level)
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_contact_messages_created (created_at)
);

CREATE TABLE IF NOT EXISTS community_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  destination_id BIGINT UNSIGNED NULL,
  post_type ENUM('community', 'travel_report', 'place_review')
    NOT NULL DEFAULT 'community',
  rating TINYINT UNSIGNED NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  destination VARCHAR(100) NULL,
  trip_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_community_posts_destination
    FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE SET NULL,
  CONSTRAINT chk_community_review_rating
    CHECK (
      (
        post_type = 'place_review'
        AND rating BETWEEN 1 AND 5
      )
      OR (
        post_type <> 'place_review'
        AND rating IS NULL
      )
    ),
  CONSTRAINT chk_community_review_destination
    CHECK (
      post_type <> 'place_review'
      OR destination_id IS NOT NULL
    ),
  INDEX idx_community_posts_created (created_at),
  INDEX idx_community_posts_category (category),
  INDEX idx_community_posts_destination (destination),
  INDEX idx_community_posts_destination_type (
    destination_id,
    post_type,
    created_at
  ),
  FULLTEXT KEY ft_community_posts_search (title, content, destination)
);

CREATE TABLE IF NOT EXISTS place_review_details (
  post_id INT PRIMARY KEY,
  visit_month TINYINT UNSIGNED NULL,
  visit_year SMALLINT UNSIGNED NULL,
  traveler_type VARCHAR(50) NULL,
  what_to_know TEXT NULL,
  what_to_avoid TEXT NULL,
  positive_tags_json JSON NULL,
  caution_tags_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_place_review_details_post
    FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  CONSTRAINT chk_place_review_visit_month
    CHECK (
      visit_month IS NULL
      OR visit_month BETWEEN 1 AND 12
    ),
  CONSTRAINT chk_place_review_visit_year
    CHECK (
      visit_year IS NULL
      OR visit_year BETWEEN 2000 AND 2200
    )
);

CREATE TABLE IF NOT EXISTS destination_insight_snapshots (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  destination_id BIGINT UNSIGNED NOT NULL,
  overview TEXT NOT NULL,
  popularity_score DECIMAL(10, 2) NOT NULL DEFAULT 0,
  popularity_rank INT UNSIGNED NULL,
  ranked_destination_count INT UNSIGNED NULL,
  average_rating DECIMAL(3, 2) NULL,
  review_count INT UNSIGNED NOT NULL DEFAULT 0,
  report_count INT UNSIGNED NOT NULL DEFAULT 0,
  saved_trip_count INT UNSIGNED NOT NULL DEFAULT 0,
  what_to_know_json JSON NOT NULL,
  what_to_avoid_json JSON NOT NULL,
  evidence_json JSON NULL,
  algorithm_version VARCHAR(30) NOT NULL,
  source_content_updated_at TIMESTAMP NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_destination_insight_snapshot
    FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE CASCADE,
  CONSTRAINT chk_destination_average_rating
    CHECK (
      average_rating IS NULL
      OR average_rating BETWEEN 1 AND 5
    ),
  UNIQUE KEY uq_destination_insight_snapshot (destination_id),
  INDEX idx_destination_insight_popularity (
    popularity_rank,
    popularity_score
  )
);

CREATE TABLE IF NOT EXISTS community_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_community_comments_post (post_id, created_at)
);

CREATE TABLE IF NOT EXISTS community_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_community_likes_post_user (post_id, user_id),
  INDEX idx_community_likes_post (post_id)
);

CREATE TABLE IF NOT EXISTS saved_trips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  destination VARCHAR(255) NOT NULL,
  travel_month VARCHAR(50) NOT NULL,
  budget DECIMAL(10, 2) NOT NULL,
  trip_data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_saved_trips_user_created (user_id, created_at),
  INDEX idx_saved_trips_user_updated (user_id, updated_at),
  INDEX idx_saved_trips_destination (destination)
);

CREATE TABLE IF NOT EXISTS trip_readiness_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_session_id BIGINT UNSIGNED NOT NULL,
  item_key VARCHAR(60) NOT NULL,
  category VARCHAR(60) NOT NULL,
  item_name VARCHAR(180) NOT NULL,
  description VARCHAR(500) NOT NULL,
  smart_tag VARCHAR(160) NULL,
  assistant_type ENUM('manual', 'concierge') NOT NULL DEFAULT 'concierge',
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completion_source ENUM('manual', 'assistant') NULL,
  confirmation_reference VARCHAR(120) NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trip_readiness_trip
    FOREIGN KEY (trip_session_id) REFERENCES trip_sessions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_trip_readiness_item (trip_session_id, item_key),
  INDEX idx_trip_readiness_progress (trip_session_id, is_required, is_completed)
);

ALTER TABLE trip_readiness_items
  MODIFY assistant_type ENUM('manual', 'flight', 'accommodation', 'shopping', 'concierge')
  NOT NULL DEFAULT 'concierge';

UPDATE trip_readiness_items
SET assistant_type = 'concierge'
WHERE assistant_type IN ('flight', 'accommodation', 'shopping');

DELETE FROM trip_readiness_items WHERE item_key = 'travel-insurance';

ALTER TABLE trip_readiness_items
  MODIFY assistant_type ENUM('manual', 'concierge') NOT NULL DEFAULT 'concierge';

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
  (origin_country_code, destination_country_code, status, allowed_days, summary,
   official_portal_url, source_note)
VALUES
  ('MM', 'TH', 'visa_free', 14,
   'Short visits may qualify for visa-free access subject to passport and entry conditions.',
   'https://www.thaievisa.go.th/', 'Confirm current eligibility with the official destination authority.'),
  ('TH', 'JP', 'visa_free', 15,
   'Short tourism visits may qualify for visa-free entry subject to current conditions.',
   'https://www.mofa.go.jp/j_info/visit/visa/', 'Confirm current eligibility with the official destination authority.'),
  ('MM', 'JP', 'evisa_or_arrival', NULL,
   'An advance visa or electronic application may be required before departure.',
   'https://www.mofa.go.jp/j_info/visit/visa/', 'Use the official destination authority before purchasing travel.'),
  ('TH', 'SG', 'visa_free', 30,
   'Short tourism visits commonly qualify for visa-free access subject to entry approval.',
   'https://www.ica.gov.sg/enter-transit-depart/entering-singapore', 'Confirm current eligibility with the official destination authority.')
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  allowed_days = VALUES(allowed_days),
  summary = VALUES(summary),
  official_portal_url = VALUES(official_portal_url),
  source_note = VALUES(source_note);

CREATE TABLE IF NOT EXISTS travel_shorts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(80) NOT NULL UNIQUE,
  user_id INT NULL,
  creator_name VARCHAR(100) NOT NULL,
  creator_username VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description VARCHAR(1200) NOT NULL,
  hashtags VARCHAR(500) NOT NULL DEFAULT '',
  destination VARCHAR(120) NULL,
  video_url VARCHAR(500) NOT NULL,
  video_mime VARCHAR(80) NOT NULL DEFAULT 'video/mp4',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_travel_shorts_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_travel_shorts_created (created_at),
  INDEX idx_travel_shorts_destination (destination),
  INDEX idx_travel_shorts_creator (creator_username, created_at),
  FULLTEXT KEY ft_travel_shorts_search (title, description, hashtags, destination)
);

CREATE TABLE IF NOT EXISTS travel_short_likes (
  short_id BIGINT UNSIGNED NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (short_id, user_id),
  CONSTRAINT fk_short_likes_short
    FOREIGN KEY (short_id) REFERENCES travel_shorts(id) ON DELETE CASCADE,
  CONSTRAINT fk_short_likes_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_short_likes_user (user_id, created_at)
);

CREATE TABLE IF NOT EXISTS travel_short_saves (
  short_id BIGINT UNSIGNED NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (short_id, user_id),
  CONSTRAINT fk_short_saves_short
    FOREIGN KEY (short_id) REFERENCES travel_shorts(id) ON DELETE CASCADE,
  CONSTRAINT fk_short_saves_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_short_saves_user (user_id, created_at)
);

CREATE TABLE IF NOT EXISTS travel_short_comments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  short_id BIGINT UNSIGNED NOT NULL,
  user_id INT NOT NULL,
  comment VARCHAR(2000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_short_comments_short
    FOREIGN KEY (short_id) REFERENCES travel_shorts(id) ON DELETE CASCADE,
  CONSTRAINT fk_short_comments_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_short_comments_short (short_id, created_at)
);

CREATE TABLE IF NOT EXISTS travel_creator_follows (
  follower_user_id INT NOT NULL,
  creator_username VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_user_id, creator_username),
  CONSTRAINT fk_creator_follows_user
    FOREIGN KEY (follower_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_creator_follows_creator (creator_username, created_at)
);

INSERT IGNORE INTO travel_shorts
  (public_id, user_id, creator_name, creator_username, title, description,
   hashtags, destination, video_url, video_mime)
VALUES
  ('packswift-example-italy', NULL, 'Travel Pleasure', 'TravelPleasure',
   'Best places to visit in Italy',
   'A quick visual travel idea to inspire your next PackSwift itinerary.',
   '#shorts #travel #italy', 'Italy',
   '/videos/packswift-trip-example.m4v', 'video/x-m4v');
