import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculatePopularityScore,
  synthesizeCommunityGuidance,
} from "../src/services/destination-insight-service.js";
import {
  buildDetailedTimeline,
  timelineHasOverlaps,
} from "../src/services/itinerary-timeline-service.js";
import { createTravelPlan } from "../src/services/travel-planner.js";
import { saveTrip } from "../src/repositories/trip-repository.js";
import { readDestinationCatalog } from "../scripts/destination-seed.mjs";

test("calculates the documented PackSwift community popularity score", () => {
  assert.equal(
    calculatePopularityScore({
      reviewCount: 10,
      reportCount: 4,
      savedTripCount: 3,
      averageRating: 4.5,
    }),
    51.5,
  );
});

test("synthesizes What to Know and What to Avoid from structured reviews", () => {
  const guidance = synthesizeCommunityGuidance({
    reviews: [
      {
        what_to_know: "Carry cash for smaller local businesses.",
        what_to_avoid: "Avoid unlicensed airport transport.",
        positive_tags_json: ["temple etiquette"],
        caution_tags_json: ["late-night isolated areas"],
      },
      {
        what_to_know: "Carry cash for smaller local businesses.",
        what_to_avoid: "Avoid unlicensed airport transport.",
        positive_tags_json: ["local markets"],
        caution_tags_json: ["late-night isolated areas"],
      },
    ],
    reports: [],
  });

  assert.equal(
    guidance.whatToKnow[0],
    "Carry cash for smaller local businesses.",
  );
  assert.equal(
    guidance.whatToAvoid[0],
    "Avoid unlicensed airport transport.",
  );
  assert.ok(
    guidance.whatToAvoid.some((tip) =>
      tip.includes("late-night isolated areas"),
    ),
  );
});

test("creates a non-overlapping Yangon itinerary beginning at the airport", () => {
  const timeline = buildDetailedTimeline(
    {
      days: 4,
      destination: {
        slug: "yangon",
        code: "RGN",
        name: "Yangon",
        country: "Myanmar",
        attractions: [
          "Shwedagon Pagoda",
          "Bogyoke Market",
          "Yangon Circular Railway",
        ],
      },
      input: {
        tripPurpose: "leisure",
        pace: "balanced",
        arrivalAt: "2026-11-10T09:30:00",
      },
    },
    {
      slug: "yangon",
      name: "Yangon",
      countryName: "Myanmar",
      primaryAirportCode: "RGN",
      hotelName: "Downtown Yangon Hotel",
    },
  );

  assert.match(timeline[0].title, /RGN/);
  assert.equal(timeline[0].type, "arrival");
  assert.ok(
    timeline.some(
      (entry) =>
        entry.type === "airport-transfer" &&
        /official airport taxi/i.test(entry.transitMode),
    ),
  );
  assert.ok(timeline.some((entry) => entry.safetyNote));
  assert.ok(timeline.some((entry) => entry.type === "departure"));
  assert.equal(timelineHasOverlaps(timeline), false);
});

test("accepts a MySQL DATETIME when regenerating a timeline", () => {
  const timeline = buildDetailedTimeline(
    {
      days: 2,
      destination: {
        slug: "yangon",
        code: "RGN",
        name: "Yangon",
        country: "Myanmar",
        attractions: ["Shwedagon Pagoda"],
      },
      input: {
        tripPurpose: "leisure",
        pace: "balanced",
        arrivalAt: "2026-12-01 09:00:00",
      },
    },
  );

  assert.equal(timeline[0].startTime, "09:00");
  assert.equal(timelineHasOverlaps(timeline), false);
});

test("Part 2 routes protect trip-owned records and expose required APIs", async () => {
  const [apiRoutes, tripRoutes, destinationRoutes, tripRepository] =
    await Promise.all([
      readFile(new URL("../src/routes/api.js", import.meta.url), "utf8"),
      readFile(new URL("../src/routes/trips.js", import.meta.url), "utf8"),
      readFile(
        new URL("../src/routes/destinations.js", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/repositories/trip-repository.js", import.meta.url),
        "utf8",
      ),
    ]);

  assert.match(apiRoutes, /apiRouter\.use\("\/destinations", destinationsRouter\)/);
  assert.match(apiRoutes, /apiRouter\.use\("\/trips", tripsRouter\)/);
  assert.match(destinationRoutes, /\/:slug\/insights/);
  assert.match(tripRoutes, /\/:tripId\/packing-context/);
  assert.match(tripRoutes, /\/:tripId\/packing-list/);
  assert.match(tripRoutes, /tripsRouter\.use\(requireAuth, requireDatabase\)/);
  assert.match(tripRepository, /public_id = \?\s+AND ts\.user_id = \?/);
  assert.match(
    tripRepository,
    /trip\.public_id = \?\s+AND trip\.user_id = \?/,
  );
});

test("canonical destination seed covers Yangon and Bangkok", async () => {
  const catalog = await readDestinationCatalog();
  assert.ok(catalog.length >= 30);
  assert.ok(catalog.some((destination) => destination.slug === "yangon"));
  assert.ok(catalog.some((destination) => destination.slug === "bangkok"));
});

test("guest analysis retains arrival context but does not save a private trip", async () => {
  const plan = createTravelPlan({
    destination: "Yangon",
    startDate: "2026-12-01",
    endDate: "2026-12-04",
    budget: 30000,
    currency: "THB",
    travelers: 1,
    tripPurpose: "leisure",
    pace: "balanced",
    travelerDemographic: "adults",
    preferredClimate: "warm",
    interests: ["culture", "food"],
    arrivalAt: "2026-12-01T09:00:00+06:30",
    hotelName: "Downtown Hotel",
  });

  assert.equal(plan.input.arrivalAt, "2026-12-01T09:00:00+06:30");
  assert.equal(plan.input.hotelName, "Downtown Hotel");
  assert.deepEqual(await saveTrip(plan, null), {
    saved: false,
    reason: "authentication_required",
  });
});
