import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [html, client, styles] = await Promise.all([
  readFile(new URL("../public/trip-planner.html", import.meta.url), "utf8"),
  readFile(new URL("../public/js/trip-planner.js", import.meta.url), "utf8"),
  readFile(new URL("../public/css/styles.css", import.meta.url), "utf8"),
]);

test("Trip Planner displays both travel dates in strict DD/MM/YYYY format", () => {
  for (const type of ["start", "end"]) {
    assert.match(html, new RegExp(`id="${type}-date-display"[\\s\\S]*?placeholder="DD/MM/YYYY"`));
    assert.match(html, new RegExp(`id="${type}-date" name="${type}Date" type="hidden"`));
    assert.match(html, new RegExp(`id="${type}-date-picker" type="date"`));
  }
  assert.match(client, /function isoToDisplayDate/);
  assert.match(client, /`\$\{match\[3\]\}\/\$\{match\[2\]\}\/\$\{match\[1\]\}`/);
  assert.match(client, /function displayToIsoDate/);
  assert.match(client, /Enter a valid date in DD\/MM\/YYYY format\./);
});

test("formatted date controls keep ISO values for planning and native pickers", () => {
  assert.match(client, /isoInput\.value = isoValue/);
  assert.match(client, /setPlannerDate\("start", start\.toISOString\(\)\.slice\(0, 10\)\)/);
  assert.match(client, /setPlannerDate\("end", end\.toISOString\(\)\.slice\(0, 10\)\)/);
  assert.match(client, /pickerInput\.showPicker\(\)/);
  assert.match(styles, /\.formatted-date-control \{[\s\S]*?position: relative/);
  assert.match(styles, /\.date-display-input \{[\s\S]*?font-variant-numeric: tabular-nums/);
});
