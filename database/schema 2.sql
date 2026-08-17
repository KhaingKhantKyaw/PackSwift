CREATE DATABASE IF NOT EXISTS packswift
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE packswift;

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(120) NOT NULL,
  preferred_currency CHAR(3) NOT NULL DEFAULT 'USD',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE trips (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(36) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NULL,
  destination_slug VARCHAR(120) NOT NULL,
  destination_name VARCHAR(160) NOT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  budget_amount DECIMAL(12, 2) NOT NULL,
  budget_currency CHAR(3) NOT NULL,
  travelers SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  interests_json JSON NOT NULL,
  recommendation_score DECIMAL(5, 2) NOT NULL,
  summary TEXT NOT NULL,
  status ENUM('draft', 'planned', 'completed', 'archived') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trips_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_trips_user_updated (user_id, updated_at),
  INDEX idx_trips_destination (destination_slug)
);

CREATE TABLE weather_insights (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id BIGINT UNSIGNED NOT NULL,
  average_low_c DECIMAL(5, 2) NULL,
  average_high_c DECIMAL(5, 2) NULL,
  rainfall_level ENUM('low', 'moderate', 'high') NOT NULL,
  climate_summary VARCHAR(500) NOT NULL,
  source_name VARCHAR(120) NULL,
  observed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_weather_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE TABLE itinerary_days (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id BIGINT UNSIGNED NOT NULL,
  day_number SMALLINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  morning_activity VARCHAR(255) NOT NULL,
  afternoon_activity VARCHAR(255) NOT NULL,
  evening_activity VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_itinerary_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  UNIQUE KEY uq_itinerary_day (trip_id, day_number)
);

CREATE TABLE cultural_notes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id BIGINT UNSIGNED NOT NULL,
  category VARCHAR(80) NOT NULL,
  guidance_text TEXT NOT NULL,
  priority ENUM('helpful', 'important') NOT NULL DEFAULT 'helpful',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cultural_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE TABLE packing_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id BIGINT UNSIGNED NOT NULL,
  category VARCHAR(80) NOT NULL,
  item_name VARCHAR(160) NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  reason_text VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_packing_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  INDEX idx_packing_trip_category (trip_id, category)
);
