import test from "node:test";
import assert from "node:assert/strict";
import { calculateTripEstimate as estimate } from "../src/services/costEngine.js";
test("nightly engine crosses month and year boundaries without losing surcharges", () => {
  const result = estimate("Bangkok", "2027-01-31", "2027-02-02", 1, "budget");
  assert.equal(result.totalNights, 2);
  assert.equal(result.totalEstimate, 2940);
  assert.deepEqual(result.nightlyBreakdown.map(n => n.seasonalMultiplier), [1.25, 1.2]);
  assert.equal(estimate("Bangkok", "2026-12-31", "2027-01-02", 1, "budget").weekendDays, 1);
});
test("Friday/Saturday surge, traveller count and styles scale estimates", () => {
  const result = estimate("Bangkok", "2027-01-08", "2027-01-11", 2, "comfort");
  assert.equal(result.weekendDays, 2);
  assert.equal(result.totalEstimate, 19800);
  assert.equal(result.dailyAverage, 3300);
  assert.equal(result.demandLevel, "Peak Season");
});
test("off peak and fallback are explicit; invalid input is rejected", () => {
  assert.equal(estimate("Bangkok", "2027-07-05", "2027-07-08", 1, "budget").demandLevel, "Off-Peak (Budget Friendly)");
  assert.equal(estimate("Unknown", "2027-07-05", "2027-07-08", 1, "budget").isFallback, true);
  assert.throws(() => estimate("Paris", "2027-02-30", "2027-03-04", 1, "budget"));
  assert.throws(() => estimate("Paris", "2027-03-04", "2027-03-04", 1, "budget"));
});
