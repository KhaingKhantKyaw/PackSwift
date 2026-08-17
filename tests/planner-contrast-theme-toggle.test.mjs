import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const styles = await readFile(new URL("../public/css/styles.css", import.meta.url), "utf8");
const app = await readFile(new URL("../public/js/app.js", import.meta.url), "utf8");

test("header matches the shared PackSwift content width", () => {
  assert.match(styles, /\.header-inner \{[\s\S]*?width: min\(100%, var\(--max-width\)\)/);
  assert.doesNotMatch(styles, /width: min\(100%, 1040px\)/);
  assert.doesNotMatch(styles, /width: min\(100%, 760px\)/);
});

test("header provides an accessible persistent light and dark toggle", () => {
  assert.match(app, /data-theme-toggle/);
  assert.match(app, /syncHeaderThemeToggles/);
  assert.match(app, /applyThemePreference\(nextTheme, true\)/);
  assert.match(styles, /\.theme-toggle \{[\s\S]*?border-radius: 999px;[\s\S]*?background: #f6c95f/);
});

test("Trip Planner light mode uses high-contrast preview colors", () => {
  assert.match(styles, /body\[data-page="planner"\] \.result-panel \{[\s\S]*?color: #0d1b2a;[\s\S]*?background: rgba\(255, 255, 255, 0\.94\)/);
  assert.match(styles, /body\[data-page="planner"\] \.planner-live-details dd \{\s*color: #0d1b2a/);
  assert.match(styles, /body\[data-page="planner"\] \.planner-live-notices span,[\s\S]*?color: #475569/);
});

test("Trip Planner buttons and icon labels share compact spacing", () => {
  assert.match(styles, /body\[data-page="planner"\] \.button \{[\s\S]*?min-height: 44px;[\s\S]*?padding: 0 20px;[\s\S]*?gap: 8px/);
  assert.match(styles, /body\[data-page="planner"\] \.featured-preset,[\s\S]*?gap: 12px/);
});
