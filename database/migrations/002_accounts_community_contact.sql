-- Apply this migration only to a PackSwift database created from the earlier
-- travel-planning schema. Fresh installations should run database/schema.sql.

ALTER TABLE trip_sessions DROP FOREIGN KEY fk_trip_sessions_user;

ALTER TABLE users
  MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT,
  CHANGE COLUMN display_name full_name VARCHAR(100) NOT NULL,
  ADD COLUMN username VARCHAR(50) NULL AFTER full_name,
  ADD COLUMN password_hash VARCHAR(255) NULL AFTER email;

UPDATE users
SET username = CONCAT('traveller_', id),
    password_hash = '$2b$12$KIXQ4Rz9zmz9E5ZpYl0YAeHh5KjnrxKxN4SX7qPHWLxV0wAw1eDLm'
WHERE username IS NULL OR password_hash IS NULL;

ALTER TABLE users
  MODIFY COLUMN username VARCHAR(50) NOT NULL,
  MODIFY COLUMN password_hash VARCHAR(255) NOT NULL,
  ADD UNIQUE KEY uq_users_username (username);

ALTER TABLE trip_sessions
  MODIFY COLUMN user_id INT NULL,
  ADD CONSTRAINT fk_trip_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_contact_messages_created (created_at)
);

CREATE TABLE community_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  destination VARCHAR(100) NULL,
  trip_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_community_posts_created (created_at),
  INDEX idx_community_posts_category (category),
  INDEX idx_community_posts_destination (destination)
);

CREATE TABLE community_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_community_comments_post (post_id, created_at)
);

CREATE TABLE community_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_community_likes_post_user (post_id, user_id),
  INDEX idx_community_likes_post (post_id)
);
