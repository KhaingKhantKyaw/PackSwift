CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(40) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  trip_session_id BIGINT UNSIGNED NOT NULL,
  category ENUM('flight', 'accommodation', 'travel_gear') NOT NULL,
  status ENUM('confirmed', 'in_transit', 'completed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  title VARCHAR(255) NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  total_amount DECIMAL(12, 2) NOT NULL,
  currency CHAR(3) NOT NULL,
  details_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_orders_trip
    FOREIGN KEY (trip_session_id) REFERENCES trip_sessions(id) ON DELETE CASCADE,
  CONSTRAINT chk_orders_quantity CHECK (quantity >= 1),
  CONSTRAINT chk_orders_total CHECK (total_amount >= 0),
  INDEX idx_orders_user_created (user_id, created_at),
  INDEX idx_orders_user_category (user_id, category, created_at),
  INDEX idx_orders_trip (trip_session_id)
);
