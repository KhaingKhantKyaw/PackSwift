import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [schema, migration, routes, repository, client, styles, html, worker] = await Promise.all([
  readFile(new URL("../database/schema.sql", import.meta.url), "utf8"),
  readFile(new URL("../database/migrations/018_trip_itinerary_items.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/activities.js", import.meta.url), "utf8"),
  readFile(new URL("../src/repositories/trip-plan-repository.js", import.meta.url), "utf8"),
  readFile(new URL("../public/js/trip-planner.js", import.meta.url), "utf8"),
  readFile(new URL("../public/css/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../public/trip-planner.html", import.meta.url), "utf8"),
  readFile(new URL("../worker/hosted-worker.mjs", import.meta.url), "utf8"),
]);

test("selected place IDs persist against an owned trip without copied Google content", () => {
  for (const sql of [schema, migration]) {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS trip_itinerary_items/);
    assert.match(sql, /place_id VARCHAR\(255\) NOT NULL/);
    assert.match(sql, /UNIQUE KEY uq_trip_itinerary_place/);
    assert.doesNotMatch(
      sql.match(/CREATE TABLE IF NOT EXISTS trip_itinerary_items \([\s\S]*?\n\);/)?.[0] || "",
      /photo|rating|description|place_name/i,
    );
  }
  assert.match(repository, /WHERE public_id = \? AND user_id = \?/);
  assert.match(repository, /INSERT INTO trip_itinerary_items/);
  assert.match(repository, /connection\.beginTransaction\(\)/);
});

test("recommendations expose a six-card primary set and a replacement queue", () => {
  assert.match(routes, /saved_place_ids/);
  assert.match(routes, /excluded_place_ids/);
  assert.match(routes, /!savedPlaceIds\.has\(activity\.placeId\) && !excludedPlaceIds\.has\(activity\.placeId\)/);
  assert.match(routes, /const primary = candidates\.slice\(0, 6\)/);
  assert.match(routes, /const backupQueue = candidates\.slice\(6, 20\)/);
  assert.match(routes, /supplementalActivities/);
  assert.match(routes, /nextPageToken/);
  assert.match(worker, /hosted_trip_itinerary_items/);
  assert.match(worker, /excluded_place_ids/);
  assert.match(worker, /supplementalActivities/);
  assert.match(worker, /const backupQueue = candidates\.slice\(6, 20\)/);
});

test("activity cards add visibly, reject suggestions, replace, and refill without reload", () => {
  assert.match(client, /Add to visit/);
  assert.match(client, /Not interested/);
  assert.match(client, /fetch\("\/api\/activities\/recommend"/);
  assert.match(client, /"\/api\/trip\/plan\/add"/);
  assert.match(client, /rememberSelectedActivity\(activity\)/);
  assert.doesNotMatch(client, /function ensureSuggestionTrip/);
  assert.match(client, /dismissedActivityPlaceIds\.add\(placeId\)/);
  assert.match(client, /Added to this trip preview ✓/);
  assert.match(client, /card\.classList\.add\("is-leaving"\)/);
  assert.match(client, /card\.replaceWith\(replacementCard\)/);
  assert.match(client, /refillLiveRecommendationQueue/);
  assert.match(styles, /\.live-activity-card\.is-leaving/);
  assert.match(styles, /\.live-activity-card\.is-entering/);
  assert.match(styles, /\.live-activity-skip/);
  assert.match(styles, /\.selected-place-item/);
  assert.match(styles, /\.selected-place-thumbnail/);
  assert.match(styles, /aspect-ratio: 4 \/ 3/);
  assert.match(client, /image\.addEventListener\("error"/);
  assert.match(client, /fallbackApplied/);
  assert.match(html, /id="activity-plan-toast"/);
  assert.match(html, /id="selected-places-list"/);
  assert.doesNotMatch(client, /location\.reload\(\)/);
});
