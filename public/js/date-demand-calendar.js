/* Demo demand model: no live prices or holiday/crowd claims. */
(() => {
  const el = id => document.getElementById(id);
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const parse = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? new Date(`${value}T12:00:00`) : null;
  const add = (date, n) => { const next = new Date(date); next.setDate(next.getDate() + n); return next; };
  const today = () => parse(iso(new Date()));
  let month = parse(el("start-date").value) || today();
  month = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  let choosingEnd = false, proposed = null;
  const tooltip = document.createElement("div");
  tooltip.id = "demand-price-tooltip";
  tooltip.className = "demand-price-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  document.body.append(tooltip);
  let activeBar = null;
  function hideTooltip() {
    activeBar?.removeAttribute("aria-describedby");
    activeBar = null; tooltip.hidden = true;
  }
  function showTooltip(button, text) {
    hideTooltip(); activeBar = button;
    tooltip.textContent = text; tooltip.hidden = false;
    button.setAttribute("aria-describedby", tooltip.id);
    const rect = button.getBoundingClientRect();
    const width = tooltip.offsetWidth;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2));
    const above = rect.top > tooltip.offsetHeight + 16;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${above ? rect.top - tooltip.offsetHeight - 10 : rect.bottom + 10}px`;
    tooltip.style.setProperty("--arrow-x", `${Math.max(12, Math.min(width - 12, rect.left + rect.width / 2 - left))}px`);
    tooltip.dataset.position = above ? "above" : "below";
  }
  document.addEventListener("keydown", event => { if (event.key === "Escape") hideTooltip(); });
  document.addEventListener("pointerdown", event => { if (!event.target.closest(".demand-trend-column")) hideTooltip(); });
  window.addEventListener("resize", hideTooltip);
  document.addEventListener("scroll", hideTooltip, true);
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
    const anchor = start && start >= today() ? start : today();
    const first = add(anchor, -3) < today() ? today() : add(anchor, -3);
    const trend = el("demand-trend"); hideTooltip(); trend.replaceChildren();
    for (let i = 0; i < 10; i++) {
      const date = add(first, i), data = estimate(date);
      const column = document.createElement("button"); column.type = "button"; column.className = `demand-trend-column demand-${data.tier}`;
      const crowd = { low: "Off-peak", standard: "Moderate", peak: "Peak / weekend" }[data.tier];
      const description = `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", weekday: "short" })} • ${money(data.amount)} • ${crowd} (demo estimate)`;
      column.setAttribute("aria-label", description);
      const track = document.createElement("span"); track.className = "demand-bar-track";
      const bar = document.createElement("span"); bar.className = "demand-bar"; bar.style.height = `${data.amount / (context().base * 1.35) * 64}px`; bar.setAttribute("aria-hidden", "true");
      track.append(bar);
      const weekday = document.createElement("span"); weekday.className = "demand-bar-weekday"; weekday.textContent = date.toLocaleDateString("en-GB", { weekday: "short" });
      const number = document.createElement("span"); number.className = "demand-bar-date"; number.textContent = date.getDate();
      column.addEventListener("pointerenter", event => { if (event.pointerType !== "touch") showTooltip(column, description); });
      column.addEventListener("pointerleave", () => { if (document.activeElement !== column) hideTooltip(); });
      column.addEventListener("focus", () => showTooltip(column, description));
      column.addEventListener("blur", hideTooltip);
      column.addEventListener("click", () => showTooltip(column, description));
      column.append(track, weekday, number); trend.append(column);
    }
    proposed = null; el("demand-apply").hidden = true;
    if (!start || !end || end < start || start < today()) { el("demand-cheapest").textContent = "Select valid travel dates to compare nearby windows."; return; }
    const days = Math.min(30, Math.round((end - start) / 86400000) + 1);
    const travellers = Math.max(1, Number(el("adults").value) + Number(el("children").value));
    const total = from => Array.from({ length: days }, (_, i) => estimate(add(from, i)).amount).reduce((a, b) => a + b, 0) * travellers;
    let best = total(start), shift = 0;
    for (let delta = -3; delta <= 3; delta++) { const from = add(start, delta); if (from < today()) continue; const price = total(from); if (price < best) { best = price; shift = delta; } }
    if (shift) {
      proposed = [add(start, shift), add(end, shift)];
      el("demand-cheapest").textContent = `Cheapest nearby window (demo): shift ${Math.abs(shift)} day(s) ${shift < 0 ? "earlier" : "later"} for an estimated ${money(total(start) - best)} group saving over ${days} days. Flight costs excluded.`;
      el("demand-apply").hidden = false;
    } else el("demand-cheapest").textContent = "Your dates are already among the cheapest nearby windows in this demo model.";
  }
  for (const [id, delta] of [["demand-prev", -1], ["demand-next", 1]]) el(id).addEventListener("click", () => { month = new Date(month.getFullYear(), month.getMonth() + delta, 1, 12); render(); });
  el("demand-apply").addEventListener("click", () => { if (proposed) { const [start, end] = proposed; choosingEnd = false; month = new Date(start.getFullYear(), start.getMonth(), 1, 12); commit(start, end); render(); } });
  window.refreshDemandCalendar = render;
  render();
})();
