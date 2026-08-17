CREATE TABLE IF NOT EXISTS saved_trips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  destination VARCHAR(255) NOT NULL,
  travel_month VARCHAR(50) NOT NULL,
  budget DECIMAL(10, 2) NOT NULL,
  trip_data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_saved_trips_user_created (user_id, created_at),
  INDEX idx_saved_trips_destination (destination)
);
