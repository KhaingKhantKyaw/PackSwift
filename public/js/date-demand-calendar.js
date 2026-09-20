/* Demo demand model: no live prices or holiday/crowd claims. */
(() => {
  const el = id => document.getElementById(id);
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const parse = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? new Date(`${value}T12:00:00`) : null;
  const today = () => parse(iso(new Date()));
  let month = parse(el("start-date").value) || today();
  month = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  let choosingEnd = false;
  function context() {
    const local = PackSwiftCurrency.resolve(el("destination-search")?.value || document.querySelector('[name="destination"]')?.value);
    const base = { THB: 1500, EUR: 100, JPY: 12000, SGD: 120, MMK: 100000, CNY: 450, USD: 80 }[local.code];
    return { ...local, base };
  }
  function estimate(date) {
    const day = date.getDay();
    const tier = [0, 6].includes(day) ? "peak" : [1, 5].includes(day) ? "standard" : "low";
    return { tier, amount: Math.round(context().base * ({ low: .8, standard: 1, peak: 1.35 }[tier])) };
  }
  const money = value => new Intl.NumberFormat("en", { style: "currency", currency: context().code, currencyDisplay: "code", maximumFractionDigits: 0 }).format(value);
  function commit(start, end) {
    setPlannerDate("start", iso(start)); setPlannerDate("end", iso(end));
    handleLivePlannerEdit(); updateBudgetMinimum();
  }
  function render() {
    const start = parse(el("start-date").value), end = parse(el("end-date").value);
    el("demand-month").textContent = month.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    el("demand-prev").disabled = month.getFullYear() === today().getFullYear() && month.getMonth() === today().getMonth();
    const grid = el("demand-days"); grid.replaceChildren();
    for (let i = 0; i < (month.getDay() + 6) % 7; i++) grid.append(document.createElement("span"));
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let number = 1; number <= count; number++) {
      const date = new Date(month.getFullYear(), month.getMonth(), number, 12), data = estimate(date);
      const button = document.createElement("button"); button.type = "button"; button.className = `demand-day demand-${data.tier}`;
      const selected = start && end && date >= start && date <= end;
      button.setAttribute("aria-pressed", String(Boolean(selected))); button.disabled = date < today();
      button.setAttribute("aria-label", `${date.toLocaleDateString("en-GB")}, ${data.tier} estimated demand, ${money(data.amount)} per traveller`);
      const label = document.createElement("span"); label.textContent = number;
      const price = document.createElement("small"); price.textContent = `${context().symbol}${new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(data.amount)}`;
      button.append(label, price);
      button.addEventListener("click", () => {
        if (!choosingEnd || !start || date < start) { choosingEnd = true; commit(date, date); }
        else { choosingEnd = false; commit(start, date); }
        el("demand-selection").textContent = choosingEnd ? "Now choose the end date." : "Date range selected.";
        render();
      });
      grid.append(button);
    }

  }
  for (const [id, delta] of [["demand-prev", -1], ["demand-next", 1]]) el(id).addEventListener("click", () => { month = new Date(month.getFullYear(), month.getMonth() + delta, 1, 12); render(); });
  window.refreshDemandCalendar = render;
  render();
})();
