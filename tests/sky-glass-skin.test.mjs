import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [styles, home, app] = await Promise.all([
  readFile(new URL("../public/css/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/js/app.js", import.meta.url), "utf8"),
]);

test("shared navigation uses the floating glass pill skin", () => {
  assert.match(styles, /--glass-border: rgba\(255, 255, 255, 0\.58\)/);
  assert.match(styles, /\.header-inner \{[\s\S]*border-radius: 999px;[\s\S]*backdrop-filter: blur\(20px\) saturate\(140%\)/);
  assert.match(styles, /\.site-header,[\s\S]*padding: 18px 16px 0/);
  assert.match(styles, /\.shorts-search-dock \{\s*top: 98px/);
  assert.match(app, /const mainNavigation/);
});

test("sky backdrop, compact modern hero, and teal actions are visual-only CSS", () => {
  assert.match(styles, /--sky-top: #8cb8ec/);
  assert.match(styles, /body:not\(\.shorts-page\)::before \{[\s\S]*radial-gradient\(ellipse/);
  assert.match(styles, /\.button-primary,[\s\S]*\.concierge-auth-primary \{[\s\S]*background: #00a8b5/);
  assert.match(styles, /body\[data-page="home"\] \.home-minimal-hero h1 \{[\s\S]*font-size: clamp\(2\.8rem/);
  assert.match(styles, /font-family: Inter, ui-sans-serif, system-ui/);
});

test("existing Home content and routes remain present", () => {
  assert.match(home, /Think of a trip/);
  assert.doesNotMatch(home, /travel-impact-card/);
  assert.doesNotMatch(home, /Recommended Famous Places to Explore All Around the World/);
  assert.match(home, /href="\/trip-planner"/);
  assert.doesNotMatch(app, /href="\/community-feed"/);
  assert.match(app, /href="\/travel-guide"/);
  assert.match(app, /href="\/#support"/);
  assert.match(app, /href="\/profile"/);
});

test("Home presents one concise message and a calm destination guide", () => {
  assert.match(home, /Your AI travel assistant/);
  assert.match(home, /Think of a trip/);
  assert.match(home, /No sales pressure/);
  assert.match(home, /Destination guide/);
  assert.match(home, /Find a place that fits/);
  assert.match(home, /Search places/);
  assert.match(home, />Plan my trip/);
  assert.doesNotMatch(home, /The Stressful Way|The PackSwift Way|comparison-card/);
  assert.match(styles, /\.home-destination-grid \{[\s\S]*grid-template-columns: repeat\(3/);
  assert.match(styles, /\.home-discovery \{[\s\S]*backdrop-filter: blur\(20px\)/);
});
