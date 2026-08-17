import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const [html, client, styles] = await Promise.all([
  readFile(new URL("../public/trip-planner.html", import.meta.url), "utf8"),
  readFile(new URL("../public/js/trip-planner.js", import.meta.url), "utf8"),
  readFile(new URL("../public/css/styles.css", import.meta.url), "utf8"),
]);

test("popular destinations render as image-led attraction cards", async () => {
  assert.match(html, /id="popular-destination-grid"/);
  assert.match(client, /const POPULAR_DESTINATIONS = \[/);
  for (const [city, image] of [
    ["Bangkok", "destination-bangkok.jpg"],
    ["Tokyo", "destination-tokyo.jpg"],
    ["Singapore", "destination-singapore.jpg"],
    ["Bali", "destination-bali.jpg"],
    ["Paris", "destination-paris.jpg"],
  ]) {
    assert.match(client, new RegExp(`city: "${city}"[\\s\\S]*?${image}`));
    await access(new URL(`../public/images/${image}`, import.meta.url));
  }
  assert.match(client, /attraction: "Wat Arun & Grand Palace"/);
  assert.match(client, /attraction: "Eiffel Tower & Louvre Museum"/);
});

test("destination cards use safe contrast and responsive horizontal scrolling", () => {
  assert.match(styles, /\.featured-preset-grid \{[\s\S]*?overflow-x: auto;[\s\S]*?grid-auto-flow: column;[\s\S]*?scroll-snap-type: inline mandatory/);
  assert.match(styles, /\.featured-preset-shade \{[\s\S]*?linear-gradient/);
  assert.match(styles, /\.featured-preset-copy strong \{[\s\S]*?color: #fff/);
  assert.match(styles, /\.featured-preset-copy small,[\s\S]*?color: rgba\(255, 255, 255, 0\.9\)/);
});
