import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildGooglePlacesSearchStrategy,
  fetchGooglePlacePhoto,
  fetchGooglePlacesByIds,
  normalizeGooglePlace,
  resolveDestinationSearchContext,
  searchGooglePlaces,
} from "../src/services/google-places-service.js";
import { recommendPlannerActivities } from "../src/services/live-trip-recommendation.js";

const [schema, migration, globalMigration, routes, cacheRepository, client, worker, envExample] = await Promise.all([
  readFile(new URL("../database/schema.sql", import.meta.url), "utf8"),
  readFile(new URL("../database/migrations/012_destination_places_cache.sql", import.meta.url), "utf8"),
  readFile(new URL("../database/migrations/017_global_places_cache.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/activities.js", import.meta.url), "utf8"),
  readFile(new URL("../src/repositories/destination-place-cache-repository.js", import.meta.url), "utf8"),
  readFile(new URL("../public/js/trip-planner.js", import.meta.url), "utf8"),
  readFile(new URL("../worker/hosted-worker.mjs", import.meta.url), "utf8"),
  readFile(new URL("../.env.example", import.meta.url), "utf8"),
]);

const googlePlace = {
  id: "ChIJBangkokExample123",
  displayName: { text: "Bangkok Riverside Market" },
  formattedAddress: "Bangkok, Thailand",
  primaryType: "market",
  types: ["market", "restaurant", "tourist_attraction"],
  rating: 4.8,
  userRatingCount: 2450,
  priceLevel: "PRICE_LEVEL_MODERATE",
  googleMapsUri: "https://maps.google.com/?cid=example",
  photos: [{
    name: "places/example/photos/photo-reference",
    authorAttributions: [{ displayName: "Example Traveller" }],
  }],
};

test("Google Places search uses the current Text Search API without exposing its key", async () => {
  const calls = [];
  const activities = await searchGooglePlaces(
    { destination: "Bangkok", purpose: "food", limit: 8 },
    {
      apiKey: "test-google-places-api-key-123456",
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return new Response(JSON.stringify({ places: [googlePlace] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://places.googleapis.com/v1/places:searchText");
  assert.equal(calls[0].options.headers["x-goog-api-key"], "test-google-places-api-key-123456");
  assert.match(calls[0].options.headers["x-goog-fieldmask"], /places\.photos/);
  assert.match(JSON.parse(calls[0].options.body).textQuery, /Bangkok/);
  assert.equal(activities[0].title, "Bangkok Riverside Market");
  assert.equal(activities[0].rating, 4.8);
  assert.equal(activities[0].imageUrl, "/api/activities/photo/ChIJBangkokExample123");
  assert.doesNotMatch(JSON.stringify(activities), /test-google-places-api-key/);
});

test("worldwide scope detection distinguishes countries from cities", () => {
  const country = resolveDestinationSearchContext({ destination: "Myanmar" });
  assert.equal(country.scope, "country");
  assert.equal(country.country, "Myanmar");
  const city = resolveDestinationSearchContext({
    destination: "Paris",
    country: "France",
    destinationScope: "city",
  });
  assert.equal(city.scope, "city");
  assert.equal(city.label, "Paris, France");
  assert.equal(resolveDestinationSearchContext({ destination: "USA" }).country, "United States");
});

test("country and city searches incorporate purpose, group, and pace", () => {
  const nationwide = buildGooglePlacesSearchStrategy({
    destination: "Thailand",
    purpose: "cultural",
    group: "friends-group",
    pace: "relaxed",
  });
  assert.equal(nationwide.scope, "country");
  assert.match(nationwide.query, /historical landmarks/i);
  assert.match(nationwide.query, /coastal boat tours/i);
  assert.match(nationwide.query, /peaceful nature spots/i);
  assert.match(nationwide.query, /Thailand/);

  const city = buildGooglePlacesSearchStrategy({
    destination: "Tokyo",
    country: "Japan",
    destinationScope: "city",
    purpose: "food",
    group: "solo",
    pace: "culinary",
  });
  assert.equal(city.scope, "city");
  assert.match(city.query, /Tokyo, Japan/);
  assert.match(city.query, /markets, cafes/i);
});

test("Google categories feed PackSwift group, budget, and pace ranking", () => {
  const activity = normalizeGooglePlace(googlePlace, { destination: "Bangkok" });
  assert.ok(activity.purposeTags.includes("food"));
  assert.ok(activity.experienceTags.includes("market"));
  assert.ok(activity.suitableGroups.includes("friends-group"));
  const recommendation = recommendPlannerActivities(
    Array.from({ length: 10 }, (_, index) => ({ ...activity, slug: `${activity.slug}-${index}` })),
    {
      cityId: "bkk",
      group: "friends-group",
      purpose: "food",
      pace: "packed",
      budgetUsd: 3000,
      days: 5,
      travelers: 4,
    },
  );
  assert.equal(recommendation.activities.length, 8);
  assert.equal(recommendation.activitiesPerDay, 5);
});

test("photo proxy refreshes the non-cacheable photo name for every request", async () => {
  const calls = [];
  const photo = await fetchGooglePlacePhoto("ChIJBangkokExample123", {
    apiKey: "test-google-places-api-key-123456",
    fetchImpl: async (url) => {
      calls.push(url);
      if (calls.length === 1) {
        return new Response(JSON.stringify({ photos: [{ name: "places/example/photos/fresh-photo" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    },
  });
  assert.equal(calls.length, 2);
  assert.match(calls[0], /\/places\/ChIJBangkokExample123$/);
  assert.match(calls[1], /fresh-photo\/media/);
  assert.equal(photo.headers.get("content-type"), "image/jpeg");
});

test("cached Place IDs refresh live details without another text search", async () => {
  const calls = [];
  const activities = await fetchGooglePlacesByIds(
    ["ChIJBangkokExample123"],
    {
      destination: "Bangkok, Thailand",
      apiKey: "test-google-places-api-key-123456",
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return new Response(JSON.stringify(googlePlace), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/v1\/places\/ChIJBangkokExample123$/);
  assert.doesNotMatch(calls[0].url, /searchText/);
  assert.match(calls[0].options.headers["x-goog-fieldmask"], /photos/);
  assert.equal(activities[0].title, "Bangkok Riverside Market");
});

test("MySQL cache stores compliant Place IDs and never stores Google photo content", () => {
  for (const sql of [schema, migration]) {
    const table = sql.match(/CREATE TABLE IF NOT EXISTS destination_places_cache \([\s\S]*?\n\);/)?.[0];
    assert.ok(table, "destination_places_cache table is missing");
    assert.match(table, /provider_place_id VARCHAR\(255\) NOT NULL/);
    assert.match(table, /destination_key VARCHAR\(160\) NOT NULL/);
    assert.doesNotMatch(table, /photo_url|photo_name|place_name|rating|description/i);
  }
  assert.match(schema, /destination_name VARCHAR\(160\) NOT NULL/);
  assert.match(schema, /destination_scope ENUM\('country', 'city'\) NOT NULL/);
  assert.match(schema, /search_query VARCHAR\(500\) NOT NULL/);
  assert.match(schema, /category_tags JSON NOT NULL/);
  assert.match(globalMigration, /ADD COLUMN search_query VARCHAR\(500\)/);
  assert.match(cacheRepository, /findDestinationPlaceReferences/);
  assert.match(cacheRepository, /DATE_SUB\(CURRENT_TIMESTAMP, INTERVAL 30 DAY\)/);
  assert.doesNotMatch(cacheRepository, /photo_name|photo_url/);
});

test("live planner uses the new recommendation API locally and when hosted", () => {
  assert.match(routes, /activitiesRouter\.post\([\s\S]*?"\/recommend"/);
  assert.match(routes, /searchGooglePlaces/);
  assert.match(routes, /rememberDestinationPlaceReferences/);
  assert.match(routes, /findDestinationPlaceReferences/);
  assert.match(routes, /fetchGooglePlacesByIds/);
  assert.match(client, /fetch\("\/api\/activities\/recommend"/);
  for (const field of ["destination", "travel_purpose", "travel_group", "travel_pace", "budget"]) {
    assert.match(client, new RegExp(`${field}:`));
  }
  assert.match(worker, /url\.pathname !== "\/api\/activities\/recommend"/);
  assert.match(worker, /GOOGLE_PLACES_API_KEY/);
  assert.match(envExample, /GOOGLE_PLACES_API_KEY=/);
  assert.doesNotMatch(client, /GOOGLE_PLACES_API_KEY|x-goog-api-key/i);
});
