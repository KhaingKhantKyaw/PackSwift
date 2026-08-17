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
  assert.match(routes, /filter\(\(activity\) => !savedPlaceIds\.has\(activity\.placeId\)\)/);
  assert.match(routes, /const primary = candidates\.slice\(0, 6\)/);
  assert.match(routes, /const backupQueue = candidates\.slice\(6, 20\)/);
  assert.match(routes, /nextPageToken/);
  assert.match(worker, /hosted_trip_itinerary_items/);
  assert.match(worker, /const backupQueue = candidates\.slice\(6, 20\)/);
});

test("activity cards add, fade, replace, refill, and announce success without reload", () => {
  assert.match(client, /Add to Plan/);
  assert.match(client, /fetch\("\/api\/activities\/recommend"/);
  assert.match(client, /"\/api\/trip\/plan\/add"/);
  assert.match(client, /card\.classList\.add\("is-leaving"\)/);
  assert.match(client, /card\.replaceWith\(replacementCard\)/);
  assert.match(client, /refillLiveRecommendationQueue/);
  assert.match(client, /Added to your plan! ✓/);
  assert.match(styles, /\.live-activity-card\.is-leaving/);
  assert.match(styles, /\.live-activity-card\.is-entering/);
  assert.match(html, /id="activity-plan-toast"/);
  assert.doesNotMatch(client, /location\.reload\(\)/);
});
