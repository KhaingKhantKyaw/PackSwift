import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [html, client, itineraryClient, styles, route, repository, schema, worker] = await Promise.all([
  readFile(new URL("../public/my-trips.html", import.meta.url), "utf8"),
  readFile(new URL("../public/js/my-trips.js", import.meta.url), "utf8"),
  readFile(new URL("../public/js/trip-itinerary.js", import.meta.url), "utf8"),
  readFile(new URL("../public/css/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/saved-trips.js", import.meta.url), "utf8"),
  readFile(new URL("../src/repositories/saved-trip-repository.js", import.meta.url), "utf8"),
  readFile(new URL("../database/schema.sql", import.meta.url), "utf8"),
  readFile(new URL("../worker/hosted-worker.mjs", import.meta.url), "utf8"),
]);

test("Saved Trips exposes authenticated create, update, delete, and fresh list APIs", () => {
  assert.match(route, /savedTripsRouter\.use\(requireAuth, requireDatabase\)/);
  assert.match(route, /savedTripsRouter\.post/);
  assert.match(route, /savedTripsRouter\.patch/);
  assert.match(route, /savedTripsRouter\.delete/);
  assert.match(route, /Cache-Control", "no-store/);
  assert.match(repository, /UPDATE saved_trips[\s\S]*WHERE id = \? AND user_id = \?/);
  assert.match(repository, /DELETE FROM saved_trips WHERE id = \? AND user_id = \?/);
});

test("Saved Trips UI performs real mutations and re-fetches authoritative rows", () => {
  assert.match(html, /id="add-saved-trip"/);
  assert.match(html, /id="saved-trip-dialog"/);
  assert.match(client, /method: editingTrip \? "PATCH" : "POST"/);
  assert.match(client, /method: "DELETE"/);
  assert.match(client, /await loadTrips\(\{ successMessage:/);
  assert.match(client, /cache: "no-store"/);
  assert.match(client, /fresh=\$\{Date\.now\(\)\}/);
  assert.match(client, /activeLoadController\?\.abort\(\)/);
  assert.match(client, /activeAccountUser[\s\S]*result\.savedTrips\.map\(normalizeServerTrip\)/);
});

test("Saved Trips ordering is update-aware locally and on the hosted database", () => {
  assert.match(schema, /updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP/);
  assert.match(schema, /idx_saved_trips_user_updated/);
  assert.match(repository, /ORDER BY updated_at DESC, id DESC/);
  assert.match(worker, /request\.method === "PATCH"[\s\S]*UPDATE hosted_saved_trips/);
  assert.match(worker, /updated_at = CURRENT_TIMESTAMP/);
  assert.match(worker, /request\.method === "DELETE"/);
});

test("Add plan stays faded and disabled until a database trip can be selected", () => {
  assert.match(html, /id="add-saved-trip"[^>]*opacity-50 pointer-events-none bg-slate-300 cursor-not-allowed[^>]*disabled/);
  assert.match(client, /function updateAddPlanButton\(accountTrips\)/);
  assert.match(client, /button\.disabled = disabled/);
  assert.match(client, /button\.classList\.toggle\("button-primary", !disabled\)/);
  assert.match(client, /selectedTripId = accountTrips\[0\]\?\.savedTripId \|\| null/);
  assert.match(client, /trip-select-button/);
  for (const utility of ["opacity-50", "pointer-events-none", "bg-slate-300", "cursor-not-allowed"]) {
    assert.match(styles, new RegExp(`\\.${utility.replace("-", "\\-")}`));
  }
});

test("enabled Add plan opens the activity form for the selected saved trip", () => {
  assert.match(client, /function addPlanToSelectedTrip/);
  assert.match(client, /candidate\.savedTripId === selectedTripId/);
  assert.match(client, /\/api\/trips\/import/);
  assert.match(client, /\/trip-itinerary\?trip=\$\{encodeURIComponent\(tripSessionId\)\}&action=add/);
  assert.match(itineraryClient, /itineraryAction === "add"/);
  assert.match(itineraryClient, /activityDialog\.showModal\(\)/);
});
