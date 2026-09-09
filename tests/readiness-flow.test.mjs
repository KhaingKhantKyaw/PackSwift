import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const [schema, repository, routes, html, client, profileHtml, profileClient, profileRepository, pages] =
  await Promise.all([
    readFile(new URL("../database/schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/repositories/readiness-repository.js", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/trips.js", import.meta.url), "utf8"),
    readFile(new URL("../public/assist-trip.html", import.meta.url), "utf8"),
    readFile(new URL("../public/js/assist-trip.js", import.meta.url), "utf8"),
    readFile(new URL("../public/profile.html", import.meta.url), "utf8"),
    readFile(new URL("../public/js/profile.js", import.meta.url), "utf8"),
    readFile(new URL("../src/repositories/profile-repository.js", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/pages.js", import.meta.url), "utf8"),
  ]);

test("trip readiness remains durable, trip-owned, and duplicate safe", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS trip_readiness_items/);
  assert.match(schema, /FOREIGN KEY \(trip_session_id\) REFERENCES trip_sessions\(id\) ON DELETE CASCADE/);
  assert.match(schema, /UNIQUE KEY uq_trip_readiness_item \(trip_session_id, item_key\)/);
  assert.match(repository, /trip\.public_id = \? AND trip\.user_id = \?/);
  assert.match(repository, /"ready" : "planned"/);
});

test("protected readiness APIs support manual completion without purchase confirmation", () => {
  assert.match(routes, /tripsRouter\.use\(requireAuth, requireDatabase\)/);
  assert.match(routes, /\/:tripId\/readiness/);
  assert.match(routes, /\/:tripId\/readiness\/:itemId/);
  assert.match(routes, /\/:tripId\/readiness\/complete/);
  assert.match(routes, /\/:tripId\/readiness\/cancel/);
  assert.doesNotMatch(routes, /confirm-assistance|checkout|orders/);
});

test("full-page checklist uses Concierge guidance and a strict completion banner", () => {
  assert.match(html, /AI Trip Preparation Checklist/);
  assert.match(html, /id="trip-ready-banner"/);
  assert.match(html, />Your Trip Is Ready!</);
  assert.match(client, /checkbox\.type = "checkbox"/);
  assert.match(client, /Ask Concierge/);
  assert.match(client, /packswift:concierge:ask/);
  assert.match(client, /readyBanner\.hidden = total === 0 \|\| completed !== total/);
  assert.match(client, /\/profile#ready-to-travel/);
  assert.doesNotMatch(client, /assist-flight|assist-stay|assist-store|checkout/);
});

test("profile separates incomplete preparation from fully ready trips", () => {
  assert.match(profileHtml, /id="ready-to-travel"/);
  assert.match(profileHtml, /id="in-progress-trips"/);
  assert.match(profileHtml, /In Progress Trips ⏳/);
  assert.match(profileHtml, /Ready To Travel 🧳/);
  assert.match(profileClient, /\/assist-trip\?trip=/);
  assert.match(profileClient, /% Prepared/);
  assert.match(profileRepository, /readiness\.is_required = TRUE/);
  assert.match(profileRepository, /readiness_stage === "planned"/);
  assert.match(profileRepository, /readiness_stage === "ready"/);
  assert.doesNotMatch(`${profileHtml}\n${profileClient}\n${profileRepository}`, /My Orders|booked_confirmed|confirmed_booking/);
});

test("retired commerce pages are absent and their old URLs redirect safely", async () => {
  for (const file of [
    "assist-flight.html",
    "assist-stay.html",
    "assist-store.html",
    "assist-shop.html",
    "trip-expenses.html",
  ]) {
    await assert.rejects(access(new URL(`../public/${file}`, import.meta.url)));
  }
  assert.match(pages, /"\/assist-flight"/);
  assert.match(pages, /"\/trip-expenses"/);
  assert.match(pages, /response\.redirect\(302, "\/trip-planner"\)/);
});
