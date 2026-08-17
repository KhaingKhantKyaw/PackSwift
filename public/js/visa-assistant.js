const visaTripId = new URLSearchParams(location.search).get("trip");
const visaMessage = document.querySelector("#visa-status-message");
const insuranceDialog = document.querySelector("#insurance-dialog");
let selectedInsurance = null;
let visaTripCurrency = "USD";

const insurancePlans = [
  { tier: "basic", name: "Basic Protection", price: 39, icon: "shield", description: "Essential support for short, straightforward journeys.", coverage: { "Medical emergencies": "$25,000", "Flight delay": "$250", "Lost baggage": "$750" } },
  { tier: "comprehensive", name: "Comprehensive Travel", price: 79, icon: "shield-check", featured: true, description: "Balanced protection for international and multi-day travel.", coverage: { "Medical emergencies": "$100,000", "Flight delay": "$750", "Lost baggage": "$2,000" } },
  { tier: "premium", name: "Premium Care", price: 139, icon: "badge-check", description: "Higher limits and broader support for complex journeys.", coverage: { "Medical emergencies": "$250,000", "Flight delay": "$1,500", "Lost baggage": "$5,000" } },
];

const visaPresentation = {
  visa_free: { icon: "check-circle", title: "Visa Free Access", className: "is-free" },
  evisa_or_arrival: { icon: "globe-2", title: "E-Visa / Visa on Arrival Required", className: "is-evisa" },
  consular_required: { icon: "triangle-alert", title: "Consular Visa Required", className: "is-consular" },
};

function renderVisa(visa) {
  document.querySelector("#visa-origin").textContent = `${visa.origin.name}${visa.origin.code ? ` (${visa.origin.code})` : ""}`;
  document.querySelector("#visa-destination").textContent = `${visa.destination.name}${visa.destination.code ? ` (${visa.destination.code})` : ""}`;
  const presentation = visaPresentation[visa.status];
  const badge = document.querySelector("#visa-status-badge");
  badge.className = `visa-status-badge ${presentation.className}`;
  badge.innerHTML = `<i data-lucide="${presentation.icon}"></i><span>${presentation.title}</span>`;
  document.querySelector("#visa-rule-title").textContent = visa.status === "visa_free" && visa.allowedDays
    ? `Visa Free Access (up to ${visa.allowedDays} days)`
    : presentation.title;
  document.querySelector("#visa-rule-summary").textContent = visa.summary;
  document.querySelector("#visa-rule-note").textContent = visa.sourceNote;
  const portal = document.querySelector("#visa-portal");
  if (visa.officialPortalUrl) { portal.href = visa.officialPortalUrl; portal.hidden = false; }
  document.querySelector("#visa-rule-card").hidden = false;
}

function renderPlans() {
  const grid = document.querySelector("#insurance-grid");
  grid.replaceChildren(...insurancePlans.map((plan) => {
    const card = document.createElement("article");
    card.className = `insurance-card glass-card${plan.featured ? " is-featured" : ""}`;
    card.innerHTML = `${plan.featured ? '<span class="insurance-featured">Recommended</span>' : ""}<span class="insurance-icon"><i data-lucide="${plan.icon}"></i></span><h3>${plan.name}</h3><p>${plan.description}</p><strong class="insurance-price">$${plan.price}<small> / trip</small></strong><ul>${Object.entries(plan.coverage).map(([label, value]) => `<li><i data-lucide="check"></i><span>${label}</span><b>${value}</b></li>`).join("")}</ul><button class="button ${plan.featured ? "button-primary" : "button-secondary"}" type="button"><i data-lucide="plus"></i> Add Insurance</button>`;
    card.querySelector("button").addEventListener("click", () => openInsurance(plan));
    return card;
  }));
  window.lucide?.createIcons({ attrs: { "aria-hidden": "true" } });
}

function openInsurance(plan) {
  selectedInsurance = plan;
  document.querySelector("#insurance-dialog-title").textContent = plan.name;
  document.querySelector("#insurance-order-summary").innerHTML = `<span><i data-lucide="shield-check"></i>${plan.name}</span><strong>$${plan.price} USD</strong>`;
  insuranceDialog.showModal();
  window.lucide?.createIcons({ attrs: { "aria-hidden": "true" } });
}

async function initializeVisa() {
  if (!visaTripId) { visaMessage.className = "status-banner status-error"; visaMessage.textContent = "Choose a saved trip first."; return; }
  const user = await window.PackSwift.authReady;
  if (!user) return location.assign(`/login?return=${encodeURIComponent(location.pathname + location.search)}`);
  try {
    const { visa } = await window.PackSwift.api(`/api/visa/status?trip=${encodeURIComponent(visaTripId)}`);
    visaTripCurrency = visa.tripCurrency || "USD";
    document.querySelector("#visa-back").href = `/assist-trip?trip=${encodeURIComponent(visaTripId)}`;
    renderVisa(visa); renderPlans(); visaMessage.hidden = true;
  } catch (error) { visaMessage.className = "status-banner status-error"; visaMessage.textContent = error.message; }
}

document.querySelector("[data-close-insurance]").addEventListener("click", () => insuranceDialog.close());
document.querySelector("#insurance-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedInsurance) return;
  const submit = event.currentTarget.querySelector('button[type="submit"]'); submit.disabled = true;
  try {
    await window.PackSwift.api("/api/checkout/process", { method: "POST", body: JSON.stringify({
      tripId: visaTripId,
      checklistItemKey: "travel-insurance",
      orderType: "INSURANCE",
      totalAmount: selectedInsurance.price,
      currency: "USD",
      paymentMethod: new FormData(event.currentTarget).get("paymentMethod"),
      details: { planName: selectedInsurance.name, tier: selectedInsurance.tier, coverage: selectedInsurance.coverage, preferredTripCurrency: visaTripCurrency },
    }) });
    location.assign(`/assist-trip?trip=${encodeURIComponent(visaTripId)}&completed=travel-insurance`);
  } catch (error) { visaMessage.hidden = false; visaMessage.className = "status-banner status-error"; visaMessage.textContent = error.message; insuranceDialog.close(); submit.disabled = false; }
});

initializeVisa();
