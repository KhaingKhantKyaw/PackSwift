USE packswift;

CREATE TABLE IF NOT EXISTS traveler_profiles (
  user_id INT PRIMARY KEY,
  planning_goal ENUM('make-possible', 'fixed-budget', 'best-value', 'comfort-first', 'luxury', 'once-in-lifetime') NOT NULL DEFAULT 'best-value',
  accommodation_style ENUM('hostel', 'budget', 'comfortable', 'boutique', 'luxury') NOT NULL DEFAULT 'comfortable',
  food_style ENUM('street', 'local', 'mixed', 'fine') NOT NULL DEFAULT 'mixed',
  transport_style ENUM('public', 'mixed', 'private', 'premium') NOT NULL DEFAULT 'mixed',
  activity_style ENUM('free', 'essential', 'balanced', 'premium') NOT NULL DEFAULT 'balanced',
  shopping_style ENUM('none', 'light', 'planned', 'priority') NOT NULL DEFAULT 'light',
  date_flexible BOOLEAN NOT NULL DEFAULT FALSE,
  trip_length_flexible BOOLEAN NOT NULL DEFAULT FALSE,
  must_have_experience VARCHAR(180) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_traveler_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
