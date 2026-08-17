const itineraryParams = new URLSearchParams(window.location.search);
const itineraryTripId = itineraryParams.get("trip");
const itineraryAction = itineraryParams.get("action");
const itineraryStatus = document.querySelector("#itinerary-status");
const daySelector = document.querySelector("#day-selector");
const timelineRoot = document.querySelector("#itinerary-timeline");
const activityDialog = document.querySelector("#activity-dialog");
let itineraryData = null;
let activeDay = 1;

const periodMeta = {
  morning: { label: "Morning", icon: "sun", range: "08:00 AM – 12:00 PM" },
  afternoon: { label: "Afternoon", icon: "compass", range: "12:00 PM – 05:00 PM" },
  evening: { label: "Evening", icon: "utensils", range: "05:00 PM – 09:00 PM" },
  nightlife: { label: "Nightlife", icon: "moon", range: "09:00 PM onwards" },
};

function formatMoney(amount, currency) {
  try { return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount); }
  catch { return `${currency} ${Number(amount).toFixed(0)}`; }
}

function loginReturn() {
  return `/login?return=${encodeURIComponent(location.pathname + location.search)}`;
}

function renderDaySelector() {
  daySelector.replaceChildren(...itineraryData.days.map((day) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `day-pill${day.day === activeDay ? " is-active" : ""}`;
    button.textContent = `Day ${day.day}`;
    button.addEventListener("click", () => { activeDay = day.day; renderDaySelector(); renderTimeline(); });
    return button;
  }));
}

function activityCard(activity) {
  const card = document.createElement("article");
  card.className = "timeline-activity-card glass-card";
  const image = document.createElement("img");
  image.src = activity.thumbnailUrl || "/images/packswift1.jpg";
  image.alt = `${activity.placeName} travel preview`;
  const content = document.createElement("div");
  content.className = "timeline-activity-copy";
  const top = document.createElement("div");
  top.className = "timeline-activity-top";
  const category = document.createElement("span"); category.className = "cyan-badge"; category.textContent = activity.category;
  const time = document.createElement("span"); time.className = "timeline-time"; time.textContent = activity.startTime || "Flexible";
  top.append(category, time);
  const title = document.createElement("h3"); title.textContent = activity.placeName;
  const description = document.createElement("p"); description.textContent = activity.description || "A tailored stop in your PackSwift itinerary.";
  const meta = document.createElement("div"); meta.className = "timeline-card-meta";
  meta.innerHTML = `<span><i data-lucide="clock-3"></i>${activity.durationMinutes} mins</span><span><i data-lucide="wallet-cards"></i>${formatMoney(activity.estimatedCost, activity.currency)}</span>`;
  content.append(top, title, description, meta);
  card.append(image, content);
  return card;
}

function transitConnector(transit) {
  const element = document.createElement("div");
  element.className = "transit-connector";
  element.innerHTML = `<span></span><div><i data-lucide="${String(transit.mode).toLowerCase() === "walk" ? "footprints" : "car"}"></i><b>${transit.minutes} mins</b><small>${transit.distanceKm ? `(${transit.distanceKm} km)` : transit.mode}</small></div><span></span>`;
  return element;
}

function renderTimeline() {
  const day = itineraryData.days.find((item) => item.day === activeDay);
  timelineRoot.replaceChildren();
  if (!day?.activities.length) {
    timelineRoot.innerHTML = '<div class="empty-state glass-card"><h2>No activities yet</h2><p>Add the first activity for this day.</p></div>';
    return;
  }
  for (const period of Object.keys(periodMeta)) {
    const activities = day.activities.filter((activity) => activity.period === period);
    if (!activities.length) continue;
    const section = document.createElement("section"); section.className = "timeline-period";
    const meta = periodMeta[period];
    const heading = document.createElement("header");
    heading.innerHTML = `<span><i data-lucide="${meta.icon}"></i></span><div><h2>${meta.label}</h2><p>${meta.range}</p></div>`;
    const stack = document.createElement("div"); stack.className = "timeline-stack";
    activities.forEach((activity, index) => {
      if (index > 0 && activity.transit) stack.append(transitConnector(activity.transit));
      stack.append(activityCard(activity));
    });
    section.append(heading, stack); timelineRoot.append(section);
  }
  window.lucide?.createIcons({ attrs: { "aria-hidden": "true" } });
}

async function initializeItinerary() {
  if (!itineraryTripId) { itineraryStatus.className = "status-banner status-error"; itineraryStatus.textContent = "Choose a saved trip first."; return; }
  const user = await window.PackSwift.authReady;
  if (!user) return location.assign(loginReturn());
  try {
    itineraryData = await window.PackSwift.api(`/api/itinerary/${encodeURIComponent(itineraryTripId)}`);
    document.querySelector("#itinerary-title").textContent = `${itineraryData.trip.destination.displayName} day-by-day`;
    document.querySelector("#itinerary-summary").textContent = `${itineraryData.days.length} connected days with realistic timing, costs, and transit guidance.`;
    document.querySelector("#itinerary-back").href = `/assist-trip?trip=${encodeURIComponent(itineraryTripId)}`;
    document.querySelector("#activity-day").replaceChildren(...itineraryData.days.map((day) => new Option(`Day ${day.day}`, day.day)));
    activeDay = itineraryData.days[0]?.day || 1;
    itineraryStatus.hidden = true; renderDaySelector(); renderTimeline();
    if (itineraryAction === "add") {
      document.querySelector("#activity-day").value = String(activeDay);
      activityDialog.showModal();
    }
  } catch (error) { if (error.status === 401) return location.assign(loginReturn()); itineraryStatus.className = "status-banner status-error"; itineraryStatus.textContent = error.message; }
}

document.querySelector("#add-activity-button").addEventListener("click", () => { document.querySelector("#activity-day").value = activeDay; activityDialog.showModal(); });
document.querySelector("[data-close-dialog]").addEventListener("click", () => activityDialog.close());
document.querySelector("#export-itinerary").addEventListener("click", () => window.print());
document.querySelector("#activity-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = Object.fromEntries(form);
  payload.day = Number(payload.day); payload.durationMinutes = Number(payload.durationMinutes); payload.estimatedCost = Number(payload.estimatedCost);
  payload.currency = itineraryData.trip.budget.currency;
  if (payload.transitMinutes) payload.transitMinutes = Number(payload.transitMinutes); else delete payload.transitMinutes;
  if (payload.transitDistanceKm) payload.transitDistanceKm = Number(payload.transitDistanceKm); else delete payload.transitDistanceKm;
  try {
    const result = await window.PackSwift.api(`/api/itinerary/${encodeURIComponent(itineraryTripId)}/activities`, { method: "POST", body: JSON.stringify(payload) });
    itineraryData.days = result.days; activeDay = payload.day; activityDialog.close(); renderDaySelector(); renderTimeline();
  } catch (error) { itineraryStatus.hidden = false; itineraryStatus.className = "status-banner status-error"; itineraryStatus.textContent = error.message; }
});

initializeItinerary();
