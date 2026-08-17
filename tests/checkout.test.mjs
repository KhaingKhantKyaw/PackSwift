import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [schema, migration, cardMigration, route, repository, api, worker] = await Promise.all([
  readFile(new URL("../database/schema.sql", import.meta.url), "utf8"),
  readFile(new URL("../database/migrations/010_universal_checkout.sql", import.meta.url), "utf8"),
  readFile(new URL("../database/migrations/014_secure_card_checkout.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/checkout.js", import.meta.url), "utf8"),
  readFile(new URL("../src/repositories/checkout-repository.js", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/api.js", import.meta.url), "utf8"),
  readFile(new URL("../worker/hosted-worker.mjs", import.meta.url), "utf8"),
]);

test("MySQL checkout schema normalizes all purchase types", () => {
  for (const source of [schema, migration]) {
    assert.match(source, /order_type ENUM\('FLIGHT', 'HOTEL', 'GEAR'(?:, 'INSURANCE')?\)/);
    assert.match(source, /payment_method ENUM\('VISA', 'MASTERCARD', 'CREDIT_CARD'\)/);
    assert.match(source, /CREATE TABLE IF NOT EXISTS flight_bookings/);
    assert.match(source, /CREATE TABLE IF NOT EXISTS hotel_bookings/);
    assert.match(source, /CREATE TABLE IF NOT EXISTS gear_purchases/);
    assert.match(source, /REFERENCES orders\(order_number\) ON DELETE CASCADE/);
  }
});

test("universal checkout route is authenticated and validates supported cards", () => {
  assert.match(api, /apiRouter\.use\("\/checkout", checkoutRouter\)/);
  assert.match(route, /checkoutRouter\.use\(requireAuth, requireDatabase\)/);
  assert.match(route, /"VISA", "MASTERCARD", "CREDIT_CARD"/);
  assert.match(route, /containsCardSecret/);
  assert.match(route, /validateCardPayment/);
  assert.match(route, /Card payment details are required for flight confirmation/);
  assert.match(route, /processCheckout\(request\.auth\.userId/);
  assert.match(worker, /\/api\/checkout\/process/);
});

test("checkout stores safe card metadata but never persists full card secrets", () => {
  assert.match(schema, /card_brand ENUM\('VISA', 'MASTERCARD'\)/);
  assert.match(schema, /card_last4 CHAR\(4\)/);
  assert.match(schema, /payment_reference VARCHAR\(60\) NOT NULL UNIQUE/);
  assert.match(cardMigration, /Full card numbers, expiry values, and CVV values must never be persisted/);
  assert.match(repository, /input\.payment\.last4/);
  assert.doesNotMatch(repository, /input\.payment\.cardNumber|input\.payment\.cvv/);
});

test("purchase processing is atomic and returns a PackSwift receipt", () => {
  assert.match(repository, /beginTransaction\(\)/);
  assert.match(repository, /INSERT INTO orders/);
  assert.match(repository, /INSERT INTO flight_bookings/);
  assert.match(repository, /INSERT INTO hotel_bookings/);
  assert.match(repository, /INSERT INTO gear_purchases/);
  assert.match(repository, /UPDATE trip_readiness_items/);
  assert.match(repository, /await connection\.commit\(\)/);
  assert.match(repository, /await connection\.rollback\(\)/);
  assert.match(repository, /brand: "PackSwift"/);
  assert.match(repository, /pnrCode/);
});
