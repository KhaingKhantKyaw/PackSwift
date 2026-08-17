import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [styles, app, authForms, home, homeSupport, login, signup, planner, packing, guide, profile, authRoute] =
  await Promise.all([
    readFile(new URL("../public/css/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../public/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/js/auth-forms.js", import.meta.url), "utf8"),
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/js/home-support.js", import.meta.url), "utf8"),
    readFile(new URL("../public/login.html", import.meta.url), "utf8"),
    readFile(new URL("../public/signup.html", import.meta.url), "utf8"),
    readFile(new URL("../public/trip-planner.html", import.meta.url), "utf8"),
    readFile(new URL("../public/packing-list.html", import.meta.url), "utf8"),
    readFile(new URL("../public/travel-guide.html", import.meta.url), "utf8"),
    readFile(new URL("../public/profile.html", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/auth.js", import.meta.url), "utf8"),
  ]);

test("shared header keeps the brand left and navigation actions right", () => {
  assert.match(styles, /\.header-inner > \.brand \{[\s\S]*margin-right: auto/);
  assert.match(app, /const mainNavigation/);
  assert.match(app, /className = "account-navigation"/);
});

test("primary and secondary actions have a clear teal hierarchy", () => {
  assert.match(styles, /\.button-primary,[\s\S]*background: #00a8b5/);
  assert.match(styles, /\.button-secondary,[\s\S]*border: 1px solid #cbd5e1;[\s\S]*background: transparent/);
  assert.match(styles, /\.button-primary:hover,[\s\S]*background: #00838f/);
});

test("important forms use permanent labels and logical section headings", () => {
  assert.match(login, /Account details/);
  assert.match(signup, /Personal details/);
  assert.match(signup, /Security &amp; password/);
  assert.match(home, /for="home-feedback-message">Quick feedback/);
  assert.match(planner, /Destination &amp; route/);
  assert.match(planner, /Dates &amp; travellers/);
  assert.match(planner, /Trip preferences/);
  assert.match(packing, /Conditions &amp; traveller needs/);
  assert.match(guide, /class="persistent-field-label" for="guide-search"/);
  assert.doesNotMatch(guide, /class="visually-hidden" for="guide-search"/);
});

test("validation errors are constructive and rendered beside fields", () => {
  assert.match(app, /function showFieldError/);
  assert.match(app, /setAttribute\("aria-invalid", "true"\)/);
  assert.match(app, /className = "field-error"/);
  assert.match(app, /function showServerErrors/);
  assert.match(styles, /\.field-control\[aria-invalid="true"\]/);
  assert.match(signup, /Password must contain at least 10 characters/);
  assert.match(profile, /Password must contain at least 10 characters/);
  assert.match(authRoute, /status\(401\)\.json\(\{[\s\S]*success: false,[\s\S]*message: "Email or password is incorrect"/);
  assert.match(authRoute, /status\(503\)\.json\(\{[\s\S]*Start MySQL in XAMPP and try again/);
  assert.match(app, /payload\?\.message \|\| payload\?\.error/);
  assert.match(authForms, /mode === "login" && error\.status === 401/);
  assert.match(authForms, /authFeedback\.textContent = invalidLoginMessage/);
  assert.match(authForms, /control\.classList\.add\("is-auth-invalid"\)/);
  assert.match(authForms, /control\.addEventListener\("input", clearLoginError\)/);
  assert.match(styles, /\.auth-panel \.field-control\.is-auth-invalid/);
  assert.match(login, /id="login-auth-feedback"[\s\S]*aria-live="assertive"/);
});

test("microcopy is concise and placeholders remain examples", () => {
  assert.match(home, />Submit Feedback/);
  assert.match(homeSupport, /\/api\/contact\/feedback/);
  assert.match(planner, />Continue your trip with an account/);
  assert.match(packing, />Log in to save checklist/);
  assert.doesNotMatch(`${planner}${packing}`, /You need to login first/);
  for (const source of [home, login, signup, planner, packing, guide]) {
    const placeholders = [...source.matchAll(/placeholder="([^"]+)"/g)].map((match) => match[1]);
    assert.ok(placeholders.every((value) => value.startsWith("e.g.") || /^(DD\/MM\/YYYY|MM\/YY|\d{3,})$/.test(value)));
  }
});
