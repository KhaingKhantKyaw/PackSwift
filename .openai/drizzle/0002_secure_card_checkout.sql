ALTER TABLE hosted_orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'CREDIT_CARD';
ALTER TABLE hosted_orders ADD COLUMN card_brand TEXT;
ALTER TABLE hosted_orders ADD COLUMN card_last4 TEXT;
ALTER TABLE hosted_orders ADD COLUMN payment_reference TEXT;

UPDATE hosted_orders
SET payment_reference = 'PAY-LEGACY-' || id
WHERE payment_reference IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_hosted_orders_payment_reference
ON hosted_orders(payment_reference);

PRAGMA optimize;
