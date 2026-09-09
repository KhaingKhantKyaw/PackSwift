DROP TABLE IF EXISTS hosted_expense_splits;
DROP TABLE IF EXISTS hosted_trip_expenses;
DROP TABLE IF EXISTS hosted_orders;

DELETE FROM hosted_readiness_items
WHERE item_key = 'travel-insurance';

UPDATE hosted_readiness_items
SET assistant_type = 'concierge',
    updated_at = CURRENT_TIMESTAMP
WHERE assistant_type IN ('flight', 'accommodation', 'shopping');

PRAGMA optimize;
