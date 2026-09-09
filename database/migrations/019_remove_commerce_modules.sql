-- PackSwift is now a focused AI travel-planning and preparation assistant.
-- This migration removes retired booking, store, payment, order, insurance,
-- and expense-tracking data from an existing local MySQL installation.

DROP TABLE IF EXISTS gear_purchases;
DROP TABLE IF EXISTS hotel_bookings;
DROP TABLE IF EXISTS flight_bookings;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS expense_splits;
DROP TABLE IF EXISTS trip_expenses;

ALTER TABLE trip_readiness_items
  MODIFY assistant_type ENUM('manual', 'flight', 'accommodation', 'shopping', 'concierge')
  NOT NULL DEFAULT 'concierge';

UPDATE trip_readiness_items
SET assistant_type = 'concierge'
WHERE assistant_type IN ('flight', 'accommodation', 'shopping');

DELETE FROM trip_readiness_items WHERE item_key = 'travel-insurance';

ALTER TABLE trip_readiness_items
  MODIFY assistant_type ENUM('manual', 'concierge') NOT NULL DEFAULT 'concierge';
