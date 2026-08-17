-- Store only non-sensitive card transaction metadata.
-- Full card numbers, expiry values, and CVV values must never be persisted.

ALTER TABLE orders
  ADD COLUMN card_brand ENUM('VISA', 'MASTERCARD') NULL AFTER payment_status,
  ADD COLUMN card_last4 CHAR(4) NULL AFTER card_brand,
  ADD COLUMN payment_reference VARCHAR(60) NULL AFTER card_last4;

UPDATE orders
SET payment_reference = CONCAT('PAY-LEGACY-', id)
WHERE payment_reference IS NULL;

ALTER TABLE orders
  MODIFY payment_reference VARCHAR(60) NOT NULL,
  ADD UNIQUE KEY uq_orders_payment_reference (payment_reference),
  ADD CONSTRAINT chk_orders_card_last4
    CHECK (card_last4 IS NULL OR card_last4 REGEXP '^[0-9]{4}$');
