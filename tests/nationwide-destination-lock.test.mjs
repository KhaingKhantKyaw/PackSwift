import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createTravelPlan } from "../src/services/travel-planner.js";

const [html, client, styles] = await Promise.all([
  readFile(new URL("../public/trip-planner.html", import.meta.url), "utf8"),
  readFile(new URL("../public/js/trip-planner.js", import.meta.url), "utf8"),
  readFile(new URL("../public/css/styles.css", import.meta.url), "utf8"),
]);

test("Nationwide locks the visible destination while preserving its submitted value", () => {
  assert.match(html, /id="domestic-destination" name="destination" type="hidden"/);
  assert.match(client, /function syncTripScopeState/);
  assert.match(client, /destinationSearch\.value = originSearch\.value/);
  assert.match(client, /destinationSearch\.disabled = true/);
  assert.match(client, /domesticDestinationInput\.disabled = false/);
  assert.match(client, /originSearch\.addEventListener\("input"/);
  assert.match(styles, /\.form-field\.is-disabled \.field-control \{[\s\S]*?background: #f1f5f9;[\s\S]*?cursor: not-allowed;[\s\S]*?opacity: 0\.5;[\s\S]*?pointer-events: none/);
});

test("a same-location Nationwide plan remains valid", () => {
  const plan = createTravelPlan({
    tripScope: "domestic",
    origin: "Bangkok",
    destination: "Bangkok",
    adults: 1,
    children: 0,
    budget: 17500,
    currency: "THB",
    startDate: "2027-01-10",
    endDate: "2027-01-13",
  });
  assert.equal(plan.input.route.scope, "domestic");
  assert.equal(plan.input.route.origin.name, "Bangkok");
  assert.equal(plan.input.route.destination.name, "Bangkok");
});
