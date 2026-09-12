import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildTripBudgetScenarios,
  createTravelPlan,
  lifestyleDailyRateUsd,
  normalizeTravelStyle,
  routeLocation,
} from "../src/services/travel-planner.js";

const [html, client, styles, schema, repository, concierge, tripsRoute] = await Promise.all([
  readFile(new URL("../public/trip-planner.html", import.meta.url), "utf8"),
  readFile(new URL("../public/js/trip-planner.js", import.meta.url), "utf8"),
  readFile(new URL("../public/css/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../database/schema.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/repositories/trip-repository.js", import.meta.url), "utf8"),
  readFile(new URL("../src/services/geminiService.js", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/trips.js", import.meta.url), "utf8"),
]);

const basePlan = {
  budget: 10000,
  currency: "THB",
  adults: 1,
  children: 0,
  tripScope: "international",
  origin: "Yangon",
  destination: "Bangkok",
  startDate: "2026-11-10",
  endDate: "2026-11-13",
  tripPurpose: "leisure",
  pace: "balanced",
  travelerDemographic: "solo",
};

test("Trip Planner collects intention, lifestyle, flexibility, and must-have preferences", () => {
  for (const value of [
    "make-possible", "fixed-budget", "best-value", "comfort-first", "luxury", "once-in-lifetime",
  ]) assert.match(html, new RegExp(`name="planningGoal" value="${value}"`));
  for (const field of [
    "accommodationStyle", "foodStyle", "transportStyle", "activityStyle", "extrasStyle",
    "dateFlexible", "tripLengthFlexible", "mustHaveExperience",
  ]) assert.match(html, new RegExp(`name="${field}"`));
  assert.match(client, /function travelStyleFromFormData/);
  assert.match(html, /Three ways to make this trip work/);
  assert.match(styles, /\.planning-goal-grid/);
  assert.match(styles, /\.live-budget-options/);
});

test("lifestyle pricing changes without judging the same user budget", () => {
  const low = lifestyleDailyRateUsd({
    planningGoal: "make-possible", accommodationStyle: "hostel",
    foodStyle: "street", transportStyle: "public", activityStyle: "free",
  });
  const luxury = lifestyleDailyRateUsd({
    planningGoal: "luxury", accommodationStyle: "luxury",
    foodStyle: "fine", transportStyle: "premium", activityStyle: "premium",
  });
  assert.ok(low < luxury);
  assert.equal(normalizeTravelStyle({ planningGoal: "unknown" }).planningGoal, "best-value");
});

test("budget scenarios provide viable, matched, and comfort paths", () => {
  const scenarios = buildTripBudgetScenarios({
    origin: routeLocation("Yangon"), destination: routeLocation("Bangkok"),
    adults: 2, children: 2, days: 5, budgetUsd: 1000,
    planningGoal: "once-in-lifetime", mustHaveExperience: "Koh Larn beach day",
  });
  assert.ok(scenarios.viableUsd < scenarios.recommendedUsd);
  assert.ok(scenarios.recommendedUsd < scenarios.comfortUsd);
  assert.equal(scenarios.transitPerPersonUsd, 100);
});

test("a low budget remains plannable while fixed and luxury lifestyles produce different plans", () => {
  const fixed = createTravelPlan({
    ...basePlan,
    planningGoal: "fixed-budget",
    accommodationStyle: "budget",
    foodStyle: "street",
    transportStyle: "public",
    activityStyle: "free",
  });
  const luxury = createTravelPlan({
    ...basePlan,
    planningGoal: "luxury",
    accommodationStyle: "luxury",
    foodStyle: "fine",
    transportStyle: "premium",
    activityStyle: "premium",
  });
  assert.equal(fixed.input.budget, 10000);
  assert.equal(fixed.input.planningGoal, "fixed-budget");
  assert.ok(fixed.estimatedCostUsd < luxury.estimatedCostUsd);
  assert.match(fixed.budgetFit.message, /accepted as your limit|stays within/i);
});

test("traveler lifestyle is persisted and exposed through the budget and Concierge contracts", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS traveler_profiles/);
  assert.match(repository, /INSERT INTO traveler_profiles/);
  assert.match(repository, /planningGoal: plan\.input\.planningGoal/);
  assert.match(concierge, /planning_goal/);
  assert.match(concierge, /Never reject a low budget automatically/);
  assert.match(tripsRoute, /budget_paths/);
  assert.match(tripsRoute, /minimum_viable/);
  assert.match(tripsRoute, /lifestyle_matched/);
  assert.match(tripsRoute, /comfort_upgrade/);
});
