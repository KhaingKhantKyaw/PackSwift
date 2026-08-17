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
