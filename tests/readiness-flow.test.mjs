import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trip readiness schema is durable, owned, and duplicate safe", async () => {
  const [schema, migration, repository] = await Promise.all([
    readFile(new URL("../database/schema.sql", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../database/migrations/005_trip_readiness.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/repositories/readiness-repository.js",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  for (const source of [schema, migration]) {
    assert.match(source, /CREATE TABLE IF NOT EXISTS trip_readiness_items/);
    assert.match(
      source,
      /FOREIGN KEY \(trip_session_id\) REFERENCES trip_sessions\(id\) ON DELETE CASCADE/,
    );
    assert.match(
      source,
      /UNIQUE KEY uq_trip_readiness_item \(trip_session_id, item_key\)/,
    );
  }
  assert.match(repository, /trip\.public_id = \? AND trip\.user_id = \?/);
  assert.match(repository, /status = \? WHERE id = \?/);
  assert.match(repository, /"ready" : "planned"/);
  assert.match(repository, /export async function markTripReady/);
  assert.match(repository, /export async function cancelReadyTrip/);
});

test("protected readiness APIs support manual and assistant completion", async () => {
  const routes = await readFile(
    new URL("../src/routes/trips.js", import.meta.url),
    "utf8",
  );

  assert.match(routes, /tripsRouter\.use\(requireAuth, requireDatabase\)/);
  assert.match(routes, /\/:tripId\/readiness/);
  assert.match(routes, /\/:tripId\/readiness\/:itemId/);
  assert.match(routes, /confirm-assistance/);
  assert.match(routes, /\/:tripId\/readiness\/complete/);
  assert.match(routes, /\/:tripId\/readiness\/cancel/);
  assert.match(routes, /\["flight", "accommodation", "shopping"\]/);
});

test("planner provides a live preview and reveals the readiness assistant after save", async () => {
  const [html, script] = await Promise.all([
    readFile(new URL("../public/trip-planner.html", import.meta.url), "utf8"),
    readFile(new URL("../public/js/trip-planner.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /id="live-announcement"/);
  assert.match(html, /id="live-destination"/);
  assert.match(html, /id="assist-ready-button"/);
  assert.match(html, />Assist To Ready My Trips/);
  assert.match(script, /function updateLiveTripPreview/);
  assert.match(script, /plannerForm\.addEventListener\("input", handleLivePlannerEdit\)/);
  assert.match(script, /assistReadyButton\.hidden = false/);
  assert.match(script, /\/assist-trip\?trip=/);
});

test("full-page checklist has two controls per item and a completion banner", async () => {
  const [html, script] = await Promise.all([
    readFile(new URL("../public/assist-trip.html", import.meta.url), "utf8"),
    readFile(new URL("../public/js/assist-trip.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /Things Might Need to Carry on This Trip/);
  assert.match(html, /id="trip-ready-banner"/);
  assert.match(html, />Your Trip Is Ready!</);
  assert.match(script, /checkbox\.type = "checkbox"/);
  assert.match(script, /"Assist For It"/);
  assert.match(script, /readyBanner\.hidden = total === 0 \|\| completed !== total/);
  assert.match(script, /\/api\/trips\/\$\{encodeURIComponent\(tripId\)\}\/readiness/);
  assert.match(script, /\/profile#ready-to-travel/);
});

test("profile separates booked trips from strictly complete ready trips", async () => {
  const [html, script, repository, migration] = await Promise.all([
    readFile(new URL("../public/profile.html", import.meta.url), "utf8"),
    readFile(new URL("../public/js/profile.js", import.meta.url), "utf8"),
    readFile(new URL("../src/repositories/profile-repository.js", import.meta.url), "utf8"),
    readFile(new URL("../database/migrations/006_ready_travel_status.sql", import.meta.url), "utf8"),
  ]);

  assert.match(html, /id="ready-to-travel"/);
  assert.match(html, /id="in-progress-trips"/);
  assert.match(html, /In Progress Trips ⏳/);
  assert.match(html, /Ready To Travel 🧳/);
  assert.match(html, /Are you sure you want to cancel this ready trip\?/);
  assert.match(script, /\/assist-trip\?trip=/);
  assert.match(script, /"Cancel Trip"/);
  assert.match(script, /Booked & Confirmed/);
  assert.match(script, /% Prepared/);
  assert.match(repository, /readiness\.is_required = TRUE/);
  assert.match(repository, /booking\.category IN \('flight', 'accommodation'\)/);
  assert.match(repository, /readiness_stage === "booked_confirmed"/);
  assert.match(repository, /readiness_stage === "ready"/);
  assert.match(migration, /SET status = 'ready'/);
});

test("readiness status is calculated from required items and confirmed bookings", async () => {
  const [readiness, checkout, schema, hostedWorker] = await Promise.all([
    readFile(new URL("../src/repositories/readiness-repository.js", import.meta.url), "utf8"),
    readFile(new URL("../src/repositories/checkout-repository.js", import.meta.url), "utf8"),
    readFile(new URL("../database/schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../worker/hosted-worker.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /is_required BOOLEAN NOT NULL DEFAULT TRUE/);
  for (const source of [readiness, checkout]) {
    assert.match(source, /is_required = TRUE/);
    assert.match(source, /confirmed_bookings/);
    assert.match(source, /"booked_confirmed"/);
    assert.match(source, /Math\.round\(\(completed \/ total\) \* 100\)/);
  }
  assert.match(hostedWorker, /is_required = 1/);
  assert.match(hostedWorker, /inProgressTrips/);
});

test("assistant pages confirm selections and return to the checklist", async () => {
  const [flight, stay, shop, storeScript] = await Promise.all([
    readFile(new URL("../public/assist-flight.html", import.meta.url), "utf8"),
    readFile(new URL("../public/assist-stay.html", import.meta.url), "utf8"),
    readFile(new URL("../public/assist-store.html", import.meta.url), "utf8"),
    readFile(new URL("../public/js/store-assistant.js", import.meta.url), "utf8"),
  ]);

  assert.match(flight, /data-assistant-type="flight"/);
  assert.match(stay, /data-assistant-type="accommodation"/);
  assert.match(shop, /data-assistant-type="shopping"/);
  assert.match(storeScript, /\/api\/checkout\/process/);
  assert.match(storeScript, /orderType: "GEAR"/);
  assert.match(storeScript, /returnUrl\.searchParams\.set\("completed", activeStoreItem\.key\)/);
  assert.match(storeScript, /window\.location\.assign/);
  assert.match(shop, /does not collect card details or process a real payment/i);
});
