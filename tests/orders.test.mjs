import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  schema, migration, routes, repository, readinessRepository, tripRoutes,
  profileHtml, profileScript, styles, flightScript, stayScript, storeScript,
  hostedWorker,
] = await Promise.all([
  readFile(new URL("../database/schema.sql", import.meta.url), "utf8"),
  readFile(new URL("../database/migrations/007_orders.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/orders.js", import.meta.url), "utf8"),
  readFile(new URL("../src/repositories/order-repository.js", import.meta.url), "utf8"),
  readFile(new URL("../src/repositories/readiness-repository.js", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/trips.js", import.meta.url), "utf8"),
  readFile(new URL("../public/profile.html", import.meta.url), "utf8"),
  readFile(new URL("../public/js/profile.js", import.meta.url), "utf8"),
  readFile(new URL("../public/css/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../public/js/flight-assistant.js", import.meta.url), "utf8"),
  readFile(new URL("../public/js/stay-assistant.js", import.meta.url), "utf8"),
  readFile(new URL("../public/js/store-assistant.js", import.meta.url), "utf8"),
  readFile(new URL("../worker/hosted-worker.mjs", import.meta.url), "utf8"),
]);

test("MySQL orders model is user-owned, trip-linked, indexed, and JSON-backed", () => {
  for (const source of [schema, migration]) {
    assert.match(source, /CREATE TABLE IF NOT EXISTS orders/);
    assert.match(source, /FOREIGN KEY \(user_id\) REFERENCES users\(id\) ON DELETE CASCADE/);
    assert.match(source, /FOREIGN KEY \(trip_session_id\) REFERENCES trip_sessions\(id\) ON DELETE CASCADE/);
    assert.match(source, /category ENUM\('flight', 'accommodation', 'travel_gear'(?:, 'insurance')?\)/);
    assert.match(source, /details_json JSON NOT NULL/);
    assert.match(source, /idx_orders_user_category/);
  }
});

test("authenticated order API supports category filtering and owned detail lookup", () => {
  assert.match(routes, /ordersRouter\.use\(requireAuth, requireDatabase\)/);
  assert.match(routes, /flight", "accommodation", "travel_gear/);
  assert.match(routes, /findOrder\(request\.auth\.userId/);
  assert.match(repository, /WHERE orders\.user_id = \?/);
  assert.match(repository, /ORDER BY orders\.created_at DESC/);
});

test("assistant confirmation persists an order in the same database transaction", () => {
  assert.match(tripRoutes, /body\("order\.details"\)\.isObject/);
  assert.match(readinessRepository, /INSERT INTO orders/);
  assert.match(readinessRepository, /ON DUPLICATE KEY UPDATE/);
  assert.match(readinessRepository, /connection\.commit\(\)/);
  assert.match(hostedWorker, /CREATE TABLE IF NOT EXISTS hosted_orders/);
  assert.match(hostedWorker, /INSERT INTO hosted_orders/);
  assert.match(hostedWorker, /ON CONFLICT\(order_number\) DO UPDATE/);
});

test("all three assistants send category-specific order summaries", () => {
  assert.match(flightScript, /passengers/);
  assert.match(flightScript, /classType/);
  assert.match(flightScript, /orderType: "FLIGHT"/);
  assert.match(flightScript, /totalAmount: preferredAmountFromUsd/);
  assert.match(stayScript, /hotelName: selectedProperty\.name/);
  assert.match(stayScript, /roomType: selectedProperty\.offer/);
  assert.match(stayScript, /orderType: "HOTEL"/);
  assert.match(stayScript, /totalAmount: preferredStayAmountFromUsd/);
  assert.match(storeScript, /productTitle: selectedStoreProduct\.title/);
  assert.match(storeScript, /deliveryStatus: "Preparing for dispatch"/);
  assert.match(storeScript, /orderType: "GEAR"/);
  assert.match(storeScript, /totalAmount: preferredStoreAmountFromUsd/);
});

test("profile provides order tabs, category cards, statuses, and document actions", () => {
  for (const label of [
    "My Orders 📦", "All Orders", "Air Tickets ✈️", "Accommodations 🏨",
    "Travel Gear &amp; Supplies 🛍️",
  ]) assert.match(profileHtml, new RegExp(label));
  assert.match(profileScript, /View E-Ticket/);
  assert.match(profileScript, /View Receipt/);
  assert.match(profileScript, /Order Details/);
  assert.match(profileScript, /Confirmed ✓/);
  assert.match(profileScript, /In Transit 🚚/);
  assert.match(profileScript, /profileOrders\.filter/);
  assert.match(styles, /#e5f6f8/i);
  assert.match(styles, /#00a8b5/i);
  assert.match(styles, /packswift-gear-gallery\.png/);
});
