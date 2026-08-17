import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [html, script, styles] = await Promise.all([
  readFile(new URL("../public/assist-flight.html", import.meta.url), "utf8"),
  readFile(new URL("../public/js/flight-assistant.js", import.meta.url), "utf8"),
  readFile(new URL("../public/css/styles.css", import.meta.url), "utf8"),
]);

test("flight assistant is exclusively PackSwift branded with route filters", () => {
  assert.match(html, /PackSwift Flight Assistant/);
  assert.match(html, /id="filter-nonstop"/);
  assert.match(html, /id="filter-baggage"/);
  assert.match(html, /id="filter-price"/);
  assert.match(html, /id="flight-route-options"/);
  assert.doesNotMatch(html, /Trip\.com|Expedia|Skyscanner|AirAsia/i);
});

test("flight detail supports itinerary, fare, and baggage selection", () => {
  assert.match(html, /id="flight-detail-dialog"/);
  assert.match(html, /Economy Standard/);
  assert.match(html, /Economy Plus/);
  assert.match(html, /Carry-on 1 piece/);
  assert.match(script, /function openFlightDetail/);
  assert.match(script, /function setFare/);
});

test("flight booking includes all four validated steps and a live price card", () => {
  for (const label of [
    "Fill in your info",
    "Choose your seat",
    "Personalize your trip",
    "Finalize your payment",
  ]) assert.match(html, new RegExp(label));
  assert.match(html, /six months of validity/i);
  assert.match(html, /PackSwift Points/);
  assert.match(script, /function validatePassengerStep/);
  assert.match(script, /function renderSeatMap/);
  assert.match(script, /function updatePrice/);
  assert.match(html, /id="cardholder-name"/);
  assert.match(html, /id="card-number"/);
  assert.match(html, /id="card-expiry"/);
  assert.match(html, /id="card-cvv"/);
  assert.match(script, /function updateDetectedCardBrand/);
  assert.match(script, /function validateCardPaymentStep/);
  assert.match(script, /cardPassesLuhn/);
});

test("flight confirmation completes Air Tickets and returns to the checklist", () => {
  assert.match(script, /\/api\/checkout\/process/);
  assert.match(script, /orderType: "FLIGHT"/);
  assert.match(script, /passportExpiry/);
  assert.match(script, /returnUrl\.searchParams\.set\("completed", activeItem\.key\)/);
  assert.match(script, /window\.location\.assign/);
  assert.match(styles, /\.flight-booking-layout/);
});
