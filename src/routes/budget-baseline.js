import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import "../services/destination-currency.js";
import "../../public/js/budget-baseline.js";
export const budgetBaselineRouter = Router();
export async function estimateBaseline(input, { apiKey = process.env.TRAVEL_BUDGET_API_KEY, fetchImpl = fetch } = {}) {
  const baseline = globalThis.PackSwiftBudgetBaseline.calculate(input);
  if (!apiKey) return baseline;
  try {
    const url = new URL("https://www.numbeo.com/api/city_prices");
    url.searchParams.set("query", input.destination);
    url.searchParams.set("currency", baseline.currency);
    url.searchParams.set("use_estimated", "false");
    const response = await fetchImpl(url, { headers: { "X-Api-Key": apiKey }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Provider unavailable");
    const data = await response.json();
    if (data.currency !== baseline.currency) throw new Error("Unexpected currency");
    const meal = data.prices?.find(p => Number(p.item_id) === 1)?.average_price;
    if (!Number.isFinite(meal) || meal <= 0) throw new Error("Meal price unavailable");
    // Three inexpensive meals replace the dictionary's 30% meal allowance.
    // Accommodation, transport and incidentals stay estimated: Numbeo is not a hotel API.
    const daily = globalThis.PackSwiftBudgetBaseline.costs[baseline.currency] * .7 + meal * 3;
    return { ...globalThis.PackSwiftBudgetBaseline.calculate(input, daily), source: "Numbeo meal prices + estimated lodging/transport", fetchedAt: new Date().toISOString() };
  } catch { return { ...baseline, providerUnavailable: true }; }
}
budgetBaselineRouter.post("/budget-baseline", rateLimit({ windowMs: 60000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false }), async (req, res) => {
  try {
    if (typeof req.body.destination !== "string" || req.body.destination.length < 2 || req.body.destination.length > 150) throw new RangeError("Choose a destination.");
    res.set("Cache-Control", "no-store").json(await estimateBaseline(req.body));
  } catch (error) { res.status(422).json({ error: error.message }); }
});
