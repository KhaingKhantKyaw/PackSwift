const packingForm = document.querySelector("#packing-form");
const packingList = document.querySelector("#packing-list");
const packingProgress = document.querySelector("#packing-progress");
const packingPlanContext = document.querySelector("#packing-plan-context");
const packingSourceNote = document.querySelector("#packing-source-note");
const savePackingListButton = document.querySelector(
  "#save-packing-list-button",
);
const packingSaveFeedback = document.querySelector(
  "#packing-save-feedback",
);
const loginRequiredDialog = document.querySelector(
  "#login-required-dialog",
);
const packingLoginLink = document.querySelector("#packing-login-link");
const handoffStorageKey = "packswift.packing-context.v1";
const latestPlanKey = "packswift.latest-plan.v1";
const pendingSaveKey = "packswift.pending-packing-save.v1";

let activePackingKey = "manual";
let activeTripId = null;
let activeServerItems = null;
let activeGeneratedList = null;

function normalizeClimate(value) {
  const climate = String(value || "mild").toLowerCase();
  if (["hot", "warm", "mild", "seasonal", "cool"].includes(climate)) {
    return climate;
  }
  return "mild";
}

function normalizePurpose(value) {
  const purpose = String(value || "leisure").toLowerCase();
  if (purpose === "work") return "business";
  if (purpose === "outdoors") return "adventure";
  return ["leisure", "business", "adventure", "family"].includes(purpose)
    ? purpose
    : "leisure";
}

function buildList(input) {
  const list = {
    Essentials: [
      "Passport and travel documents",
      "Travel insurance details",
      "Phone charger and universal adapter",
      "Reusable water bottle",
      "Daily medication",
    ],
    Clothing: [
      `${Math.min(input.days, 7)} versatile tops`,
      `${Math.max(2, Math.ceil(input.days / 3))} comfortable bottoms`,
      "Comfortable walking shoes",
      "Sleepwear",
    ],
    Comfort: ["Small day bag", "Sunglasses", "Basic first-aid items"],
  };

  if (["hot", "warm"].includes(input.climate)) {
    list.Clothing.push("Sun hat", "Lightweight evening layer");
    list.Comfort.push("High-SPF sunscreen");
  } else if (input.climate === "cool") {
    list.Clothing.push(
      "Warm base layer",
      "Insulated outer layer",
      "Warm socks",
    );
  } else if (input.climate === "seasonal") {
    list.Clothing.push("Warm mid-layer", "Packable outer layer");
  } else {
    list.Clothing.push("Light knit layer");
  }

  if (input.rain !== "low") {
    list.Comfort.push("Compact umbrella", "Packable rain shell");
  }
  if (input.purpose === "adventure") {
    list.Comfort.push("Activity-ready footwear", "Compact torch");
  } else if (input.purpose === "business") {
    list.Essentials.push(
      "Laptop and charging cable",
      "Meeting documents",
      "Meeting-ready outfit",
    );
  } else if (
    input.purpose === "family" ||
    input.travelerDemographic === "family-with-children"
  ) {
    list.Essentials.push(
      "Shared family document folder",
      "Child comfort and activity items",
    );
  }
  if (input.travelerDemographic === "senior") {
    list.Comfort.push(
      "Comfort medication kit",
      "Written emergency contacts",
    );
  }
  if (input.travelers > 1) {
    list.Essentials.push("Shared emergency contact plan");
  }
  if (input.travelingWithPets) {
    list["Pet care"] = [
      "Pet travel documents and vaccination records",
      "Secure carrier, lead, and identification tag",
      "Familiar food, collapsible bowls, and waste supplies",
      "Pet medication and a local veterinary contact",
    ];
  }
  return list;
}

function currentInput() {
  const data = new FormData(packingForm);
  return {
    destination:
      String(data.get("destination") || "").trim() || "Your destination",
    days: Math.max(1, Math.min(30, Number(data.get("days")) || 1)),
    travelers: Math.max(
      1,
      Math.min(20, Number(data.get("travelers")) || 1),
    ),
    climate: normalizeClimate(data.get("climate")),
    rain: String(data.get("rain") || "moderate"),
    purpose: normalizePurpose(data.get("purpose")),
    travelerDemographic: String(
      data.get("travelerDemographic") || "adults",
    ),
    travelingWithPets: data.get("travelingWithPets") === "true",
  };
}

function packingChecksKey() {
  return `packswift.packing.v2.${activePackingKey}`;
}

function savedChecks() {
  try {
    const value = JSON.parse(
      localStorage.getItem(packingChecksKey()) || "{}",
    );
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function updateProgress() {
  const checks = [
    ...packingList.querySelectorAll('input[type="checkbox"]'),
  ];
  const completed = checks.filter((check) => check.checked).length;
  const percentage = checks.length
    ? Math.round((completed / checks.length) * 100)
    : 0;
  packingProgress.style.setProperty("--progress", `${percentage}%`);
  packingProgress.dataset.progress = `${percentage}%`;
  packingProgress.setAttribute(
    "aria-label",
    `${percentage} percent packed`,
  );

  const state = Object.fromEntries(
    checks.map((check) => [check.id, check.checked]),
  );
  localStorage.setItem(packingChecksKey(), JSON.stringify(state));
}

function itemsFromGeneratedList(list) {
  if (!list || typeof list !== "object") return null;
  return Object.entries(list).flatMap(([category, items]) =>
    (Array.isArray(items) ? items : []).map((itemName) => ({
      category,
      itemName,
      completed: false,
      id: null,
    })),
  );
}

function renderPackingList(input) {
  const suppliedItems =
    activeServerItems || itemsFromGeneratedList(activeGeneratedList);
  const list = suppliedItems || itemsFromGeneratedList(buildList(input));
  const state = savedChecks();
  document.querySelector("#packing-title").textContent =
    `${input.destination} · ${input.days} ` +
    `${input.days === 1 ? "day" : "days"}`;
  document.querySelector("#packing-subtitle").textContent =
    `${input.climate[0].toUpperCase()}${input.climate.slice(1)} ` +
    `conditions with ${input.rain} rain likelihood · ` +
    `${input.travelers} ${input.travelers === 1 ? "traveller" : "travellers"}.`;
  packingList.replaceChildren();

  const categories = new Map();
  for (const item of list) {
    const categoryItems = categories.get(item.category) || [];
    categoryItems.push(item);
    categories.set(item.category, categoryItems);
  }

  for (const [category, items] of categories) {
    const section = document.createElement("section");
    section.className = "packing-category";
    const heading = document.createElement("h3");
    heading.textContent = category;
    section.append(heading);

    for (const [index, item] of items.entries()) {
      const safeName = item.itemName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      const id = `pack-${category.toLowerCase()}-${index}-${safeName}`;
      const label = document.createElement("label");
      label.className = "packing-item";
      const inputElement = document.createElement("input");
      inputElement.type = "checkbox";
      inputElement.id = id;
      inputElement.checked =
        state[id] === undefined
          ? Boolean(item.completed)
          : Boolean(state[id]);
      if (item.id) inputElement.dataset.itemId = String(item.id);
      const text = document.createElement("span");
      text.textContent = item.itemName;
      label.append(inputElement, text);
      section.append(label);
    }
    packingList.append(section);
  }
  updateProgress();
}

function contextFromPlan(plan) {
  if (!plan?.destination) return null;
  const destination = plan.destination;
  const displayName =
    destination.displayName ||
    [destination.name, destination.country].filter(Boolean).join(", ");
  return {
    version: 1,
    source: "latest-plan",
    planId: plan.id,
    tripId: plan.persistence?.saved
      ? plan.persistence.tripId || plan.id
      : null,
    destination: {
      slug: destination.slug || null,
      name: destination.name || displayName,
      countryName: destination.countryName || destination.country || "",
      displayName,
      primaryAirportCode:
        destination.primaryAirportCode || destination.code || null,
    },
    dates: {
      start: plan.input?.startDate || null,
      end: plan.input?.endDate || null,
      days: plan.days || 1,
    },
    weather: {
      climate:
        plan.weather?.climate ||
        destination.climate ||
        plan.input?.preferredClimate ||
        "mild",
      rain: plan.weather?.rain || destination.rain || "moderate",
      low: plan.weather?.low ?? null,
      high: plan.weather?.high ?? null,
    },
    tripPurpose: plan.input?.tripPurpose || "leisure",
    travelers: plan.input?.travelers || 1,
    travelerDemographic:
      plan.input?.travelerDemographic || "adults",
    travelingWithPets:
      plan.input?.travelingWithPets === true,
    packingList: plan.packingList || null,
  };
}

function readStoredContext() {
  try {
    const context = JSON.parse(
      sessionStorage.getItem(handoffStorageKey) || "null",
    );
    if (context?.destination?.displayName) return context;
  } catch {
    // Continue to the device-level latest plan fallback.
  }
  try {
    const plan = JSON.parse(localStorage.getItem(latestPlanKey) || "null");
    return contextFromPlan(plan);
  } catch {
    return null;
  }
}

function readLatestPlan() {
  try {
    const plan = JSON.parse(localStorage.getItem(latestPlanKey) || "null");
    return plan?.destination && plan?.input ? plan : null;
  } catch {
    return null;
  }
}

async function loadServerPackingContext(tripId) {
  if (!tripId) return null;
  try {
    await window.PackSwift.authReady;
    const result = await window.PackSwift.api(
      `/api/trips/${encodeURIComponent(tripId)}/packing-list`,
    );
    return {
      context: {
        ...result.context,
        source: "saved-trip",
      },
      items: result.items,
    };
  } catch {
    return null;
  }
}

function planAnalysisInput(plan) {
  const input = plan.input || {};
  return {
    budget: input.budget,
    currency: input.currency,
    travelers: input.travelers,
    startDate: input.startDate,
    endDate: input.endDate,
    destination:
      plan.destination?.name ||
      input.destination ||
      input.destinationQuery ||
      "",
    preferredClimate: input.preferredClimate || "any",
    pace: input.pace || "balanced",
    tripPurpose: input.tripPurpose || "leisure",
    travelerDemographic: input.travelerDemographic || "adults",
    travelingWithPets: input.travelingWithPets === true,
    interests: input.interests || [],
    arrivalAt: input.arrivalAt || null,
    hotelName: input.hotelName || null,
    hotelAddress: input.hotelAddress || null,
  };
}

function currentCompletionByName() {
  return new Map(
    [...packingList.querySelectorAll(".packing-item")].map((label) => [
      label.querySelector("span")?.textContent || "",
      Boolean(label.querySelector('input[type="checkbox"]')?.checked),
    ]),
  );
}

function packingChecklistSnapshot() {
  return [...packingList.querySelectorAll(".packing-item")].map((label) => ({
    category:
      label.closest(".packing-category")?.querySelector("h3")?.textContent ||
      "General",
    itemName: label.querySelector("span")?.textContent || "",
    completed: Boolean(
      label.querySelector('input[type="checkbox"]')?.checked,
    ),
  }));
}

function storeAuthenticatedPlan(plan) {
  localStorage.setItem(latestPlanKey, JSON.stringify(plan));
  const context = contextFromPlan(plan);
  if (context) {
    context.source = "saved-trip";
    try {
      sessionStorage.setItem(
        handoffStorageKey,
        JSON.stringify(context),
      );
    } catch {
      // The saved server trip remains the source of truth.
    }
  }
}

async function ensureServerTrip() {
  let plan = readLatestPlan();
  if (activeTripId) {
    const serverResult = await loadServerPackingContext(activeTripId);
    if (serverResult) return { plan, serverResult };
    activeTripId = null;
  }
  if (!plan) {
    throw new Error(
      "Create a trip plan before saving your packing checklist.",
    );
  }

  let result;
  try {
    result = await window.PackSwift.api("/api/trips/analyze", {
      method: "POST",
      body: JSON.stringify(planAnalysisInput(plan)),
    });
  } catch (error) {
    if (![404, 405, 503].includes(error.status)) throw error;
    result = await window.PackSwift.api("/api/trips/import", {
      method: "POST",
      body: JSON.stringify({ plan }),
    });
  }
  if (!result.persistence?.saved || !result.persistence.tripId) {
    throw new Error("PackSwift could not save this trip yet.");
  }
  plan = { ...result.plan, persistence: result.persistence };
  storeAuthenticatedPlan(plan);
  activeTripId = result.persistence.tripId;
  const serverResult = await loadServerPackingContext(activeTripId);
  if (!serverResult) {
    throw new Error("The saved packing checklist could not be loaded.");
  }
  return { plan, serverResult };
}

async function applyCompletionsToServer(completions) {
  const requests = [];
  for (const label of packingList.querySelectorAll(".packing-item")) {
    const name = label.querySelector("span")?.textContent || "";
    const checkbox = label.querySelector('input[type="checkbox"]');
    if (!checkbox || !completions.has(name)) continue;
    checkbox.checked = completions.get(name);
    if (activeTripId && checkbox.dataset.itemId) {
      requests.push(
        window.PackSwift.api(
          `/api/trips/${encodeURIComponent(activeTripId)}/packing-list/${checkbox.dataset.itemId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ completed: checkbox.checked }),
          },
        ),
      );
    }
  }
  updateProgress();
  await Promise.all(requests);
}

function packingReturnPath() {
  return `${window.location.pathname}${window.location.search}`;
}

function loginDestination() {
  return `/login?return=${encodeURIComponent(packingReturnPath())}`;
}

function showLoginRequired() {
  packingLoginLink.href = loginDestination();
  if (typeof loginRequiredDialog.showModal === "function") {
    loginRequiredDialog.showModal();
    return;
  }
  window.alert("Log in to save checklist.");
  sessionStorage.setItem(pendingSaveKey, "true");
  window.location.assign(packingLoginLink.href);
}

async function savePackingListToAccount() {
  savePackingListButton.disabled = true;
  savePackingListButton.textContent = "Saving…";
  packingSaveFeedback.className = "packing-save-feedback";
  packingSaveFeedback.textContent = "";
  const completions = currentCompletionByName();

  try {
    const { plan, serverResult } = await ensureServerTrip();
    applyPackingContext(serverResult.context, serverResult.items);
    renderPackingList(currentInput());
    await applyCompletionsToServer(completions);

    const savedPlan = {
      ...plan,
      persistence: {
        saved: true,
        tripId: activeTripId,
      },
      packingChecklist: {
        savedAt: new Date().toISOString(),
        items: packingChecklistSnapshot(),
      },
    };
    await window.PackSwift.api("/api/saved-trips", {
      method: "POST",
      body: JSON.stringify({ plan: savedPlan }),
    });
    storeAuthenticatedPlan(savedPlan);
    const pageUrl = new URL(window.location.href);
    pageUrl.searchParams.set("trip", activeTripId);
    window.history.replaceState(
      {},
      "",
      `${pageUrl.pathname}${pageUrl.search}`,
    );
    packingSaveFeedback.className =
      "packing-save-feedback is-success";
    packingSaveFeedback.textContent =
      "Packing list saved to your PackSwift account ✓";
    savePackingListButton.textContent = "Saved ✓";
  } catch (error) {
    packingSaveFeedback.className = "packing-save-feedback is-error";
    packingSaveFeedback.textContent = error.message;
    savePackingListButton.textContent = "Try saving again";
  } finally {
    sessionStorage.removeItem(pendingSaveKey);
    savePackingListButton.disabled = false;
  }
}

function formatTripDates(start, end) {
  if (!start || !end) return "";
  try {
    const formatter = new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    return `${formatter.format(new Date(`${start}T00:00:00Z`))} – ` +
      formatter.format(new Date(`${end}T00:00:00Z`));
  } catch {
    return `${start} – ${end}`;
  }
}

function applyPackingContext(context, serverItems = null) {
  const displayName =
    context.destination?.displayName ||
    [
      context.destination?.name,
      context.destination?.countryName,
    ].filter(Boolean).join(", ");
  if (!displayName) return false;

  activeTripId = context.tripId || null;
  activePackingKey =
    activeTripId ||
    context.planId ||
    `${displayName}-${context.dates?.start || "undated"}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
  activeServerItems = Array.isArray(serverItems) && serverItems.length
    ? serverItems
    : null;
  activeGeneratedList = context.packingList || null;

  document.querySelector("#packing-destination").value = displayName;
  document.querySelector("#packing-days").value =
    context.dates?.days || 1;
  document.querySelector("#packing-travelers").value =
    context.travelers || 1;
  document.querySelector("#packing-climate").value = normalizeClimate(
    context.weather?.climate,
  );
  document.querySelector("#packing-rain").value =
    context.weather?.rain || "moderate";
  document.querySelector("#trip-purpose").value = normalizePurpose(
    context.tripPurpose,
  );
  document.querySelector("#packing-demographic").value =
    context.travelerDemographic || "adults";
  document.querySelector("#packing-pets").checked =
    context.travelingWithPets === true;

  document.querySelector("#packing-context-destination").textContent =
    displayName;
  const dateText = formatTripDates(
    context.dates?.start,
    context.dates?.end,
  );
  document.querySelector("#packing-context-details").textContent = [
    dateText,
    `${context.dates?.days || 1} days`,
    `${context.travelers || 1} ${
      context.travelers === 1 ? "traveller" : "travellers"
    }`,
    normalizePurpose(context.tripPurpose),
    context.travelingWithPets ? "Pets included" : "",
  ].filter(Boolean).join(" · ");
  packingPlanContext.hidden = false;
  packingSourceNote.textContent =
    context.source === "saved-trip"
      ? "Loaded securely from your saved PackSwift trip."
      : "Loaded from the trip plan created in this browser session.";
  return true;
}

async function loadPackingDestinations() {
  try {
    const response = await fetch("/data/destinations.json");
    if (!response.ok) return;
    const destinations = await response.json();
    const datalist = document.querySelector("#packing-destinations");
    datalist.replaceChildren(
      ...destinations.map((destination) => {
        const option = document.createElement("option");
        option.value = `${destination.name}, ${destination.country}`;
        option.label = destination.region;
        return option;
      }),
    );
  } catch {
    // The destination remains an editable worldwide text field.
  }
}

packingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  activeServerItems = null;
  activeGeneratedList = null;
  const input = currentInput();
  activePackingKey =
    `${input.destination}-${input.days}-${input.purpose}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
  localStorage.removeItem(packingChecksKey());
  packingSourceNote.textContent =
    "Checklist regenerated from your adjusted trip details.";
  renderPackingList(input);
});

packingList.addEventListener("change", async (event) => {
  if (!(event.target instanceof HTMLInputElement)) return;
  updateProgress();
  const itemId = event.target.dataset.itemId;
  if (!activeTripId || !itemId) return;
  try {
    await window.PackSwift.api(
      `/api/trips/${encodeURIComponent(activeTripId)}/packing-list/${itemId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ completed: event.target.checked }),
      },
    );
  } catch {
    packingSourceNote.textContent =
      "Your checklist is saved on this device; account sync is temporarily unavailable.";
  }
});

savePackingListButton.addEventListener("click", async () => {
  const user = await window.PackSwift.authReady;
  if (!user) {
    showLoginRequired();
    return;
  }
  await savePackingListToAccount();
});

packingLoginLink.addEventListener("click", () => {
  sessionStorage.setItem(pendingSaveKey, "true");
});

async function initializePackingPage() {
  const tripId = new URLSearchParams(window.location.search).get("trip");
  const [serverResult] = await Promise.all([
    loadServerPackingContext(tripId),
    loadPackingDestinations(),
  ]);
  const context = serverResult?.context || readStoredContext();
  if (context) {
    applyPackingContext(context, serverResult?.items || null);
  } else {
    packingSourceNote.textContent =
      "Create a trip plan first, or enter your packing details here.";
  }
  renderPackingList(currentInput());
  const user = await window.PackSwift.authReady;
  if (
    user &&
    sessionStorage.getItem(pendingSaveKey) === "true"
  ) {
    await savePackingListToAccount();
  }
}

initializePackingPage();
