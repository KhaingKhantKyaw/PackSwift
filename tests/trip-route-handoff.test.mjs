import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  convertCurrency,
  createTravelPlan,
  destinationCatalog,
  estimateTransitCostUsd,
  minimumTripBudgetDetails,
  minimumTripBudgetUsd,
  routeDistanceKm,
} from "../src/services/travel-planner.js";

const [plannerHtml, plannerClient, schema, repository, pages] =
  await Promise.all([
    readFile(new URL("../public/trip-planner.html", import.meta.url), "utf8"),
    readFile(new URL("../public/js/trip-planner.js", import.meta.url), "utf8"),
    readFile(new URL("../database/schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/repositories/trip-repository.js", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/pages.js", import.meta.url), "utf8"),
  ]);

test("Trip Planner provides exact route, scope, five currencies, and passenger counters", () => {
  assert.match(plannerHtml, /Most Popular Destinations/);
  for (const city of ["Bangkok", "Tokyo", "Singapore", "Bali", "Paris"]) {
    assert.match(plannerClient, new RegExp(`city: "${city}"`));
  }
  assert.match(plannerHtml, /name="tripScope" value="domestic"/);
  assert.match(plannerHtml, /name="tripScope" value="international" checked/);
  assert.match(plannerHtml, /id="origin-search" name="origin"/);
  assert.match(plannerHtml, /id="destination-search" name="destination"/);
  assert.match(plannerHtml, /id="adults" name="adults"/);
  assert.match(plannerHtml, /id="children" name="children"/);
  assert.doesNotMatch(plannerHtml, /Live budget matches/i);
  const currencies = [...plannerHtml.matchAll(/<option value="(THB|MMK|CNY|USD|SGD)"/g)]
    .map((match) => match[1]);
  assert.deepEqual(currencies, ["THB", "MMK", "CNY", "USD", "SGD"]);
  assert.match(plannerClient, /minimumBudgetForCurrentRoute/);
});

test("minimum budget uses distance, transit per person, trip days, and party size", () => {
  const origin = destinationCatalog.find(({ slug }) => slug === "yangon");
  const bangkok = destinationCatalog.find(({ slug }) => slug === "bangkok");
  const destination = destinationCatalog.find(({ slug }) => slug === "tokyo");
  assert.equal(routeDistanceKm(origin, bangkok), 577);
  assert.equal(estimateTransitCostUsd(origin, bangkok), 100);
  assert.deepEqual(
    minimumTripBudgetDetails("international", origin, bangkok, { travelers: 1, days: 7 }),
    {
      scope: "international",
      distanceKm: 577,
      travelers: 1,
      days: 7,
      dailyRatePerPersonUsd: 40,
      transitCostPerPersonUsd: 100,
      totalTransitCostUsd: 100,
      dailyStayCostUsd: 280,
      minimumBudgetUsd: 380,
    },
  );
  assert.equal(
    minimumTripBudgetUsd("international", origin, destination, { travelers: 3, days: 7 }),
    2355,
  );
  for (const [currency, expected] of [
    ["THB", 13300], ["MMK", 798000], ["CNY", 2736], ["SGD", 513],
  ]) {
    assert.ok(Math.abs(convertCurrency(380, "USD", currency) - expected) < 0.001);
  }
  const tightBudgetPlan = createTravelPlan({
    tripScope: "international",
    origin: "Yangon",
    destination: "Tokyo",
    adults: 2,
    children: 1,
    budget: 2354,
    currency: "USD",
    startDate: "2027-01-10",
    endDate: "2027-01-16",
  });
  assert.equal(tightBudgetPlan.input.budget, 2354);
  assert.equal(tightBudgetPlan.input.route.minimumBudgetUsd, 2355);
  assert.equal(tightBudgetPlan.budgetFit.withinBudget, false);
  const plan = createTravelPlan({
    tripScope: "international",
    origin: "Yangon",
    destination: "Tokyo",
    adults: 2,
    children: 1,
    budget: 2355,
    currency: "USD",
    startDate: "2027-01-10",
    endDate: "2027-01-16",
  });
  assert.equal(plan.input.travelers, 3);
  assert.equal(plan.input.route.origin.code, "RGN");
  assert.equal(plan.input.route.destination.code, "TYO");
  assert.equal(plan.input.route.distanceKm, 4765);
  assert.equal(plan.input.route.estimatedTransitCostUsd, 505);
  assert.equal(plan.input.route.totalTransitCostUsd, 1515);
  assert.equal(plan.input.route.dailyStayCostUsd, 840);
  assert.equal(plan.input.route.minimumBudgetUsd, 2355);

  const regionalPlan = createTravelPlan({
    tripScope: "international",
    origin: "Yangon",
    destination: "Bangkok",
    adults: 1,
    children: 0,
    budget: 10000,
    currency: "THB",
    startDate: "2027-01-10",
    endDate: "2027-01-13",
  });
  assert.equal(regionalPlan.input.route.transitCostPerPersonUsd, 100);
  assert.equal(regionalPlan.input.route.dailyStayCostUsd, 160);
  assert.equal(regionalPlan.input.route.minimumBudgetUsd, 260);
  assert.equal(regionalPlan.input.budget, 10000);
});

test("saved trips preserve the exact route and retired booking URLs redirect", () => {
  for (const field of [
    "trip_scope", "origin_name", "origin_country", "origin_airport_code",
    "adult_count", "child_count",
  ]) assert.match(schema, new RegExp(field));
  assert.match(repository, /travelerBreakdown/);
  assert.match(repository, /route:/);
  assert.match(pages, /"\/assist-flight"/);
  assert.match(pages, /response\.redirect\(302, "\/trip-planner"\)/);
});
