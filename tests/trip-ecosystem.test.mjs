import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  schema,
  migration,
  routes,
  repository,
  checklistHtml,
  checklistClient,
  itineraryHtml,
  itineraryClient,
  visaHtml,
  visaClient,
  expensesHtml,
  expensesClient,
  toolsClient,
  worker,
] = await Promise.all([
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
  readFile(new URL("../public/trip-expenses.html", import.meta.url), "utf8"),
  readFile(new URL("../public/js/trip-expenses.js", import.meta.url), "utf8"),
  readFile(new URL("../public/js/trip-tools-widget.js", import.meta.url), "utf8"),
  readFile(new URL("../worker/hosted-worker.mjs", import.meta.url), "utf8"),
]);

test("MySQL stores interactive itineraries, visa rules, expenses, and splits", () => {
  for (const source of [schema, migration]) {
    for (const table of ["itinerary_activities", "visa_rules", "trip_expenses", "expense_splits"]) {
      assert.match(source, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    }
    assert.match(source, /ON DELETE CASCADE/);
  }
  assert.match(schema, /smart_tag VARCHAR\(160\)/);
  assert.match(schema, /'INSURANCE'/);
});

test("checklist uses five smart categories, exact persistence route, and connected assistants", () => {
  for (const label of ["Documents", "Health & Medication", "Clothing & Gear", "Special Care", "Electronics & Tech"]) {
    assert.match(checklistClient, new RegExp(label.replace(/[&]/g, "&")));
  }
  assert.match(checklistHtml, /ready-category-tabs/);
  assert.match(checklistHtml, /data-trip-tools/);
  assert.match(checklistClient, /\/api\/checklist\/update/);
  assert.match(checklistClient, /\/assist-visa/);
  assert.match(checklistClient, /data-lucide="sparkles"/);
});

test("itinerary builder provides day tabs, time periods, transit, add, and PDF export", () => {
  assert.match(itineraryHtml, /id="day-selector"/);
  assert.match(itineraryHtml, /Export Itinerary as PDF/);
  assert.match(itineraryClient, /morning: \{ label: "Morning", icon: "sun"/);
  assert.match(itineraryClient, /transit-connector/);
  assert.match(itineraryClient, /window\.print\(\)/);
  assert.match(routes, /\/itinerary\/generate/);
  assert.match(repository, /INSERT INTO itinerary_activities/);
});

test("visa and insurance assistant uses supported payment choices and checklist handoff", () => {
  assert.match(`${visaHtml}\n${visaClient}`, /Visa Free Access/);
  assert.match(`${visaHtml}\n${visaClient}`, /E-Visa \/ Visa on Arrival Required/);
  assert.match(`${visaHtml}\n${visaClient}`, /Consular Visa Required/);
  assert.match(visaHtml, /VISA/);
  assert.match(visaHtml, /MASTERCARD/);
  assert.match(visaClient, /orderType: "INSURANCE"/);
  assert.match(visaClient, /checklistItemKey: "travel-insurance"/);
});

test("trip tools provide weather alerts and five-currency conversion", () => {
  assert.match(toolsClient, /THB/);
  assert.match(toolsClient, /MMK/);
  assert.match(toolsClient, /CNY/);
  assert.match(toolsClient, /USD/);
  assert.match(toolsClient, /SGD/);
  assert.match(`${toolsClient}\n${routes}`, /weather\.alert|Rain is likely/);
  assert.match(routes, /\/trip-tools/);
});

test("expense tracker logs shared costs and renders settlement suggestions", () => {
  assert.match(expensesHtml, /Total Spent/);
  assert.match(expensesHtml, /Budget Variance/);
  assert.match(expensesHtml, /Who paid/i);
  assert.match(expensesClient, /owes/);
  assert.match(routes, /\/expenses\/log/);
  assert.match(repository, /INSERT INTO expense_splits/);
  assert.match(worker, /hosted_expense_splits/);
});

test("hosted worker exposes every connected ecosystem route", () => {
  for (const route of ["/api/checklist/update", "/api/itinerary/generate", "/api/visa/status", "/api/trip-tools", "/api/expenses/log"]) {
    assert.match(worker, new RegExp(route.replaceAll("/", "\\/")));
  }
});
