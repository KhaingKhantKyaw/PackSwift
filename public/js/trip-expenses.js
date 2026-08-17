const expenseTripId = new URLSearchParams(location.search).get("trip");
const expensesStatus = document.querySelector("#expenses-status");
const expenseDialog = document.querySelector("#expense-dialog");
let expenseData = null;

const categoryMeta = {
  food: { label: "Food", icon: "utensils", color: "#00A8B5" },
  transport: { label: "Transport", icon: "car", color: "#3B82F6" },
  shopping: { label: "Shopping", icon: "shopping-bag", color: "#F59E0B" },
  activities: { label: "Activities", icon: "ticket", color: "#8B5CF6" },
  accommodation: { label: "Accommodation", icon: "hotel", color: "#14B8A6" },
  other: { label: "Other", icon: "circle-ellipsis", color: "#64748B" },
};

function money(value, currency) {
  try { return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${Number(value).toFixed(2)}`; }
}

function renderMetrics() {
  const { summary, trip } = expenseData;
  document.querySelector("#metric-total").textContent = money(summary.total, trip.currency);
  const variance = document.querySelector("#metric-variance");
  variance.textContent = `${summary.variance >= 0 ? "Under" : "Over"} ${money(Math.abs(summary.variance), trip.currency)}`;
  variance.classList.toggle("is-over", summary.variance < 0);
  document.querySelector("#metric-person").textContent = money(summary.perPerson, trip.currency);
}

function renderCategories() {
  const totals = new Map();
  expenseData.expenses.forEach((expense) => totals.set(expense.category, (totals.get(expense.category) || 0) + expense.amount));
  const max = Math.max(...totals.values(), 1);
  const chart = document.querySelector("#expense-category-chart");
  chart.replaceChildren(...Object.entries(categoryMeta).filter(([key]) => totals.has(key)).map(([key, meta]) => {
    const row = document.createElement("div"); row.className = "expense-category-row";
    row.innerHTML = `<span class="expense-category-icon" style="--category-color:${meta.color}"><i data-lucide="${meta.icon}"></i></span><div><span><b>${meta.label}</b><strong>${money(totals.get(key), expenseData.trip.currency)}</strong></span><div><i style="width:${(totals.get(key) / max) * 100}%;--category-color:${meta.color}"></i></div></div>`;
    return row;
  }));
  if (!totals.size) chart.innerHTML = '<p class="empty-copy">No expenses logged yet.</p>';
}

function renderTable() {
  const table = document.querySelector("#expense-table");
  table.replaceChildren(...expenseData.expenses.map((expense) => {
    const row = document.createElement("article"); row.className = "expense-row";
    const meta = categoryMeta[expense.category] || categoryMeta.other;
    row.innerHTML = `<span class="expense-category-icon" style="--category-color:${meta.color}"><i data-lucide="${meta.icon}"></i></span><div><strong></strong><small></small></div><span class="expense-payer"></span><b></b>`;
    row.querySelector("div strong").textContent = expense.title;
    row.querySelector("div small").textContent = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${expense.date}T00:00:00Z`));
    row.querySelector(".expense-payer").textContent = `${expense.paidBy} paid`;
    row.querySelector(":scope > b").textContent = money(expense.amount, expense.currency);
    return row;
  }));
  if (!expenseData.expenses.length) table.innerHTML = '<p class="empty-copy">Log the first shared cost to begin.</p>';
}

function renderSettlements() {
  const list = document.querySelector("#settlement-list");
  list.replaceChildren(...expenseData.summary.settlements.map((settlement) => {
    const card = document.createElement("article"); card.className = "settlement-card";
    const copy = document.createElement("div"); copy.innerHTML = '<span><i data-lucide="send"></i></span><p></p>';
    copy.querySelector("p").textContent = `${settlement.from} owes ${settlement.to} ${money(settlement.amount, settlement.currency)}`;
    const send = document.createElement("button"); send.type = "button"; send.className = "button button-secondary"; send.innerHTML = '<i data-lucide="send"></i> Send';
    send.addEventListener("click", async () => {
      const message = `${settlement.from} owes ${settlement.to} ${money(settlement.amount, settlement.currency)} for the PackSwift trip.`;
      if (navigator.share) await navigator.share({ title: "PackSwift expense settlement", text: message });
      else { await navigator.clipboard?.writeText(message); send.textContent = "Copied ✓"; }
    });
    card.append(copy, send); return card;
  }));
  if (!expenseData.summary.settlements.length) list.innerHTML = '<div class="settlement-ready"><i data-lucide="circle-check-big"></i><h3>Everyone is settled</h3><p>New settlement suggestions will appear as expenses are logged.</p></div>';
}

function renderExpenses() {
  document.querySelector("#expenses-title").textContent = `${expenseData.trip.destination} expenses`;
  document.querySelector("#expenses-back").href = `/assist-trip?trip=${encodeURIComponent(expenseTripId)}`;
  renderMetrics(); renderCategories(); renderTable(); renderSettlements();
  window.lucide?.createIcons({ attrs: { "aria-hidden": "true" } });
}

async function loadExpenses() {
  if (!expenseTripId) { expensesStatus.className = "status-banner status-error"; expensesStatus.textContent = "Choose a saved trip first."; return; }
  const user = await window.PackSwift.authReady;
  if (!user) return location.assign(`/login?return=${encodeURIComponent(location.pathname + location.search)}`);
  try { expenseData = await window.PackSwift.api(`/api/expenses?trip=${encodeURIComponent(expenseTripId)}`); expensesStatus.hidden = true; renderExpenses(); }
  catch (error) { expensesStatus.className = "status-banner status-error"; expensesStatus.textContent = error.message; }
}

document.querySelector("#open-expense-form").addEventListener("click", () => { document.querySelector('#expense-form [name="date"]').value = new Date().toISOString().slice(0, 10); expenseDialog.showModal(); });
document.querySelector("[data-close-expense]").addEventListener("click", () => expenseDialog.close());
document.querySelector("#expense-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const form = new FormData(event.currentTarget);
  const participants = String(form.get("participants") || "").split(",").map((name) => name.trim()).filter(Boolean);
  const payload = { tripId: expenseTripId, title: form.get("title"), paidBy: form.get("paidBy"), category: form.get("category"), amount: Number(form.get("amount")), currency: form.get("currency"), date: form.get("date"), notes: form.get("notes"), participants };
  try { expenseData = await window.PackSwift.api("/api/expenses/log", { method: "POST", body: JSON.stringify(payload) }); expenseDialog.close(); event.currentTarget.reset(); renderExpenses(); }
  catch (error) { expensesStatus.hidden = false; expensesStatus.className = "status-banner status-error"; expensesStatus.textContent = error.message; }
});

loadExpenses();
