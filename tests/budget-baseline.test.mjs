import test from "node:test";
import assert from "node:assert/strict";
import { estimateBaseline } from "../src/routes/budget-baseline.js";
const input = { destination: "Bangkok", startDate: "2027-01-04", endDate: "2027-01-08", travellers: 1, style: "budget" };
test("baseline uses exclusive end date, local currency and party/style scaling", async () => {
  const base = await estimateBaseline(input, { apiKey: "" });
  assert.equal(base.days, 4); assert.equal(base.recommended, 4800); assert.equal(base.currency, "THB");
  assert.equal((await estimateBaseline({ ...input, travellers: 2, style: "comfort" }, { apiKey: "" })).recommended, 17280);
});
test("15 percent surge applies only on Friday to Sunday", async () => {
  const result = await estimateBaseline({ ...input, startDate: "2027-01-08", endDate: "2027-01-11" }, { apiKey: "" });
  assert.equal(result.weekendDays, 3); assert.equal(result.recommended, 4140);
});
test("provider failures preserve fallback and invalid dates are rejected", async () => {
  assert.equal((await estimateBaseline(input, { apiKey: "key", fetchImpl: async () => { throw Error(); } })).providerUnavailable, true);
  await assert.rejects(estimateBaseline({ ...input, endDate: input.startDate }, { apiKey: "" }));
  await assert.rejects(estimateBaseline({ ...input, startDate: "2027-02-30" }, { apiKey: "" }));
});
