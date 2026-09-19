import test from "node:test";
import assert from "node:assert/strict";
import { generateVisualItinerary, itineraryStyles } from "../src/services/visual-itinerary-service.js";
const input = { destination: "Paris", userType: "Family with Kids", budgetCategory: "mid", duration: 2 };
test("missing key produces explicitly marked samples without made-up place photos", async () => {
  const result = await generateVisualItinerary(input, { configured: false });
  assert.equal(result.source, "sample");
  assert.equal(result.days.length, 2);
  assert.ok(result.stops.every(s => s.isSample && !s.imageUrl));
});
test("provider failure falls back without leaking error details", async () => {
  const result = await generateVisualItinerary(input, { configured: true, search: async () => { throw Error("secret"); } });
  assert.equal(result.source, "sample");
  assert.ok(!result.message.includes("secret"));
});
test("all personas produce distinct searches and request live hours", async () => {
  const queries = new Set();
  for (const userType of Object.keys(itineraryStyles)) {
    await generateVisualItinerary({ ...input, userType }, { configured: true, search: async request => { queries.add(request.searchQuery); assert.equal(request.itineraryDetails, true); return { activities: [] }; } });
  }
  assert.equal(queries.size, 5);
});
test("real stops are deduplicated, clustered and not repeated to fill days", async () => {
  const place = (id, lat) => ({ providerPlaceId: id, title: id, rating: 4, types: ["park"], coordinates: { latitude: lat, longitude: 0 }, openingHours: "Monday: 9–5" });
  const result = await generateVisualItinerary(input, { configured: true, search: async () => ({ activities: [place("A", 0), place("B", 20), place("C", 1), place("A", 0)] }) });
  assert.deepEqual(result.stops.map(p => p.title), ["A", "C", "B"]);
  assert.equal(result.partial, true);
  assert.equal(result.days[1].activities.length, 0);
  assert.match(result.stops[0].hours, /Monday/);
});
