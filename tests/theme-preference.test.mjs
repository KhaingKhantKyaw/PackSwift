import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [profile, app, profileClient, styles] = await Promise.all([
  readFile(new URL("../public/profile.html", import.meta.url), "utf8"),
  readFile(new URL("../public/js/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/js/profile.js", import.meta.url), "utf8"),
  readFile(new URL("../public/css/styles.css", import.meta.url), "utf8"),
]);

test("Profile provides System, Light, and Dark appearance controls", () => {
  assert.match(profile, /id="appearance-settings"/);
  assert.match(profile, /data-theme-option="system"/);
  assert.match(profile, /data-theme-option="light"/);
  assert.match(profile, /data-theme-option="dark"/);
  assert.match(profile, /id="theme-feedback"/);
});

test("theme preference persists and follows live system changes", () => {
  assert.match(app, /packswift-theme-preference/);
  assert.match(app, /matchMedia\("\(prefers-color-scheme: dark\)"\)/);
  assert.match(app, /localStorage\.setItem\(themeStorageKey, themePreference\)/);
  assert.match(app, /systemThemeQuery\.addEventListener\("change", handleSystemThemeChange\)/);
  assert.match(app, /setThemePreference\(preference\)/);
  assert.match(profileClient, /window\.PackSwift\.setThemePreference/);
  assert.match(profileClient, /aria-pressed/);
});

test("dark appearance uses PackSwift navy tokens across the app", () => {
  assert.match(styles, /html\[data-theme="dark"\] \{[\s\S]*--bg-app-gradient: linear-gradient\(180deg, #0d1b2a/);
  assert.match(styles, /--color-card: #142537/);
  assert.match(styles, /html\[data-theme="dark"\] \.site-header/);
  assert.match(styles, /html\[data-theme="dark"\] \.mobile-nav/);
  assert.match(styles, /\.theme-choice\[aria-pressed="true"\]/);
});
