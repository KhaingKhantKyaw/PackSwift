(() => {
  let signature = "", timer, controller, current, revision = 0;
  const amount = document.getElementById("budget");
  const badge = document.getElementById("dynamic-budget-badge");
  const warning = document.getElementById("dynamic-budget-warning");
  const money = (n, currency) => new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: 0 }).format(n);
  function warn() {
    const entered = Number(amount.value.replace(/,/g, ""));
    warning.textContent = current && entered < current.minimumViable ? `Below ground-cost estimate: ${money(current.minimumViable, current.currency)}` : "";
  }
  function show(result, input, updateAmount) {
    current = result;
    badge.textContent = `Suggested ${money(result.totalEstimate, result.currency)} · ${result.totalNights} nights`;
    const demand = document.getElementById("cost-demand-badge");
    demand.dataset.level = result.demandLevel === "Peak Season" ? "peak" : result.demandLevel === "Moderate" ? "moderate" : "low";
    demand.textContent = `${result.demandLevel} · ${money(result.dailyAverage,result.currency)}/person/night · Estimated`;
    document.getElementById("live-cost-estimate").textContent = money(result.totalEstimate, result.currency);
    if (updateAmount) {
      setBudgetValue(result.recommended);
      updateBudgetMinimum();
      updateLiveTripPreview();
    }
    warn();
  }
  function refresh() {
    const data = new FormData(document.getElementById("trip-planner-form"));
    const goal = data.get("planningGoal");
    const input = { destination: String(data.get("destination") || ""), startDate: data.get("startDate"), endDate: data.get("endDate"), travellers: Number(data.get("adults") || 1) + Number(data.get("children") || 0), style: goal === "luxury" ? "luxury" : ["make-possible", "fixed-budget"].includes(goal) ? "budget" : "comfort" };
    const next = JSON.stringify(input);
    if (next === signature) { warn(); return; }
    signature = next;
    clearTimeout(timer); controller?.abort(); current = null;
    let local;
    try { local = PackSwiftCostEngine.calculateTripEstimate(input.destination, input.startDate, input.endDate, input.travellers, input.style); }
    catch (error) { badge.textContent = error.message; warning.textContent = ""; document.getElementById("cost-demand-badge").textContent = ""; document.getElementById("live-cost-estimate").textContent = "Choose valid dates"; return; }
    show(local, input, true);
    const savedRevision = revision;
    timer = setTimeout(async () => {
      controller = new AbortController();
      try {
        const response = await fetch("/api/cost-estimate", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify(input) });
        if (!response.ok) return;
        const result = await response.json();
        if (signature !== next || !Number.isFinite(result.recommended)) return;
        show(result, input, revision === savedRevision);
      } catch { /* Local estimate remains available when the API is offline. */ }
    }, 500);
  }
  amount.addEventListener("input", () => { revision++; warn(); });
  window.refreshDynamicBudget = refresh;
  refresh();
})();
