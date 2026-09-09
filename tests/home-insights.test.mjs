import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [home, discovery] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/js/travel-guide.js", import.meta.url), "utf8"),
]);

test("Travel Guide is the Home experience below the AI assistant hero", () => {
  assert.match(home, /travel-guide\.js/);
  assert.doesNotMatch(home, /home-discovery\.js/);
  assert.match(home, /id="discover"/);
  assert.match(home, /Find a place that fits/);
  assert.match(home, /id="guide-search"/);
  assert.match(home, /data-filter="all"/);
  assert.match(home, /data-filter="trending"/);
  assert.match(home, /data-filter="budget"/);
  assert.match(home, /data-filter="food-culture"/);
  assert.match(home, /data-filter="nature-beach"/);
  assert.match(home, /id="guide-destinations"/);
  assert.match(home, /id="guide-local-insights"/);
  assert.match(home, /id="guide-preview-drawer"/);
  assert.doesNotMatch(home, /travel-impact-card/);
  assert.doesNotMatch(home, /Travel well-being/);
  assert.doesNotMatch(home, /Bangkok in four thoughtful days/);
  assert.doesNotMatch(home, /featured-world-section/);
  assert.doesNotMatch(home, /Recommended Famous Places to Explore All Around the World/);
  assert.doesNotMatch(home, /Bangkok City/);
});

test("home omits the removed planning and inspiration grids", () => {
  assert.doesNotMatch(home, /plan-clearly-title/);
  assert.doesNotMatch(home, /Useful decisions, without the tab overload/);
  assert.doesNotMatch(home, /class="feature-grid"/);
  assert.doesNotMatch(home, /destination-title/);
  assert.doesNotMatch(home, /Three very different ways to get away/);
  assert.doesNotMatch(home, /class="destination-grid"/);
});

test("home keeps the main travel proposition and planner actions", () => {
  assert.match(home, /Think of a trip/);
  assert.match(home, /href="\/trip-planner"/);
  assert.match(home, /href="#discover"/);
});

test("Home destination cards use the worldwide catalog and retain one-click planning", () => {
  assert.match(discovery, /fetch\("\/data\/destinations\.json"\)/);
  assert.match(discovery, /trendingSlugs/);
  assert.match(discovery, /sessionStorage\.setItem\("pending_ai_trip"/);
  assert.match(discovery, /pending_ai_trip_mode", "guest_preview"/);
  assert.match(discovery, /window\.location\.assign\("\/trip-planner\?pending_ai_trip=1&preview=guide"\)/);
});
