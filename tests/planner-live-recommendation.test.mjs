import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateBudgetProfile,
  readPlannerActivitySeed,
  recommendPlannerActivities,
} from "../src/services/live-trip-recommendation.js";

const html = await readFile(new URL("../public/trip-planner.html", import.meta.url), "utf8");
const client = await readFile(new URL("../public/js/trip-planner.js", import.meta.url), "utf8");
const schema = await readFile(new URL("../database/schema.sql", import.meta.url), "utf8");
const api = await readFile(new URL("../src/routes/planner.js", import.meta.url), "utf8");
const activities = await readPlannerActivitySeed();

const baseInput = {
  cityId: "bkk",
  budgetUsd: 5000,
  days: 7,
  travelers: 5,
  purpose: "leisure",
  group: "friends-group",
  pace: "balanced",
};

test("budget engine categorizes the documented group example", () => {
  const profile = calculateBudgetProfile(baseInput);
  assert.equal(profile.tier, "mid");
  assert.equal(profile.label, "Comfort");
  assert.equal(profile.perPersonDayUsd, 142.86);
});

test("Bangkok seed covers the required activity categories and tags", () => {
  assert.ok(activities.length >= 15);
  const titles = new Set(activities.map((activity) => activity.title));
  for (const title of [
    "Grand Palace & Wat Phra Kaew",
    "Private Chao Phraya Yacht Tour",
    "Chao Phraya Dinner Cruise",
    "ICONSIAM Riverside Shopping",
    "Chatuchak Weekend Market",
    "Samed Island Day Trip",
    "Bangkok Rooftop Social Night",
    "Michelin Street Food Tour",
  ]) assert.ok(titles.has(title), title);
  assert.ok(activities.every((activity) => activity.imageUrl.startsWith("/images/activities/")));
});

test("friends leisure excludes couples-only cruises and prioritizes social choices", () => {
  const result = recommendPlannerActivities(activities, baseInput);
  const titles = result.activities.map((activity) => activity.title);
  assert.ok(titles.includes("Private Chao Phraya Yacht Tour"));
  assert.ok(titles.some((title) => /ICONSIAM|Pattaya|Rooftop/.test(title)));
  assert.ok(!titles.includes("Chao Phraya Dinner Cruise"));
  assert.equal(result.activitiesPerDay, 4);
});

test("couples and family receive purpose-compatible Bangkok suggestions", () => {
  const couples = recommendPlannerActivities(activities, {
    ...baseInput,
    travelers: 2,
    group: "couples",
    pace: "relaxed",
  });
  assert.ok(couples.activities.some((activity) =>
    /Dinner Cruise|Spa & Sunset/.test(activity.title),
  ));
  assert.equal(couples.activitiesPerDay, 2);

  const family = recommendPlannerActivities(activities, {
    ...baseInput,
    group: "family-with-children",
  });
  assert.ok(family.activities.some((activity) => /Waterpark|Family Temple/.test(activity.title)));
});

test("packed pace expands each preview day to five activities", () => {
  const result = recommendPlannerActivities(activities, { ...baseInput, pace: "packed" });
  assert.equal(result.activitiesPerDay, 5);
  assert.equal(result.itinerary[0].activities.length, 5);
});

test("specialized paces prioritize culture and food experiences", () => {
  const cultural = recommendPlannerActivities(activities, {
    ...baseInput,
    purpose: "cultural",
    pace: "cultural",
  });
  assert.equal(cultural.activitiesPerDay, 3);
  assert.ok(cultural.activities.every((activity) =>
    activity.experienceTags.some((tag) => ["culture", "history", "temple"].includes(tag)),
  ));

  const culinary = recommendPlannerActivities(activities, {
    ...baseInput,
    purpose: "food",
    pace: "culinary",
  });
  assert.equal(culinary.activitiesPerDay, 4);
  assert.ok(culinary.activities.some((activity) =>
    activity.experienceTags.some((tag) => ["food", "market", "cafe", "dinner"].includes(tag)),
  ));
});

test("smart pace settings alter itinerary timing and clustering", () => {
  const result = recommendPlannerActivities(activities, {
    ...baseInput,
    lateRiser: true,
    middayRest: true,
    clusterNearby: true,
  });
  assert.equal(result.schedule.startTime, "10:30");
  assert.equal(result.schedule.middayRest, true);
  assert.equal(result.schedule.clusterNearby, true);
  assert.equal(result.itinerary[0].startTime, "10:30");
  assert.equal(result.itinerary[0].middayRest, true);
});

test("Trip Planner connects live UI, debounced API, photos, and MySQL schema", () => {
  assert.match(html, /id="live-activity-grid"/);
  assert.match(html, /id="live-itinerary-list"/);
  assert.match(html, /id="live-budget-category"/);
  assert.match(client, /setTimeout\(async \(\) => \{[\s\S]*?500\)/);
  assert.match(client, /\/api\/activities\/recommend/);
  assert.match(client, /late_riser: input\.smartPace\.lateRiser/);
  assert.match(client, /nearby stops clustered/);
  assert.match(client, /image\.src = activity\.imageUrl/);
  assert.match(api, /findPlannerActivities/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS planner_activities/);
  assert.match(schema, /suitable_groups JSON NOT NULL/);
  assert.match(schema, /budget_tier ENUM\('budget', 'mid', 'luxury'\)/);
  assert.match(schema, /pace_level ENUM\('slow', 'balanced', 'fast'\)/);
});
