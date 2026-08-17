-- PackSwift Part 1: dynamic destinations, community-derived place reviews,
-- detailed itinerary timelines, and trip-backed packing-list context.
--
-- Apply this migration once to an existing PackSwift database that already
-- contains migrations 002 and 003. Fresh installations should run
-- `npm run db:init`, which uses database/schema.sql instead.

USE packswift;

CREATE TABLE destinations (
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

ALTER TABLE community_posts
  ADD COLUMN destination_id BIGINT UNSIGNED NULL AFTER user_id,
  ADD COLUMN post_type ENUM('community', 'travel_report', 'place_review')
    NOT NULL DEFAULT 'community' AFTER destination_id,
  ADD COLUMN rating TINYINT UNSIGNED NULL AFTER post_type,
  ADD CONSTRAINT fk_community_posts_destination
    FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE SET NULL,
  ADD CONSTRAINT chk_community_review_rating
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
  ADD CONSTRAINT chk_community_review_destination
    CHECK (
      post_type <> 'place_review'
      OR destination_id IS NOT NULL
    ),
  ADD INDEX idx_community_posts_destination_type (
    destination_id,
    post_type,
    created_at
  ),
  ADD FULLTEXT KEY ft_community_posts_search (title, content, destination);

CREATE TABLE place_review_details (
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

CREATE TABLE destination_insight_snapshots (
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

ALTER TABLE trip_sessions
  ADD COLUMN destination_id BIGINT UNSIGNED NULL AFTER user_id,
  ADD COLUMN arrival_airport_code VARCHAR(10) NULL AFTER destination_name,
  ADD COLUMN arrival_at DATETIME NULL AFTER arrival_airport_code,
  ADD COLUMN hotel_name VARCHAR(180) NULL AFTER arrival_at,
  ADD COLUMN hotel_address VARCHAR(255) NULL AFTER hotel_name,
  ADD COLUMN trip_purpose VARCHAR(50) NULL AFTER travelers,
  ADD COLUMN pace VARCHAR(30) NULL AFTER trip_purpose,
  ADD COLUMN preferences_json JSON NULL AFTER interests_json,
  ADD CONSTRAINT fk_trip_sessions_destination
    FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE SET NULL,
  ADD INDEX idx_trip_sessions_destination_user (destination_id, user_id);

CREATE TABLE itinerary_timeline_items (
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

ALTER TABLE packing_lists
  ADD COLUMN updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
