import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const styles = await readFile(new URL("../public/css/styles.css", import.meta.url), "utf8");

test("shared navigation remains fixed above every page layer", () => {
  assert.match(
    styles,
    /\.site-header,\s*\.shorts-page \.shorts-site-header \{[\s\S]*?position: fixed;[\s\S]*?z-index: 100;[\s\S]*?top: 0;[\s\S]*?right: 0;[\s\S]*?left: 0;/
  );
});

test("navigation uses theme-aware translucent blur and fade", () => {
  assert.match(styles, /backdrop-filter: blur\(18px\) saturate\(135%\)/);
  assert.match(
    styles,
    /html\[data-theme="dark"\] \.site-header,[\s\S]*?background: linear-gradient\([\s\S]*?rgba\(13, 27, 42, 0\.9\)/
  );
});

test("desktop and mobile layouts reserve the fixed header height", () => {
  assert.match(styles, /body \{\s*padding-top: 98px;/);
  assert.match(styles, /@media \(max-width: 760px\) \{[\s\S]*?body \{\s*padding-top: 78px;/);
  assert.match(styles, /\.shorts-search-dock \{\s*top: 98px;/);
});
