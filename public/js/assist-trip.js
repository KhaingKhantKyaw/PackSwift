const readyList = document.querySelector("#ready-list");
const readyStatus = document.querySelector("#ready-status");
const readyBanner = document.querySelector("#trip-ready-banner");
const manualAssistDialog = document.querySelector("#manual-assist-dialog");
const manualMarkReady = document.querySelector("#manual-mark-ready");
const tripId = new URLSearchParams(window.location.search).get("trip");
const readyCategoryTabs = document.querySelector("#ready-category-tabs");

let activeItems = [];
let activeManualItem = null;
let activeCategory = "all";

const categoryIcons = {
  Documents: "file-text",
  "Health & Medication": "heart-pulse",
  "Clothing & Gear": "shirt",
  "Special Care": "baby",
  "Electronics & Tech": "zap",
};

const assistForItLabel = "Ask Concierge";

function checklistReturnPath() {
  return `${window.location.pathname}${window.location.search}`;
}

function loginForChecklist() {
  return `/login?return=${encodeURIComponent(checklistReturnPath())}`;
}

function formatTripDates(start, end) {
  if (!start || !end) return "Flexible travel dates";
  const formatter = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(`${start}T00:00:00Z`))} – ` +
    formatter.format(new Date(`${end}T00:00:00Z`));
}

function updateProgress() {
  const completed = activeItems.filter((item) => item.completed).length;
  const total = activeItems.length;
  const percentage = total ? Math.round((completed / total) * 100) : 0;
  document.querySelector("#ready-completed").textContent = completed;
  document.querySelector("#ready-total").textContent = total;
  document.querySelector("#ready-percentage").textContent = `${percentage}%`;
  document.querySelector("#ready-progress-bar").style.width = `${percentage}%`;
  readyBanner.hidden = total === 0 || completed !== total;
  document.body.classList.toggle("trip-is-ready", !readyBanner.hidden);
}

function manualTips(item) {
  const tipsByKey = {
    passport: [
      "Check that the passport remains valid for the destination's required period.",
      "Confirm visa and entry requirements using an official government source.",
      "Keep a secure digital copy separate from the original.",
    ],
    medication: [
      "Pack enough prescribed medication for the full trip plus a small buffer.",
      "Keep medicine in labelled packaging and carry required prescriptions.",
      "Place essential medication in hand-carry luggage.",
    ],
  };
  return tipsByKey[item.key] || [
    "Review the trip details and destination requirements.",
    "Keep the item accessible during departure and arrival.",
    "Mark it prepared when it is ready.",
  ];
}

function openManualAssistant(item) {
  activeManualItem = item;
  document.querySelector("#manual-assist-title").textContent = item.name;
  document.querySelector("#manual-assist-copy").textContent = item.description;
  document.querySelector("#manual-assist-tips").replaceChildren(
    ...manualTips(item).map((tip) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = tip;
      return paragraph;
    }),
  );
  if (typeof manualAssistDialog.showModal === "function") {
    manualAssistDialog.showModal();
  }
}

async function setItemCompleted(item, completed) {
  const response = await window.PackSwift.api(
    "/api/checklist/update",
    {
      method: "PATCH",
      body: JSON.stringify({ tripId, itemId: item.id, isPrepared: completed }),
    },
  );
  item.completed = response.isPrepared;
  renderItems();
  readyStatus.hidden = false;
  readyStatus.className = "status-banner status-success";
  readyStatus.textContent = completed
    ? `${item.name} marked as prepared.`
    : `${item.name} moved back to your preparation list.`;
}

function createReadyItem(item) {
  const article = document.createElement("article");
  article.className = `ready-item${item.completed ? " is-complete" : ""}`;

  const checkLabel = document.createElement("label");
  checkLabel.className = "ready-check-control";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = item.completed;
  checkbox.setAttribute("aria-label", `Mark ${item.name} as prepared`);
  checkbox.addEventListener("change", async () => {
    checkbox.disabled = true;
    try {
      await setItemCompleted(item, checkbox.checked);
    } catch (error) {
      checkbox.checked = item.completed;
      checkbox.disabled = false;
      readyStatus.hidden = false;
      readyStatus.className = "status-banner status-error";
      readyStatus.textContent = error.message;
    }
  });
  const checkVisual = document.createElement("span");
  checkVisual.setAttribute("aria-hidden", "true");
  checkLabel.append(checkbox, checkVisual);

  const copy = document.createElement("div");
  copy.className = "ready-item-copy";
  const category = document.createElement("small");
  category.className = "ready-smart-tag";
  category.textContent = item.smartTag || item.category;
  const heading = document.createElement("h2");
  heading.textContent = item.name;
  const description = document.createElement("p");
  description.textContent = item.completed && item.confirmationReference
    ? `${item.description} Confirmed: ${item.confirmationReference}`
    : item.description;
  copy.append(category, heading, description);

  const preparedBadge = document.createElement("span");
  preparedBadge.className = "ready-prepared-badge";
  preparedBadge.innerHTML = '<i data-lucide="check-circle-2"></i><span>Prepared ✓</span>';
  preparedBadge.hidden = !item.completed;
  copy.append(preparedBadge);

  const assist = document.createElement("button");
  assist.className = "button button-secondary ready-assist-button";
  assist.type = "button";
  assist.innerHTML = item.completed
    ? '<i data-lucide="check-circle-2"></i><span>Prepared ✓</span>'
    : `<i data-lucide="sparkles"></i><span>${assistForItLabel}</span>`;
  assist.disabled = item.completed;
  assist.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("packswift:concierge:ask", {
      detail: {
        message: `Help me prepare ${item.name} for my active trip. Give me a concise checklist based on my destination, dates, weather, and travel group.`,
        fallback: () => openManualAssistant(item),
      },
    }));
  });

  article.append(checkLabel, copy, assist);
  return article;
}

function renderItems() {
  const categories = [...new Set(activeItems.map((item) => item.category))];
  readyCategoryTabs.replaceChildren();
  const tabOptions = ["all", ...categories];
  for (const category of tabOptions) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `ready-category-tab${activeCategory === category ? " is-active" : ""}`;
    tab.setAttribute("aria-pressed", String(activeCategory === category));
    tab.innerHTML = category === "all"
      ? '<i data-lucide="layout-list"></i><span>All</span>'
      : `<i data-lucide="${categoryIcons[category] || "folder"}"></i><span>${category}</span>`;
    tab.addEventListener("click", () => {
      activeCategory = category;
      renderItems();
    });
    readyCategoryTabs.append(tab);
  }

  const visibleCategories = activeCategory === "all" ? categories : [activeCategory];
  readyList.replaceChildren(...visibleCategories.map((category) => {
    const group = document.createElement("details");
    group.className = "ready-category-accordion glass-card";
    group.open = true;
    const summary = document.createElement("summary");
    const categoryItems = activeItems.filter((item) => item.category === category);
    const completed = categoryItems.filter((item) => item.completed).length;
    summary.innerHTML = `<span class="ready-category-icon"><i data-lucide="${categoryIcons[category] || "folder"}"></i></span><span><strong>${category}</strong><small>${completed} of ${categoryItems.length} prepared</small></span><i data-lucide="chevron-down"></i>`;
    const items = document.createElement("div");
    items.className = "ready-category-items";
    items.replaceChildren(...categoryItems.map(createReadyItem));
    group.append(summary, items);
    return group;
  }));
  updateProgress();
  window.lucide?.createIcons({ attrs: { "aria-hidden": "true" } });
}

async function initializeReadiness() {
  if (!tripId) {
    readyStatus.className = "status-banner status-error";
    readyStatus.textContent = "Choose a saved trip from My Trips first.";
    return;
  }
  const user = await window.PackSwift.authReady;
  if (!user) {
    window.location.assign(loginForChecklist());
    return;
  }
  try {
    const result = await window.PackSwift.api(
      `/api/trips/${encodeURIComponent(tripId)}/readiness`,
    );
    activeItems = result.items;
    const trip = result.trip;
    document.querySelector("#ready-destination").textContent =
      trip.destination.displayName || trip.destination.name;
    document.querySelector("#ready-trip-code").textContent =
      trip.destination.primaryAirportCode ||
      trip.destination.slug.slice(0, 3).toUpperCase();
    document.querySelector("#ready-dates").textContent = formatTripDates(
      trip.dates.start,
      trip.dates.end,
    );
    document.querySelector("#ready-summary").textContent =
      `Prepare the essentials for ${trip.destination.displayName || trip.destination.name}. ` +
      "Check items yourself or ask PackSwift Concierge for destination-aware guidance.";
    document.querySelector("#ready-itinerary-link").href = `/trip-itinerary?trip=${encodeURIComponent(tripId)}`;
    document.querySelector("#ready-visa-link").href = `/assist-visa?trip=${encodeURIComponent(tripId)}`;
    document.querySelector("#ready-packing-link").href = `/packing-list?trip=${encodeURIComponent(tripId)}`;
    readyStatus.hidden = true;
    renderItems();
    const completedKey = new URLSearchParams(window.location.search).get("completed");
    if (completedKey) {
      const completedItem = activeItems.find((item) => item.key === completedKey);
      if (completedItem) {
        readyStatus.hidden = false;
        readyStatus.className = "status-banner status-success";
        readyStatus.textContent = `${completedItem.name} confirmed and checked automatically ✓`;
      }
    }
  } catch (error) {
    if (error.status === 401) {
      window.location.assign(loginForChecklist());
      return;
    }
    readyStatus.className = "status-banner status-error";
    readyStatus.textContent = error.message;
  }
}

manualMarkReady.addEventListener("click", async () => {
  if (!activeManualItem) return;
  manualMarkReady.disabled = true;
  try {
    await setItemCompleted(activeManualItem, true);
    manualAssistDialog.close();
  } catch (error) {
    readyStatus.hidden = false;
    readyStatus.className = "status-banner status-error";
    readyStatus.textContent = error.message;
  } finally {
    manualMarkReady.disabled = false;
  }
});

readyBanner.addEventListener("click", async () => {
  readyBanner.disabled = true;
  readyStatus.hidden = false;
  readyStatus.className = "status-banner";
  readyStatus.textContent = "Saving your ready trip…";
  try {
    await window.PackSwift.api(
      `/api/trips/${encodeURIComponent(tripId)}/readiness/complete`,
      { method: "POST" },
    );
    window.location.assign("/profile#ready-to-travel");
  } catch (error) {
    readyBanner.disabled = false;
    readyStatus.className = "status-banner status-error";
    readyStatus.textContent = error.message;
  }
});

document.addEventListener("packswift:checklist-refresh", () => {
  initializeReadiness();
});

initializeReadiness();
