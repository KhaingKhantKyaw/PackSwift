const assistantType = document.body.dataset.assistantType;
const assistantParams = new URLSearchParams(window.location.search);
const assistantTripId = assistantParams.get("trip");
const assistantItemKey = assistantParams.get("item");
const assistantStatus = document.querySelector("#assistant-status");
const assistantOptions = document.querySelector("#assistant-options");

function safeReturnPath() {
  const requested = assistantParams.get("return");
  if (requested?.startsWith("/") && !requested.startsWith("//")) {
    return requested;
  }
  return `/assist-trip?trip=${encodeURIComponent(assistantTripId || "")}`;
}

function assistantLoginPath() {
  const current = `${window.location.pathname}${window.location.search}`;
  return `/login?return=${encodeURIComponent(current)}`;
}

function formatDates(start, end) {
  if (!start || !end) return "Flexible dates";
  return `${String(start).slice(0, 10)} → ${String(end).slice(0, 10)}`;
}

function confirmationReference(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

function optionCatalog(item, trip) {
  const destination = trip.destination.displayName || trip.destination.name;
  const currency = trip.budget.currency || "USD";
  if (assistantType === "flight") {
    return [
      { badge: "Best overall", title: `Direct route to ${destination}`, meta: "1 stop or fewer · Checked baggage included", price: `${currency} 420`, detail: "Balanced departure time with a flexible change window." },
      { badge: "Lowest sample fare", title: "Value economy route", meta: "1 stop · 30kg baggage", price: `${currency} 335`, detail: "Good budget fit with a longer connection." },
      { badge: "Most flexible", title: "Flexible traveller fare", meta: "Seat selection · Changeable", price: `${currency} 510`, detail: "Added flexibility for evolving trip plans." },
    ];
  }
  if (assistantType === "accommodation") {
    return [
      { badge: "Best location", title: `${destination} Central Stay`, meta: "8.9 rating · Breakfast available", price: `${currency} 82 / night`, detail: "Walkable base near popular attractions and transit." },
      { badge: "Best value", title: "Neighbourhood Comfort Hotel", meta: "8.5 rating · Free cancellation", price: `${currency} 61 / night`, detail: "Quiet, practical stay with strong transport access." },
      { badge: "Traveller favourite", title: "Riverside Boutique Rooms", meta: "9.1 rating · Airport transfer", price: `${currency} 104 / night`, detail: "Comfort-focused option with arrival assistance." },
    ];
  }
  return [
    { badge: "Recommended", title: `${item.name} · Travel Ready`, meta: "Highly rated sample product", price: `${currency} 39`, detail: "Practical sizing and features for the saved trip." },
    { badge: "Best value", title: `${item.name} · Essential`, meta: "Compact and lightweight", price: `${currency} 24`, detail: "Simple choice for budget-conscious preparation." },
    { badge: "Premium", title: `${item.name} · Durable Plus`, meta: "Extended durability", price: `${currency} 68`, detail: "Built for frequent travel and longer use." },
  ];
}

function renderOption(option, index, item) {
  const article = document.createElement("article");
  article.className = `assistant-option${index === 0 ? " is-recommended" : ""}`;
  const badge = document.createElement("span");
  badge.className = "assistant-option-badge";
  badge.textContent = option.badge;
  const copy = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = option.title;
  const meta = document.createElement("strong");
  meta.textContent = option.meta;
  const detail = document.createElement("p");
  detail.textContent = option.detail;
  copy.append(title, meta, detail);
  const action = document.createElement("div");
  action.className = "assistant-option-action";
  const price = document.createElement("strong");
  price.textContent = option.price;
  const button = document.createElement("button");
  button.className = "button button-primary";
  button.type = "button";
  button.textContent = assistantType === "shopping"
    ? "Confirm sample purchase"
    : assistantType === "flight"
      ? "Confirm sample flight"
      : "Confirm sample booking";
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Confirming…";
    assistantStatus.className = "status-banner";
    assistantStatus.textContent = "Saving this selection to your trip checklist…";
    try {
      const prefixes = { flight: "FLT", accommodation: "STAY", shopping: "ITEM" };
      await window.PackSwift.api(
        `/api/trips/${encodeURIComponent(assistantTripId)}/readiness/` +
          `${encodeURIComponent(item.key)}/confirm-assistance`,
        {
          method: "POST",
          body: JSON.stringify({
            assistantType,
            confirmationReference: confirmationReference(prefixes[assistantType]),
          }),
        },
      );
      const returnUrl = new URL(safeReturnPath(), window.location.origin);
      returnUrl.searchParams.set("completed", item.key);
      window.location.assign(`${returnUrl.pathname}${returnUrl.search}`);
    } catch (error) {
      assistantStatus.className = "status-banner status-error";
      assistantStatus.textContent = error.message;
      button.disabled = false;
      button.textContent = "Try confirmation again";
    }
  });
  action.append(price, button);
  article.append(badge, copy, action);
  return article;
}

async function initializeAssistant() {
  if (!assistantTripId || !assistantItemKey) {
    assistantStatus.className = "status-banner status-error";
    assistantStatus.textContent = "Return to the readiness checklist and choose an item first.";
    return;
  }
  const user = await window.PackSwift.authReady;
  if (!user) {
    window.location.assign(assistantLoginPath());
    return;
  }
  document.querySelector("#assistant-back").href = safeReturnPath();
  try {
    const result = await window.PackSwift.api(
      `/api/trips/${encodeURIComponent(assistantTripId)}/readiness`,
    );
    const item = result.items.find((candidate) => candidate.key === assistantItemKey);
    if (!item || item.assistantType !== assistantType) {
      throw new Error("This assistant does not match the selected checklist item.");
    }
    const trip = result.trip;
    const destination = trip.destination.displayName || trip.destination.name;
    document.querySelector("#assistant-destination").textContent = destination;
    document.querySelector("#assistant-dates").textContent = formatDates(
      trip.dates.start,
      trip.dates.end,
    );
    document.querySelector("#assistant-travellers").textContent =
      `${trip.travelers} ${trip.travelers === 1 ? "traveller" : "travellers"}`;
    document.querySelector("#assistant-origin").textContent = assistantType === "flight"
      ? "Your nearest airport"
      : assistantType === "accommodation"
        ? `${trip.tripPurpose} · ${trip.pace}`
        : item.name;
    assistantOptions.replaceChildren(
      ...optionCatalog(item, trip).map((option, index) =>
        renderOption(option, index, item),
      ),
    );
    assistantStatus.hidden = true;
  } catch (error) {
    if (error.status === 401) {
      window.location.assign(assistantLoginPath());
      return;
    }
    assistantStatus.hidden = false;
    assistantStatus.className = "status-banner status-error";
    assistantStatus.textContent = error.message;
  }
}

initializeAssistant();
