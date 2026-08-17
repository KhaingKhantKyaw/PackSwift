-- Apply once to an existing PackSwift MySQL 8.0 database.
-- Fresh installations already include these definitions in database/schema.sql.

ALTER TABLE orders
  ADD COLUMN order_type ENUM('FLIGHT', 'HOTEL', 'GEAR') NULL AFTER category,
  ADD COLUMN payment_method ENUM('VISA', 'MASTERCARD', 'CREDIT_CARD') NULL AFTER status,
  ADD COLUMN payment_status ENUM('PAID', 'FAILED') NOT NULL DEFAULT 'PAID' AFTER payment_method;

UPDATE orders
SET order_type = CASE category
  WHEN 'flight' THEN 'FLIGHT'
  WHEN 'accommodation' THEN 'HOTEL'
  ELSE 'GEAR'
END,
payment_method = COALESCE(payment_method, 'CREDIT_CARD');

ALTER TABLE orders
  MODIFY order_type ENUM('FLIGHT', 'HOTEL', 'GEAR') NOT NULL,
  MODIFY payment_method ENUM('VISA', 'MASTERCARD', 'CREDIT_CARD') NOT NULL;

CREATE TABLE IF NOT EXISTS flight_bookings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(40) NOT NULL,
  pnr_code VARCHAR(20) NOT NULL UNIQUE,
  route VARCHAR(180) NOT NULL,
  departure_date DATE NULL,
  return_date DATE NULL,
  class_type VARCHAR(50) NOT NULL,
  passenger_details JSON NOT NULL,
  itinerary_details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_flight_bookings_order
    FOREIGN KEY (order_id) REFERENCES orders(order_number) ON DELETE CASCADE,
  UNIQUE KEY uq_flight_booking_order (order_id),
  INDEX idx_flight_bookings_route (route)
);

CREATE TABLE IF NOT EXISTS hotel_bookings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(40) NOT NULL,
  hotel_name VARCHAR(255) NOT NULL,
  room_type VARCHAR(100) NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guest_details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hotel_bookings_order
    FOREIGN KEY (order_id) REFERENCES orders(order_number) ON DELETE CASCADE,
  CONSTRAINT chk_hotel_booking_dates CHECK (check_out > check_in),
  UNIQUE KEY uq_hotel_booking_order (order_id),
  INDEX idx_hotel_bookings_dates (check_in, check_out)
);

CREATE TABLE IF NOT EXISTS gear_purchases (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(40) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  item_details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gear_purchases_order
    FOREIGN KEY (order_id) REFERENCES orders(order_number) ON DELETE CASCADE,
  CONSTRAINT chk_gear_purchase_quantity CHECK (quantity >= 1),
  UNIQUE KEY uq_gear_purchase_order (order_id),
  INDEX idx_gear_purchases_item (item_name)
);
