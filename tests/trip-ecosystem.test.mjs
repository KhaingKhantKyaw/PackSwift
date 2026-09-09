import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [schema, migration, routes, repository, checklistHtml, checklistClient, itineraryHtml, itineraryClient, visaHtml, visaClient, toolsClient, worker] =
  await Promise.all([
    readFile(new URL("../database/schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../database/migrations/013_trip_ecosystem.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/ecosystem.js", import.meta.url), "utf8"),
    readFile(new URL("../src/repositories/ecosystem-repository.js", import.meta.url), "utf8"),
    readFile(new URL("../public/assist-trip.html", import.meta.url), "utf8"),
    readFile(new URL("../public/js/assist-trip.js", import.meta.url), "utf8"),
    readFile(new URL("../public/trip-itinerary.html", import.meta.url), "utf8"),
    readFile(new URL("../public/js/trip-itinerary.js", import.meta.url), "utf8"),
    readFile(new URL("../public/assist-visa.html", import.meta.url), "utf8"),
    readFile(new URL("../public/js/visa-assistant.js", import.meta.url), "utf8"),
    readFile(new URL("../public/js/trip-tools-widget.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/hosted-worker.mjs", import.meta.url), "utf8"),
  ]);

test("MySQL keeps itinerary and visa intelligence without commerce tables", () => {
  for (const source of [schema, migration]) {
    assert.match(source, /CREATE TABLE IF NOT EXISTS itinerary_activities/);
    assert.match(source, /CREATE TABLE IF NOT EXISTS visa_rules/);
    assert.match(source, /ON DELETE CASCADE/);
    assert.doesNotMatch(source, /CREATE TABLE IF NOT EXISTS (orders|flight_bookings|hotel_bookings|gear_purchases|trip_expenses|expense_splits)/);
  }
  assert.match(schema, /smart_tag VARCHAR\(160\)/);
});

test("checklist uses five smart categories and Concierge actions", () => {
  for (const label of ["Documents", "Health & Medication", "Clothing & Gear", "Special Care", "Electronics & Tech"]) {
    assert.match(checklistClient, new RegExp(label));
  }
  assert.match(checklistHtml, /ready-category-tabs/);
  assert.match(checklistHtml, /data-trip-tools/);
  assert.match(checklistClient, /\/api\/checklist\/update/);
  assert.match(checklistClient, /packswift:concierge:ask/);
  assert.doesNotMatch(checklistClient, /assist-flight|assist-stay|assist-store/);
});

test("itinerary builder provides day tabs, transit, additions, and PDF export", () => {
  assert.match(itineraryHtml, /id="day-selector"/);
  assert.match(itineraryHtml, /Export Itinerary as PDF/);
  assert.match(itineraryClient, /morning: \{ label: "Morning", icon: "sun"/);
  assert.match(itineraryClient, /transit-connector/);
  assert.match(itineraryClient, /window\.print\(\)/);
  assert.match(routes, /\/itinerary\/generate/);
  assert.match(repository, /INSERT INTO itinerary_activities/);
});

test("visa module provides guidance and official-source handoff only", () => {
  assert.match(`${visaHtml}\n${visaClient}`, /Visa-free access may apply/);
  assert.match(`${visaHtml}\n${visaClient}`, /E-Visa or visa on arrival may be required/);
  assert.match(`${visaHtml}\n${visaClient}`, /Advance visa confirmation required/);
  assert.match(visaHtml, /Open official source/);
  assert.match(visaHtml, /Ask Concierge/);
  assert.doesNotMatch(`${visaHtml}\n${visaClient}`, /payment|MASTERCARD|orderType|travel-insurance/i);
});

test("trip tools provide weather alerts and five-currency conversion", () => {
  for (const currency of ["THB", "MMK", "CNY", "USD", "SGD"]) assert.match(toolsClient, new RegExp(currency));
  assert.match(`${toolsClient}\n${routes}`, /weather\.alert|Rain is likely/);
  assert.match(routes, /\/trip-tools/);
});

test("hosted worker exposes planning tools and excludes commerce APIs", () => {
  for (const route of ["/api/checklist/update", "/api/itinerary/generate", "/api/visa/status", "/api/trip-tools"]) {
    assert.match(worker, new RegExp(route.replaceAll("/", "\\/")));
  }
  assert.doesNotMatch(worker, /hosted_orders|checkout\/process|api\/orders|api\/expenses/);
});
