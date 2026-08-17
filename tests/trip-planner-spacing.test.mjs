import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [html, styles] = await Promise.all([
  readFile(new URL("../public/trip-planner.html", import.meta.url), "utf8"),
  readFile(new URL("../public/css/styles.css", import.meta.url), "utf8"),
]);

test("Trip Planner uses a compact page and title wrapper", () => {
  assert.match(html, /class="page-shell planner-page-shell"/);
  assert.match(html, /class="page-heading planner-page-heading"/);
  assert.match(styles, /\.planner-page-shell \{\s*padding-top: 24px/);
  assert.match(styles, /\.planner-page-heading \{\s*padding: 0 0 24px;\s*gap: 18px/);
  assert.match(styles, /\.planner-page-heading h1 \{\s*margin-top: 4px/);
});

test("Trip Planner becomes even tighter on mobile", () => {
  assert.match(styles, /@media \(max-width: 760px\) \{[\s\S]*?\.planner-page-shell \{\s*padding-top: 16px/);
  assert.match(styles, /@media \(max-width: 760px\) \{[\s\S]*?\.planner-page-heading \{\s*padding: 0 0 20px;\s*gap: 12px/);
});
