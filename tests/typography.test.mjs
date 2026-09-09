import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const styles = await readFile(
  new URL("../public/css/styles.css", import.meta.url),
  "utf8",
);

test("global typography uses the compact travel-platform scale", () => {
  assert.match(styles, /--text-xs: 0\.75rem/);
  assert.match(styles, /--text-sm: 0\.875rem/);
  assert.match(styles, /--text-base: 1rem/);
  assert.match(styles, /--text-lg: 1\.125rem/);
  assert.match(styles, /--text-xl: 1\.25rem/);
  assert.match(styles, /--text-2xl: 1\.5rem/);
  assert.match(styles, /body \{\s*font-size: var\(--text-sm\)/);
  assert.match(styles, /body h1 \{[\s\S]*?font-size: var\(--text-2xl\) !important/);
  assert.match(styles, /body h2 \{[\s\S]*?font-size: var\(--text-lg\) !important/);
});

test("forms, captions, cards, and travel prices use proportional sizes", () => {
  assert.match(styles, /body \.field-control,[\s\S]*?font-size: var\(--text-sm\) !important/);
  assert.match(styles, /body small,[\s\S]*?font-size: var\(--text-xs\) !important/);
  assert.match(styles, /body h3,[\s\S]*?font-size: var\(--text-base\) !important/);
  assert.match(styles, /body button,[\s\S]*?font-size: var\(--text-sm\) !important/);
  assert.match(styles, /\.text-primary \{[\s\S]*?color: var\(--color-primary\) !important/);
});
