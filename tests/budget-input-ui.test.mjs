import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [html, client, styles] = await Promise.all([
  readFile(new URL("../public/trip-planner.html", import.meta.url), "utf8"),
  readFile(new URL("../public/js/trip-planner.js", import.meta.url), "utf8"),
  readFile(new URL("../public/css/styles.css", import.meta.url), "utf8"),
]);

test("budget input is a unified formatted amount and full currency control", () => {
  assert.match(html, /id="budget-currency-symbol"[^>]*>\$</);
  assert.match(html, /id="budget"[\s\S]*?inputmode="numeric"[\s\S]*?value="1,500"/);
  for (const label of ["THB (฿)", "MMK (Ks)", "CNY (¥)", "USD ($)", "SGD (S$)"]) {
    assert.ok(html.includes(label), `${label} is missing`);
  }
  assert.match(styles, /\.budget-field \{[\s\S]*?grid-template-columns: auto minmax\(0, 1fr\) minmax\(132px, auto\)/);
  assert.match(styles, /\.budget-currency-select \{[\s\S]*?min-width: 132px/);
  assert.match(client, /function formatBudgetValue/);
  assert.match(client, /currencySymbols = \{ USD: "\$", THB: "฿", MMK: "Ks", CNY: "¥", SGD: "S\$" \}/);
});

test("minimum budget callout and warning state are driven by the route rule", () => {
  assert.match(html, /id="budget-info-title">Route Budget Estimate/);
  assert.match(html, /id="budget-info-route">Yangon → Bangkok/);
  assert.match(html, /id="budget-info-amount">\$380\.00/);
  assert.match(styles, /\.budget-info-callout \{[\s\S]*?rgba\(224, 247, 250, 0\.66\)/);
  assert.match(styles, /\.budget-info-callout\.is-warning \{[\s\S]*?border-color: #f0ad38;[\s\S]*?background: #fffbeb/);
  assert.match(client, /budgetMinimumHint\.classList\.toggle\("is-warning", isBelowMinimum\)/);
  assert.match(client, /budgetField\.classList\.toggle\("is-warning", isBelowMinimum\)/);
  assert.match(client, /Budget-saving plan/);
  assert.match(client, /is accepted\. PackSwift will prioritize free and lower-cost options/);
  assert.match(client, /budgetInput\.setCustomValidity\(""\)/);
  assert.match(client, /function routeDistanceKm/);
  assert.match(client, /minimumDailyBudgetUsd \* normalizedTravelers \* normalizedDays/);
  assert.match(client, /\["bangkok::yangon", 100\]/);
  assert.match(client, /const minimumDailyBudgetUsd = 40/);
  assert.match(client, /minimumUsd \/ currencyRatesToUsd\[currency\]/);
});
