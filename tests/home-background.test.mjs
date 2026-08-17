import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const [home, client, styles] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/js/home-background.js", import.meta.url), "utf8"),
  readFile(new URL("../public/css/styles.css", import.meta.url), "utf8"),
]);

test("Home includes all three optimized decorative travel backgrounds", async () => {
  for (const name of ["packswift1.jpg", "packswift2.jpg", "packswift3.jpg"]) {
    assert.match(home, new RegExp(`/images/${name}`));
    const image = await stat(new URL(`../public/images/${name}`, import.meta.url));
    assert.ok(image.size > 200_000);
    assert.ok(image.size < 700_000);
  }
  assert.match(home, /fetchpriority="high"/);
  assert.match(home, /class="home-background-overlay"/);
  assert.match(home, /src="\/js\/home-background\.js" defer/);
});

test("backgrounds loop every six seconds with a one-second cross-fade", () => {
  assert.match(client, /slideIntervalMilliseconds = 6000/);
  assert.match(client, /setInterval\(nextBackground, slideIntervalMilliseconds\)/);
  assert.match(client, /classList\.toggle\("is-active"/);
  assert.match(styles, /\.home-background-slide \{[\s\S]*transition: opacity 1000ms ease-in-out/);
  assert.match(styles, /\.home-background-slide\.is-active \{[\s\S]*opacity: 1/);
});

test("slideshow preserves readability, layout stability, and motion preferences", () => {
  assert.match(styles, /\.home-background \{[\s\S]*position: fixed;[\s\S]*inset: 0/);
  assert.match(styles, /\.home-background-slide img \{[\s\S]*object-fit: cover/);
  assert.match(styles, /\.home-background-overlay \{[\s\S]*rgba\(13, 27, 42, 0\.4\)/);
  assert.match(client, /prefers-reduced-motion: reduce/);
  assert.match(client, /visibilitychange/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\) \{\s*\.home-background-slide \{\s*transition: none/);
});
