import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [html, script, planner, styles, destinations] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/js/travel-guide.js", import.meta.url), "utf8"),
  readFile(new URL("../public/js/trip-planner.js", import.meta.url), "utf8"),
  readFile(new URL("../public/css/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../public/data/destinations.json", import.meta.url), "utf8").then(JSON.parse),
]);

test("travel guide exposes all discovery filters, search, and sorting controls", () => {
  assert.match(html, /data-filter="all"[^>]*>All Places/);
  assert.match(html, /data-filter="trending"[^>]*>🔥 Trending Icons/);
  assert.match(html, /data-filter="budget"[^>]*>💰 Budget Savers \(&lt;\$350\)/);
  assert.match(html, /data-filter="food-culture"[^>]*>🍜 Food &amp; Culture/);
  assert.match(html, /data-filter="nature-beach"[^>]*>🏖️ Nature &amp; Beach/);
  assert.match(html, /id="guide-search"/);
  assert.match(html, /id="guide-sort"/);
  assert.match(script, /guideSearch\.addEventListener\("input", renderDestinations\)/);
  assert.match(script, /guideSort\.addEventListener\("change", renderDestinations\)/);
  assert.match(script, /Number\(destination\.dailyBudgetUsd\) \* 3 < 350/);
});

test("destination cards open the visual pocket guide", () => {
  assert.match(script, /"⚡ Plan in 1-Click"/);
  assert.match(script, /"Open Pocket Guide"/);
  assert.match(script, /card\.addEventListener\("mouseenter", \(\) => updateInsights\(destination\)\)/);
  assert.match(script, /card\.addEventListener\("focusin", \(\) => updateInsights\(destination\)\)/);
  assert.match(html, /id="guide-local-insights"/);
  assert.match(html, /id="guide-insight-transit"/);
  assert.match(html, /id="guide-insight-food"/);
  assert.match(html, /id="guide-insight-visa"/);
  assert.match(html, /id="guide-preview-drawer"/);
  assert.match(script, /function pocketGuideFor\(destination\)/);
  assert.match(script, /function packingTips\(destination\)/);
});

test("pocket guide contains route, timeline, stay, highlights, and distance tabs", () => {
  for (const tab of ["route", "timeline", "stay", "highlights", "map"]) {
    assert.match(html, new RegExp(`data-pocket-tab="${tab}"`));
    assert.match(html, new RegExp(`data-pocket-panel="${tab}"`));
  }
  assert.match(html, /⚡ Plan This Exact Itinerary in 1-Click/);
  assert.match(html, /Area Name/);
  assert.match(html, /Transport Access/);
  assert.match(script, /Temples in the morning · malls at midday/);
  assert.match(script, /10 min Walk/);
  assert.match(script, /Old City Center/);
  assert.match(script, /Night Safari", "50 min/);
  assert.match(script, /function switchPocketTab/);
  assert.match(styles, /\.pocket-timeline::before/);
  assert.match(styles, /\.pocket-highlight-grid \{[\s\S]*grid-template-columns: repeat\(4/);
  assert.match(styles, /\.pocket-radial-map/);
});

test("twelve visual highlights add directly to an active saved trip", () => {
  assert.match(script, /Array\.from\(\{ length: 12 \}/);
  assert.match(script, /function activeSavedTripId/);
  assert.match(script, /window\.PackSwift\.api\("\/api\/trip\/plan\/add"/);
  assert.match(script, /provider: "packswift_catalog"/);
  assert.match(script, /"\+ Add to trip"/);
});

test("one-click planning persists the selected destination and planner payload", () => {
  assert.match(script, /sessionStorage\.setItem\("packswift\.guide\.selected-destination"/);
  assert.match(script, /sessionStorage\.setItem\("pending_ai_trip"/);
  assert.match(script, /sessionStorage\.setItem\("pending_ai_trip_mode", "guest_preview"\)/);
  assert.match(script, /sessionStorage\.setItem\("packswift\.guide\.exact-itinerary"/);
  assert.match(script, /window\.location\.assign\("\/trip-planner\?pending_ai_trip=1&preview=guide"\)/);
  assert.match(script, /function recommendationFor\(destination,/);
  assert.match(script, /curated_route:/);
  assert.match(planner, /function applyCuratedGuideRoute/);
  assert.match(planner, /This preview uses the exact curated Pocket Guide route/);
});

test("a destination opened from Home selects its exact pocket guide", () => {
  assert.match(script, /new URLSearchParams\(window\.location\.search\)\.get\("destination"\)/);
  assert.match(script, /activeDestination = destinations\.find\(\(destination\) => destination\.slug === requestedSlug\)/);
  assert.match(script, /openPreview\(activeDestination, selectedCard/);
});

test("discovery hub has responsive cards, sidebar, and off-canvas styling", () => {
  assert.match(styles, /\.guide-filter-tabs/);
  assert.match(styles, /\.guide-discovery-card/);
  assert.match(styles, /\.guide-insights-sidebar \{\s*position: static;\s*min-width: 0;\s*align-self: start;/);
  assert.doesNotMatch(styles, /\.guide-insights-sidebar \{\s*position: sticky/);
  assert.match(styles, /\.guide-preview-drawer\[aria-hidden="false"\]/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.guide-discovery-grid/);
});

test("the guide uses the existing worldwide destination catalog", () => {
  assert.ok(destinations.length >= 30);
  for (const slug of ["bangkok", "tokyo", "singapore", "bali", "paris"]) {
    assert.ok(destinations.some((destination) => destination.slug === slug));
  }
});
