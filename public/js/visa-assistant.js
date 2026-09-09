const visaTripId = new URLSearchParams(location.search).get("trip");
const visaMessage = document.querySelector("#visa-status-message");
let activeVisa = null;

const visaPresentation = {
  visa_free: { icon: "check-circle", title: "Visa-free access may apply", className: "is-free" },
  evisa_or_arrival: { icon: "globe-2", title: "E-Visa or visa on arrival may be required", className: "is-evisa" },
  consular_required: { icon: "triangle-alert", title: "Advance visa confirmation required", className: "is-consular" },
};

function formatCheckedDate(value) {
  if (!value) return "Verification date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Verification date unavailable";
  return `PackSwift reference last checked ${new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(date)}.`;
}

function renderVisa(visa) {
  activeVisa = visa;
  document.querySelector("#visa-origin").textContent = `${visa.origin.name}${visa.origin.code ? ` (${visa.origin.code})` : ""}`;
  document.querySelector("#visa-destination").textContent = `${visa.destination.name}${visa.destination.code ? ` (${visa.destination.code})` : ""}`;
  const presentation = visaPresentation[visa.status] || visaPresentation.consular_required;
  const badge = document.querySelector("#visa-status-badge");
  badge.className = `visa-status-badge ${presentation.className}`;
  badge.replaceChildren();
  const badgeIcon = document.createElement("i");
  badgeIcon.dataset.lucide = presentation.icon;
  const badgeText = document.createElement("span");
  badgeText.textContent = presentation.title;
  badge.append(badgeIcon, badgeText);
  document.querySelector("#visa-rule-title").textContent = visa.status === "visa_free" && visa.allowedDays
    ? `Visa-free access may apply for up to ${visa.allowedDays} days`
    : presentation.title;
  document.querySelector("#visa-rule-summary").textContent = visa.summary;
  document.querySelector("#visa-rule-note").textContent = visa.sourceNote;
  document.querySelector("#visa-checked-at").textContent = formatCheckedDate(visa.checkedAt);
  const portal = document.querySelector("#visa-portal");
  portal.hidden = !visa.officialPortalUrl;
  if (visa.officialPortalUrl) portal.href = visa.officialPortalUrl;
  document.querySelector("#visa-rule-card").hidden = false;
  window.lucide?.createIcons({ attrs: { "aria-hidden": "true" } });
}

async function initializeVisa() {
  if (!visaTripId) {
    visaMessage.className = "status-banner status-error";
    visaMessage.textContent = "Choose a saved trip first.";
    return;
  }
  const user = await window.PackSwift.authReady;
  if (!user) {
    location.assign(`/login?return=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }
  try {
    const { visa } = await window.PackSwift.api(`/api/visa/status?trip=${encodeURIComponent(visaTripId)}`);
    document.querySelector("#visa-back").href = `/assist-trip?trip=${encodeURIComponent(visaTripId)}`;
    renderVisa(visa);
    visaMessage.hidden = true;
  } catch (error) {
    visaMessage.className = "status-banner status-error";
    visaMessage.textContent = error.message;
  }
}

document.querySelector("#visa-ask-concierge").addEventListener("click", () => {
  const route = activeVisa ? `${activeVisa.origin.name} to ${activeVisa.destination.name}` : "this trip";
  document.dispatchEvent(new CustomEvent("packswift:concierge:ask", {
    detail: { message: `Explain the visa and entry preparation checklist for ${route}. Remind me to verify official rules.` },
  }));
});

initializeVisa();
