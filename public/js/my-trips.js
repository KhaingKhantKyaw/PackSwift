const tripStorageKey = "packswift.trips.v1";
const tripList = document.querySelector("#trip-list");
const emptyTrips = document.querySelector("#trips-empty");
const tripStatus = document.querySelector("#trips-status");
const savedTripDialog = document.querySelector("#saved-trip-dialog");
const savedTripForm = document.querySelector("#saved-trip-form");
const savedTripFeedback = document.querySelector("#saved-trip-form-feedback");
const saveSavedTripButton = document.querySelector("#save-saved-trip");

let activeAccountUser = null;
let editingTrip = null;
let activeLoadController = null;
let loadSequence = 0;
let renderedTrips = [];
let selectedTripId = null;

function getDeviceTrips() {
  try {
    const value = JSON.parse(localStorage.getItem(tripStorageKey) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function formatDate(value) {
  if (!value) return "Dates to be confirmed";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.valueOf())
    ? "Dates to be confirmed"
    : new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}

function formatMoney(amount, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: ["JPY", "KRW"].includes(currency) ? 0 : 2,
    }).format(Number(amount));
  } catch {
    return `${currency} ${Math.round(Number(amount))}`;
  }
}

function createTag(text) {
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = text;
  return tag;
}

function normalizeServerTrip(savedTrip) {
  const plan = savedTrip.trip_data && typeof savedTrip.trip_data === "object"
    ? savedTrip.trip_data
    : {};
  return {
    source: "account",
    savedTripId: Number(savedTrip.id),
    id: plan.id || `saved-${savedTrip.id}`,
    rawPlan: plan,
    destination: plan.destination || {
      name: savedTrip.destination,
      country: "",
      code: savedTrip.destination.slice(0, 3).toUpperCase(),
    },
    input: plan.input || {
      travelers: 1,
      currency: "USD",
      budget: savedTrip.budget,
      budgetUsd: savedTrip.budget,
    },
    days: plan.days,
    itinerary: plan.itinerary || [],
    travelMonth: savedTrip.travel_month,
    estimatedCost: plan.estimatedCost,
    tripSessionId: plan.persistence?.tripId || null,
    createdAt: savedTrip.created_at,
    updatedAt: savedTrip.updated_at || savedTrip.created_at,
  };
}

function setStatus(message, type = "default") {
  tripStatus.hidden = !message;
  tripStatus.className = type === "error"
    ? "status-banner status-error"
    : type === "success"
      ? "status-banner form-success"
      : "status-banner";
  tripStatus.textContent = message || "";
}

function openSavedTripEditor(trip = null) {
  if (!activeAccountUser) {
    window.location.assign(`/login?return=${encodeURIComponent("/my-trips")}`);
    return;
  }
  editingTrip = trip;
  savedTripForm.reset();
  savedTripFeedback.textContent = "";
  document.querySelector("#saved-trip-dialog-title").textContent = trip
    ? "Edit saved trip"
    : "Add a trip plan";
  document.querySelector("#saved-trip-dialog-copy").textContent = trip
    ? "Update this plan directly in your PackSwift account database."
    : "Save the essential plan details directly to your PackSwift account.";
  if (trip) {
    savedTripForm.elements.destination.value = trip.destination?.name || "";
    savedTripForm.elements.country.value = trip.destination?.country || "";
    savedTripForm.elements.travelMonth.value = trip.travelMonth || "";
    savedTripForm.elements.budgetUsd.value = Number(
      trip.input?.budgetUsd || trip.input?.budget || trip.estimatedCost || 0,
    ) || "";
    savedTripForm.elements.startDate.value = String(trip.input?.startDate || "").slice(0, 10);
    savedTripForm.elements.endDate.value = String(trip.input?.endDate || "").slice(0, 10);
    savedTripForm.elements.travelers.value = Math.max(1, Number(trip.input?.travelers) || 1);
  }
  if (typeof savedTripDialog.showModal === "function") savedTripDialog.showModal();
}

function createTripCard(trip) {
  const article = document.createElement("article");
  article.className = "trip-card";
  const selected = trip.source === "account" && trip.savedTripId === selectedTripId;
  article.classList.toggle("is-selected", selected);
  article.dataset.savedTripId = trip.source === "account" ? String(trip.savedTripId) : "";

  const code = document.createElement("div");
  code.className = "trip-code";
  code.textContent = trip.destination?.code || trip.destination?.slug?.slice(0, 3).toUpperCase() || "TRP";

  const details = document.createElement("div");
  const heading = document.createElement("h2");
  const country = trip.destination?.country ? `, ${trip.destination.country}` : "";
  heading.textContent = `${trip.destination?.name || "Saved trip"}${country}`;
  const dates = document.createElement("p");
  const primaryDate = trip.input?.startDate
    ? formatDate(trip.input.startDate)
    : trip.travelMonth || "Dates to be confirmed";
  const travellerCount = Number(trip.input?.travelers) || 1;
  dates.textContent = `${primaryDate} · ${trip.days || "Flexible"} days · ${travellerCount} traveller${travellerCount === 1 ? "" : "s"}`;

  const meta = document.createElement("div");
  meta.className = "trip-meta";
  meta.append(
    createTag(trip.source === "account" ? "Live account plan" : "On this device"),
    createTag(
      trip.estimatedCost
        ? `${formatMoney(trip.estimatedCost, trip.input?.currency || "USD")} estimated`
        : `${trip.itinerary?.length || 0} itinerary days`,
    ),
    createTag(trip.destination?.climate || "Climate flexible"),
  );
  details.append(heading, dates, meta);
  const views=document.createElement('div'),tabbar=document.createElement('div'),view=document.createElement('div');
  tabbar.className='trip-detail-tabs';tabbar.setAttribute('role','tablist');tabbar.setAttribute('aria-label','Trip details');
  view.className='trip-detail-view';view.setAttribute('role','tabpanel');
  const display=label=>{
    view.replaceChildren();
    const paragraph=document.createElement('p');
    if(label==='Overview')paragraph.textContent=`${heading.textContent} · ${dates.textContent}`;
    if(label==='Budget')paragraph.textContent=`Your budget: ${formatMoney(trip.input?.budget || 0,trip.input?.currency || 'USD')}${trip.estimatedCost?` · Estimated cost: ${formatMoney(trip.estimatedCost,trip.input?.currency || 'USD')}`:''}`;
    if(label==='Itinerary'){
      paragraph.textContent=trip.itinerary?.length?`${trip.itinerary.length} planned days`:'No day-by-day itinerary saved yet.';
      if(trip.tripSessionId){const link=document.createElement('a');link.href=`/trip-itinerary?trip=${encodeURIComponent(trip.tripSessionId)}`;link.textContent='Open itinerary';view.append(link);}
      else (trip.itinerary || []).forEach((day,i)=>{const line=document.createElement('p');line.textContent=`Day ${i+1}: ${day.title || day.theme || day.summary || 'Saved itinerary'}`;view.append(line);});
    }
    if(label==='Preparation'){
      paragraph.textContent=trip.tripSessionId?'Review documents, packing, and remaining preparation.':'Open your saved plan to begin preparing.';
      if(trip.tripSessionId){const link=document.createElement('a');link.href=`/assist-trip?trip=${encodeURIComponent(trip.tripSessionId)}`;link.textContent='Open preparation checklist';view.append(link);}
    }
    view.prepend(paragraph);[...tabbar.children].forEach(button=>button.setAttribute('aria-selected',String(button.textContent===label)));
  };
  ['Overview','Itinerary','Preparation','Budget'].forEach(label=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('role','tab');button.addEventListener('click',()=>display(label));tabbar.append(button);});
  views.append(tabbar,view);details.append(views);display('Overview');

  const actions = document.createElement("div");
  actions.className = "trip-card-actions";
  if (trip.tripSessionId) {
    const prepare = document.createElement("a");
    prepare.className = "button button-primary";
    prepare.href = `/assist-trip?trip=${encodeURIComponent(trip.tripSessionId)}`;
    prepare.innerHTML = '<i data-lucide="list-checks" aria-hidden="true"></i> Ready my trip';
    actions.append(prepare);
  }
  if (trip.source === "account") {
    const select = document.createElement("button");
    select.className = selected ? "button button-primary trip-select-button" : "button button-secondary trip-select-button";
    select.type = "button";
    select.setAttribute("aria-pressed", String(selected));
    select.innerHTML = selected
      ? '<i data-lucide="circle-check" aria-hidden="true"></i> Selected'
      : '<i data-lucide="mouse-pointer-2" aria-hidden="true"></i> Select trip';
    select.addEventListener("click", () => {
      selectedTripId = trip.savedTripId;
      renderTrips(renderedTrips);
    });
    const edit = document.createElement("button");
    edit.className = "button button-secondary";
    edit.type = "button";
    edit.innerHTML = '<i data-lucide="pencil" aria-hidden="true"></i> Edit';
    edit.addEventListener("click", () => openSavedTripEditor(trip));
    actions.append(select, edit);
  }
  const remove = document.createElement("button");
  remove.className = "button button-secondary button-danger-quiet";
  remove.type = "button";
  remove.innerHTML = '<i data-lucide="trash-2" aria-hidden="true"></i> Delete';
  remove.addEventListener("click", async () => {
    if (!window.confirm("Delete this saved trip? This cannot be undone.")) return;
    remove.disabled = true;
    try {
      if (trip.source === "account") {
        await window.PackSwift.api(`/api/saved-trips/${trip.savedTripId}`, { method: "DELETE" });
        await loadTrips({ successMessage: "Saved trip deleted from MySQL." });
      } else {
        const remaining = getDeviceTrips().filter((candidate) => candidate.id !== trip.id);
        localStorage.setItem(tripStorageKey, JSON.stringify(remaining));
        await loadTrips({ successMessage: "Device trip deleted." });
      }
    } catch (error) {
      setStatus(error.message, "error");
      remove.disabled = false;
    }
  });
  actions.append(remove);
  article.append(code, details, actions);
  return article;
}

function renderTrips(trips) {
  renderedTrips = trips;
  const accountTrips = trips.filter((trip) => trip.source === "account");
  if (!accountTrips.some((trip) => trip.savedTripId === selectedTripId)) {
    selectedTripId = accountTrips[0]?.savedTripId || null;
  }
  tripList.replaceChildren(...trips.map(createTripCard));
  emptyTrips.hidden = trips.length > 0;
  tripList.hidden = trips.length === 0;
  updateAddPlanButton(accountTrips);
  window.lucide?.createIcons();
}

function updateAddPlanButton(accountTrips) {
  const button = document.querySelector("#add-saved-trip");
  const selectedTrip = accountTrips.find((trip) => trip.savedTripId === selectedTripId);
  const disabled = !selectedTrip;
  button.disabled = disabled;
  button.setAttribute("aria-disabled", String(disabled));
  button.classList.toggle("button-primary", !disabled);
  for (const className of ["opacity-50", "pointer-events-none", "bg-slate-300", "cursor-not-allowed"]) {
    button.classList.toggle(className, disabled);
  }
  button.title = disabled
    ? "Save a trip before adding itinerary items"
    : `Add an itinerary item to ${selectedTrip.destination?.name || "the selected trip"}`;
}

function importableSavedPlan(trip) {
  const plan = structuredClone(trip.rawPlan || {});
  const destinationName = trip.destination?.name || "Saved destination";
  const slug = plan.destination?.slug || destinationName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "saved-destination";
  const travelers = Math.max(1, Number(plan.input?.travelers || trip.input?.travelers) || 1);
  return {
    ...plan,
    id: plan.id || crypto.randomUUID(),
    days: Math.max(1, Number(plan.days || trip.days) || 1),
    destination: {
      name: destinationName,
      country: trip.destination?.country || plan.destination?.country || "",
      code: trip.destination?.code || plan.destination?.code || destinationName.slice(0, 3).toUpperCase(),
      slug,
      score: Number(plan.destination?.score) || 80,
      attractions: Array.isArray(plan.destination?.attractions) ? plan.destination.attractions : [],
      ...(plan.destination || {}),
    },
    input: {
      tripScope: "international",
      tripPurpose: "leisure",
      pace: "balanced",
      interests: [],
      preferredClimate: "mild",
      travelerDemographic: "adult",
      travelingWithPets: false,
      smartPace: { lateRiser: false, middayRest: false, clusterNearby: true },
      currency: "USD",
      budget: Number(trip.input?.budgetUsd || trip.input?.budget) || 1000,
      budgetUsd: Number(trip.input?.budgetUsd || trip.input?.budget) || 1000,
      travelers,
      adults: travelers,
      children: 0,
      ...(plan.input || {}),
    },
    weather: {
      climate: "mild",
      low: 20,
      high: 30,
      rain: "moderate",
      note: "Check the live forecast before departure.",
      ...(plan.weather || {}),
    },
    summary: plan.summary || `A saved PackSwift trip to ${destinationName}.`,
    itinerary: Array.isArray(plan.itinerary) ? plan.itinerary : [],
    packingList: plan.packingList && typeof plan.packingList === "object" ? plan.packingList : {},
  };
}

async function addPlanToSelectedTrip() {
  const button = document.querySelector("#add-saved-trip");
  const trip = renderedTrips.find(
    (candidate) => candidate.source === "account" && candidate.savedTripId === selectedTripId,
  );
  if (!trip || button.disabled) return;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  setStatus(`Opening the itinerary builder for ${trip.destination?.name || "your trip"}…`);
  try {
    let tripSessionId = trip.tripSessionId;
    if (!tripSessionId) {
      const plan = importableSavedPlan(trip);
      const imported = await window.PackSwift.api("/api/trips/import", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      tripSessionId = imported.persistence?.tripId;
      if (!tripSessionId) throw new Error("PackSwift could not prepare this trip for itinerary editing.");
      const connectedPlan = { ...plan, persistence: imported.persistence };
      await window.PackSwift.api(`/api/saved-trips/${trip.savedTripId}`, {
        method: "PATCH",
        body: JSON.stringify({ plan: connectedPlan }),
      });
    }
    window.location.assign(`/trip-itinerary?trip=${encodeURIComponent(tripSessionId)}&action=add`);
  } catch (error) {
    setStatus(error.message, "error");
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

async function loadTrips({ successMessage = "" } = {}) {
  const sequence = ++loadSequence;
  activeLoadController?.abort();
  activeLoadController = new AbortController();
  setStatus(activeAccountUser ? "Refreshing trips from MySQL…" : "Loading device plans…");
  try {
    let trips;
    if (activeAccountUser) {
      const result = await window.PackSwift.api(`/api/saved-trips?fresh=${Date.now()}`, {
        cache: "no-store",
        signal: activeLoadController.signal,
      });
      trips = result.savedTrips.map(normalizeServerTrip);
    } else {
      trips = getDeviceTrips().map((trip) => ({ ...trip, source: "device" }));
    }
    if (sequence !== loadSequence) return;
    renderTrips(trips);
    setStatus(
      successMessage || (activeAccountUser ? "" : "Login to store new plans in your PackSwift account."),
      successMessage ? "success" : "default",
    );
  } catch (error) {
    if (error.name === "AbortError" || sequence !== loadSequence) return;
    setStatus(error.message, "error");
  }
}

function daysBetween(startDate, endDate, fallback) {
  if (!startDate || !endDate) return Number(fallback) || null;
  const difference = (new Date(`${endDate}T00:00:00Z`) - new Date(`${startDate}T00:00:00Z`)) / 86400000;
  return difference >= 0 ? Math.max(1, Math.round(difference) + 1) : null;
}

function planFromForm() {
  const values = Object.fromEntries(new FormData(savedTripForm));
  const previous = editingTrip?.rawPlan && typeof editingTrip.rawPlan === "object"
    ? structuredClone(editingTrip.rawPlan)
    : {};
  const destinationName = values.destination.trim();
  const startDate = values.startDate || null;
  const endDate = values.endDate || null;
  return {
    ...previous,
    id: previous.id || crypto.randomUUID(),
    destination: {
      ...(previous.destination || {}),
      name: destinationName,
      displayName: destinationName,
      country: values.country.trim(),
      code: previous.destination?.code || destinationName.slice(0, 3).toUpperCase(),
    },
    travelMonth: values.travelMonth.trim(),
    days: daysBetween(startDate, endDate, previous.days),
    input: {
      ...(previous.input || {}),
      startDate,
      endDate,
      travelers: Number(values.travelers),
      currency: "USD",
      budget: Number(values.budgetUsd),
      budgetUsd: Number(values.budgetUsd),
    },
    estimatedCost: Number(previous.estimatedCost) || Number(values.budgetUsd),
    itinerary: Array.isArray(previous.itinerary) ? previous.itinerary : [],
    updatedAt: new Date().toISOString(),
  };
}

savedTripForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  savedTripFeedback.textContent = "";
  const startDate = savedTripForm.elements.startDate.value;
  const endDate = savedTripForm.elements.endDate.value;
  savedTripForm.elements.endDate.setCustomValidity(
    startDate && endDate && endDate < startDate ? "End date must be on or after the start date." : "",
  );
  if (!window.PackSwift.forms.validate(savedTripForm)) return;
  saveSavedTripButton.disabled = true;
  saveSavedTripButton.textContent = editingTrip ? "Updating…" : "Saving…";
  try {
    const plan = planFromForm();
    await window.PackSwift.api(
      editingTrip ? `/api/saved-trips/${editingTrip.savedTripId}` : "/api/saved-trips",
      {
        method: editingTrip ? "PATCH" : "POST",
        body: JSON.stringify({ plan }),
      },
    );
    const message = editingTrip ? "Saved trip updated in MySQL." : "New trip saved to MySQL.";
    editingTrip = null;
    savedTripDialog.close();
    await loadTrips({ successMessage: message });
  } catch (error) {
    if (!window.PackSwift.forms.showServerErrors(savedTripForm, error)) savedTripFeedback.textContent = error.message;
  } finally {
    saveSavedTripButton.disabled = false;
    saveSavedTripButton.innerHTML = '<i data-lucide="database" aria-hidden="true"></i> Save trip';
    window.lucide?.createIcons();
  }
});

document.querySelector("#add-saved-trip").addEventListener("click", addPlanToSelectedTrip);
document.querySelector("#close-saved-trip-dialog").addEventListener("click", () => savedTripDialog.close());
document.querySelector("#cancel-saved-trip").addEventListener("click", () => savedTripDialog.close());
savedTripForm.elements.startDate.addEventListener("change", () => savedTripForm.elements.endDate.setCustomValidity(""));
savedTripForm.elements.endDate.addEventListener("change", () => savedTripForm.elements.endDate.setCustomValidity(""));

window.PackSwift.authReady.then((user) => {
  activeAccountUser = user;
  loadTrips();
});
window.lucide?.createIcons();
