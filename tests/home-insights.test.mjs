import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const home = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("home omits the removed travel insight and featured destination panels", () => {
  assert.doesNotMatch(home, /home-insights\.js/);
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
  assert.match(home, /Got a sudden urge to escape/);
  assert.match(home, /The Stressful Way/);
  assert.match(home, /The PackSwift Way/);
  assert.match(home, /All you need is a 10-second thought to travel/);
  assert.match(home, /href="\/trip-planner"/);
});
