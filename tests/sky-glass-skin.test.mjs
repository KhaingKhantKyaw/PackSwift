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

test("sky, cloud, serif hero, and teal actions are visual-only CSS", () => {
  assert.match(styles, /--sky-top: #8cb8ec/);
  assert.match(styles, /body:not\(\.shorts-page\)::before \{[\s\S]*radial-gradient\(ellipse/);
  assert.match(styles, /\.button-primary,[\s\S]*\.concierge-auth-primary \{[\s\S]*background: #00a8b5/);
  assert.match(styles, /body\[data-page="home"\] \.hero h1 \{[\s\S]*font-size: clamp\(2\.8rem/);
  assert.match(styles, /font-family: Georgia, "Times New Roman", serif/);
});

test("existing Home content and routes remain present", () => {
  assert.match(home, /Got a sudden urge to escape/);
  assert.doesNotMatch(home, /travel-impact-card/);
  assert.doesNotMatch(home, /Recommended Famous Places to Explore All Around the World/);
  assert.match(home, /href="\/trip-planner"/);
  assert.doesNotMatch(app, /href="\/community-feed"/);
  assert.match(app, /href="\/travel-guide"/);
  assert.match(app, /href="\/#support"/);
  assert.match(app, /href="\/profile"/);
});

test("Home explains effortless planning with a clear two-way comparison", () => {
  assert.match(home, /Trip planning shouldn’t be hard/);
  assert.match(home, /No spreadsheets/);
  assert.match(home, /No twenty open tabs/);
  assert.match(home, /The Stressful Way/);
  assert.match(home, /The PackSwift Way/);
  assert.match(home, /1-Click AI plan/);
  assert.match(home, /Weather-smart packing/);
  assert.match(home, /All you need is a 10-second thought to travel/);
  assert.match(home, /⚡ Plan an Easy-Going Trip in 1-Click/);
  assert.match(styles, /\.ease-comparison-grid \{[\s\S]*grid-template-columns: repeat\(2/);
  assert.match(styles, /\.comparison-card-packswift \{[\s\S]*#00a8b5/);
  assert.match(styles, /\.easy-going-callout \{[\s\S]*backdrop-filter: blur\(18px\)/);
});
