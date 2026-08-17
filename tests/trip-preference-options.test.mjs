import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createTravelPlan } from "../src/services/travel-planner.js";

const [html, client] = await Promise.all([
  readFile(new URL("../public/trip-planner.html", import.meta.url), "utf8"),
  readFile(new URL("../public/js/trip-planner.js", import.meta.url), "utf8"),
]);

test("Plan Trip removes climate and manual interest controls", () => {
  assert.doesNotMatch(html, /id="preferred-climate"|Preferred climate/i);
  assert.doesNotMatch(html, /What interests you\?|name="interests"|id="live-interests"/i);
  assert.match(client, /preferredClimate: "any"/);
  assert.match(client, /purposeInterests\[tripPurpose\]/);
});

test("Plan Trip presents the exact new purpose, pace, and group labels", () => {
  for (const label of [
    "Leisure &amp; Relaxation", "Cultural &amp; Historical", "Adventure &amp; Outdoor",
    "Food &amp; Culinary", "Business / Workation", "Special Events &amp; Celebrations",
    "Slow &amp; Relaxed 🌿", "Balanced &amp; Steady ⚖️", "Packed &amp; Fast ⚡",
    "Cultural Deep Dive 🎨", "Culinary &amp; Foodie 🍜", "Solo", "Couples",
    "Family", "Friends / Group", "Digital Nomad / Business Duo", "Senior Travelers",
  ]) {
    assert.match(html, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Plan Trip exposes three smart pace switches", () => {
  for (const setting of ["lateRiser", "middayRest", "clusterNearby"]) {
    assert.match(html, new RegExp(`name="${setting}"`));
    assert.match(client, new RegExp(`${setting}: formData\\.get\\("${setting}"\\) === "true"`));
  }
  assert.match(html, /Start after 10 AM/);
  assert.match(html, /2-hour afternoon gap/);
  assert.match(html, /Minimize transit time/);
});

test("all six new purposes generate recommendations without manual interests", () => {
  for (const tripPurpose of ["leisure", "cultural", "adventure", "food", "business", "events"]) {
    const plan = createTravelPlan({
      budget: 2200,
      currency: "USD",
      travelers: 2,
      startDate: "2027-02-10",
      endDate: "2027-02-16",
      destination: "Thailand",
      tripPurpose,
      pace: "balanced",
      travelerDemographic: "couples",
    });
    assert.ok(plan.input.interests.length > 0);
    assert.ok(plan.destination.score > 0);
  }
});
