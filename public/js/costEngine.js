/* Internal, editable benchmark assumptions — not live market quotes.
   Each entry includes lodging, meals, local transport and basic activities
   per traveller/night. Excludes flights, visas, insurance and purchases. */
globalThis.PackSwiftCostEngine = (() => {
  const months = values => Object.fromEntries(values.map((value, index) => [index + 1, value]));
  const destinations = {
    bangkok: { aliases: ["bangkok", "bkk", "thailand"], currency: "THB", baseDailyCost: { budget: 1200, comfort: 2400, luxury: 6500 }, seasonalMultipliers: months([1.25,1.2,1.1,1.1,1,.9,.85,.85,.9,1,1.15,1.25]), weekendSurcharge: 1.15 },
    paris: { aliases: ["paris", "france"], currency: "EUR", baseDailyCost: { budget: 90, comfort: 180, luxury: 450 }, seasonalMultipliers: months([.85,.9,1,1.1,1.15,1.25,1.25,1.15,1.15,1,.9,1.15]), weekendSurcharge: 1.15 },
    tokyo: { aliases: ["tokyo", "tyo", "japan"], currency: "JPY", baseDailyCost: { budget: 9000, comfort: 18000, luxury: 45000 }, seasonalMultipliers: months([.9,.9,1.25,1.3,1.15,.95,1.05,1.1,1,1.15,1.2,1.1]), weekendSurcharge: 1.15 },
    singapore: { aliases: ["singapore", "sin"], currency: "SGD", baseDailyCost: { budget: 100, comfort: 220, luxury: 550 }, seasonalMultipliers: months([1.05,1.1,1,1,1,1.1,1.1,1,1.2,1,.95,1.15]), weekendSurcharge: 1.15 },
    yangon: { aliases: ["yangon", "ygn", "rgn", "myanmar"], currency: "MMK", baseDailyCost: { budget: 90000, comfort: 180000, luxury: 450000 }, seasonalMultipliers: months([1.2,1.15,1.05,1,.9,.85,.85,.85,.9,1,1.15,1.2]), weekendSurcharge: 1.15 },
  };
  function calculateTripEstimate(destination, startDate, endDate, travellers, travelStyle) {
    const text = String(destination || "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
    if (!text) throw new RangeError("Choose a destination.");
    const config = Object.values(destinations).find(item => item.aliases.some(alias => ` ${text} `.includes(` ${alias} `)));
    const fallbackCurrency = globalThis.PackSwiftCurrency.resolve(destination).code;
    const fallbackBases = { USD: 65, THB: 1200, EUR: 90, JPY: 9000, SGD: 100, MMK: 90000, CNY: 350 };
    const base = fallbackBases[fallbackCurrency] || 65;
    const model = config || { currency: fallbackCurrency, baseDailyCost: { budget: base, comfort: base * 2, luxury: base * 5 }, seasonalMultipliers: months(Array(12).fill(1)), weekendSurcharge: 1.15 };
    const parse = value => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) throw new RangeError("Choose valid start and end dates.");
      const time = Date.parse(`${value}T00:00:00Z`);
      if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new RangeError("Choose valid calendar dates.");
      return time;
    };
    const start = parse(startDate), end = parse(endDate), totalNights = (end - start) / 86400000;
    if (totalNights < 1 || totalNights > 90) throw new RangeError("Choose a trip of 1–90 nights.");
    travellers = Number(travellers);
    if (!Number.isInteger(travellers) || travellers < 1 || travellers > 20) throw new RangeError("Choose 1–20 travellers.");
    if (!Object.hasOwn(model.baseDailyCost, travelStyle)) throw new RangeError("Choose Budget, Comfort, or Luxury.");
    let total = 0, minimum = 0, seasonalTotal = 0, factorTotal = 0, weekendDays = 0;
    const nightlyBreakdown = [];
    for (let i = 0; i < totalNights; i++) {
      const date = new Date(start + i * 86400000), season = model.seasonalMultipliers[date.getUTCMonth() + 1];
      const weekend = [5, 6].includes(date.getUTCDay());
      const factor = season * (weekend ? model.weekendSurcharge : 1);
      if (weekend) weekendDays++;
      const cost = model.baseDailyCost[travelStyle] * factor * travellers;
      total += cost; minimum += model.baseDailyCost.budget * factor * travellers;
      seasonalTotal += season; factorTotal += factor;
      nightlyBreakdown.push({ date: date.toISOString().slice(0,10), seasonalMultiplier: season, weekendMultiplier: weekend ? model.weekendSurcharge : 1, estimate: Math.round(cost * 100) / 100 });
    }
    const demandIndex = factorTotal / totalNights;
    const totalEstimate = Math.ceil(total);
    return { currency: model.currency, totalNights, totalEstimate, dailyAverage: totalEstimate / totalNights / travellers,
      demandLevel: demandIndex >= 1.1 ? "Peak Season" : demandIndex < .95 ? "Off-Peak (Budget Friendly)" : "Moderate",
      demandIndex, seasonalIndex: seasonalTotal / totalNights, percentageVsBase: Math.round((demandIndex - 1) * 100),
      nightlyBreakdown, source: config ? "internal destination benchmarks" : "generic fallback benchmarks", isFallback: !config,
      days: totalNights, travellers, weekendDays, dailyCostPerPerson: model.baseDailyCost[travelStyle], recommended: totalEstimate, minimumViable: Math.ceil(minimum) };
  }
  return { destinations, calculateTripEstimate };
})();
