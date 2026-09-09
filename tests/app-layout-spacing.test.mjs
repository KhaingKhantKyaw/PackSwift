import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const styles = await readFile(new URL("../public/css/styles.css", import.meta.url), "utf8");

test("interior pages share the compact PackSwift top rhythm", () => {
  assert.match(styles, /body:not\(\[data-page="home"\]\) \.page-shell \{\s*padding-top: 24px/);
  assert.match(styles, /\.page-heading \{\s*padding: 0 0 24px;\s*gap: 18px/);
  assert.match(styles, /\.about-hero \{\s*padding-top: 0;\s*padding-bottom: 36px/);
  assert.match(styles, /\.ready-shell,\s*\.assistant-shell \{\s*padding-top: 24px/);
});

test("interior pages use tighter mobile spacing", () => {
  const compactSection = styles.slice(styles.lastIndexOf("/* Compact above-the-fold rhythm"));
  assert.match(compactSection, /@media \(max-width: 760px\)[\s\S]*body:not\(\[data-page="home"\]\) \.page-shell,[\s\S]*padding-top: 16px/);
  assert.match(compactSection, /\.page-heading \{\s*padding: 0 0 20px;\s*gap: 12px/);
});
