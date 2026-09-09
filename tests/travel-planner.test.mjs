import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildPackingList,
  currencyRatesToUsd,
  createTravelPlan,
  destinationCatalog,
} from "../src/services/travel-planner.js";

test("creates a complete rule-based travel plan", () => {
  const plan = createTravelPlan({
    budget: 1800,
    currency: "USD",
    travelers: 1,
    startDate: "2026-10-05",
    endDate: "2026-10-09",
    preferredClimate: "mild",
    pace: "balanced",
    interests: ["culture", "food"],
  });

  assert.equal(plan.days, 5);
  assert.ok(plan.destination.score > 0);
  assert.ok(plan.itinerary.length >= 1);
  assert.ok(plan.culturalNotes.length >= 1);
  assert.ok(plan.packingList.Essentials.length >= 1);
});

test("adds rain preparation when conditions require it", () => {
  const list = buildPackingList({ climate: "warm", rain: "high", days: 7 });
  assert.ok(list.Comfort.includes("Compact umbrella"));
  assert.ok(list.Comfort.includes("Packable rain shell"));
});

test("rejects unsafe planning input ranges", () => {
  assert.throws(
    () => createTravelPlan({ budget: 0, travelers: 1 }),
    /Budget must be greater than zero/,
  );
});

test("normalizes every supported budget currency", () => {
  const supported = [
    "USD", "EUR", "GBP", "THB", "SGD", "MYR", "JPY",
    "KRW", "AUD", "CAD", "CNY", "INR", "MMK",
  ];
  assert.deepEqual(Object.keys(currencyRatesToUsd), supported);

  for (const currency of supported) {
    const budget = 2000 / currencyRatesToUsd[currency];
    const plan = createTravelPlan({
      budget,
      currency,
      travelers: 2,
      startDate: "2027-04-10",
      endDate: "2027-04-16",
      destination: "Tokyo",
      tripPurpose: "leisure",
      interests: ["culture", "food"],
    });
    assert.ok(Math.abs(plan.input.budgetUsd - 2000) < 0.02);
    assert.equal(plan.input.currency, currency);
  }
});

test("worldwide catalog covers every required region and representative country", () => {
  const regions = new Set(destinationCatalog.map((destination) => destination.region));
  assert.deepEqual(
    [...regions].sort(),
    ["Africa", "Americas", "Asia", "Europe", "Middle East", "Oceania"],
  );

  const countries = new Set(destinationCatalog.map((destination) => destination.country));
  for (const country of [
    "Japan", "South Korea", "Singapore", "Malaysia", "Indonesia", "Vietnam",
    "Philippines", "China", "India", "France", "Italy", "Spain", "Germany",
    "Switzerland", "Netherlands", "Greece", "USA", "Canada", "Mexico", "Brazil",
    "Australia", "New Zealand", "UAE", "Qatar", "Saudi Arabia", "South Africa",
    "Morocco", "Egypt", "Kenya",
  ]) {
    assert.ok(countries.has(country), `${country} is missing from the catalog`);
  }
});

test("recommendations reflect family, weather, packing, culture, and pet context", () => {
  const plan = createTravelPlan({
    budget: 4500,
    currency: "USD",
    travelers: 4,
    startDate: "2027-07-03",
    endDate: "2027-07-12",
    destination: "Europe",
    tripPurpose: "family",
    travelerDemographic: "family-with-children",
    travelingWithPets: true,
    interests: ["culture", "family"],
  });

  assert.match(plan.summary, /family/);
  assert.match(plan.weather.note, /July/);
  assert.ok(plan.destination.attractions.length >= 3);
  assert.ok(plan.culturalNotes.length >= 2);
  assert.ok(plan.packingList["Pet care"].length >= 1);
  assert.ok(plan.packingList.Essentials.includes("Family document folder"));
});

test("matches a 30,000 THB Thailand budget to Bangkok with tailored activities", () => {
  const plan = createTravelPlan({
    budget: 30000,
    currency: "THB",
    travelers: 2,
    startDate: "2026-08-26",
    endDate: "2026-09-01",
    destination: "Thailand",
    tripPurpose: "leisure",
    travelerDemographic: "adults",
    interests: ["culture", "food"],
  });

  assert.equal(plan.destination.name, "Bangkok");
  assert.equal(plan.budgetFit.withinBudget, true);
  assert.ok(plan.estimatedCost <= 30000);
  assert.ok(plan.alternatives.some((city) => city.name === "Chiang Mai"));
  assert.ok(plan.alternatives.some((city) => city.name === "Phuket"));
  assert.ok(
    plan.activityPreviews.some((activity) =>
      /cruise/i.test(activity.title),
    ),
  );
  assert.ok(
    plan.activityPreviews.some((activity) =>
      /market|shopping/i.test(`${activity.title} ${activity.category}`),
    ),
  );
});

test("build output contains all requested application pages", async () => {
  const pages = [
    "index.html",
    "trip-planner.html",
    "packing-list.html",
    "my-trips.html",
    "about.html",
    "login.html",
    "signup.html",
    "profile.html",
  ];

  for (const page of pages) {
    const html = await readFile(new URL(`../dist/client/${page}`, import.meta.url), "utf8");
    assert.match(html, /PackSwift/);
    assert.doesNotMatch(
      html,
      /e-commerce|shopping|inventory|cart|checkout|payment|booking/i,
    );
  }

  for (const page of [
    "assist-trip.html",
    "assist-visa.html",
    "trip-itinerary.html",
  ]) {
    const html = await readFile(
      new URL(`../dist/client/${page}`, import.meta.url),
      "utf8",
    );
    assert.match(html, /PackSwift/);
  }

  for (const retiredPage of [
    "assist-flight.html",
    "assist-stay.html",
    "assist-shop.html",
    "assist-store.html",
    "trip-expenses.html",
  ]) {
    await assert.rejects(readFile(new URL(`../dist/client/${retiredPage}`, import.meta.url), "utf8"));
  }
});
