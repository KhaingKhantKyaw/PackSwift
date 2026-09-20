/* Editable planning assumptions, not verified current market minimums. */
globalThis.PackSwiftBudgetBaseline = (() => {
  const costs = { THB: 1200, JPY: 9000, EUR: 90, SGD: 100, MMK: 90000, CNY: 350, USD: 65 };
  function calculate(input, dailyOverride) {
    const parse = value => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) throw new RangeError("Choose valid travel dates.");
      const time = Date.parse(`${value}T00:00:00Z`);
      if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new RangeError("Choose valid travel dates.");
      return time;
    };
    const start = parse(input.startDate), end = parse(input.endDate);
    const days = (end - start) / 86400000;
    if (days < 1 || days > 90) throw new RangeError("Choose an end date 1–90 days after the start date.");
    const travellers = Number(input.travellers);
    if (!Number.isInteger(travellers) || travellers < 1 || travellers > 20) throw new RangeError("Choose 1–20 travellers.");
    const currency = globalThis.PackSwiftCurrency.resolve(input.destination).code;
    const daily = Number.isFinite(dailyOverride) && dailyOverride > 0 ? dailyOverride : costs[currency];
    const multiplier = { budget: 1, comfort: 1.8, luxury: 3.5 }[input.style];
    if (!multiplier) throw new RangeError("Choose Budget, Comfort, or Luxury.");
    let weekendDays = 0;
    for (let i = 0; i < days; i++) if ([5, 6, 0].includes(new Date(start + i * 86400000).getUTCDay())) weekendDays++;
    // Apply the requested 15% only to Fri–Sun daily estimates, not every day.
    const weightedDays = days + weekendDays * .15;
    return { currency, days, travellers, weekendDays, dailyCostPerPerson: daily * multiplier,
      weekendMultiplier: weightedDays / days, recommended: Math.ceil(weightedDays * daily * multiplier * travellers),
      minimumViable: Math.ceil(weightedDays * daily * travellers), source: "built-in planning estimate" };
  }
  return { calculate, costs };
})();
