const profileGuest = document.querySelector("#profile-guest");
const profileContent = document.querySelector("#profile-content");
const settingsForm = document.querySelector("#settings-form");
const passwordForm = document.querySelector("#password-form");
const inProgressTripsList = document.querySelector("#profile-in-progress-trips");
const readyTripsList = document.querySelector("#profile-ready-trips");
const cancelReadyDialog = document.querySelector("#cancel-ready-dialog");
const confirmCancelReady = document.querySelector("#confirm-cancel-ready");
const themeButtons = [...document.querySelectorAll("[data-theme-option]")];
const activeThemeLabel = document.querySelector("#active-theme-label");
const themeFeedback = document.querySelector("#theme-feedback");
let readyTrips = [];
let inProgressTrips = [];
let cancellingTripId = null;

function themeLabel(preference) {
  return {
    system: "System default",
    light: "Light",
    dark: "Dark",
  }[preference] || "System default";
}

function renderThemePreference(preference = window.PackSwift.themePreference) {
  for (const button of themeButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.themeOption === preference));
  }
  activeThemeLabel.textContent = themeLabel(preference);
}

for (const button of themeButtons) {
  button.addEventListener("click", () => {
    const result = window.PackSwift.setThemePreference(button.dataset.themeOption);
    renderThemePreference(result.preference);
    themeFeedback.textContent = result.preference === "system"
      ? `Following your device · currently ${result.theme}.`
      : `${themeLabel(result.preference)} theme applied.`;
  });
}

window.addEventListener("packswift:themechange", (event) => {
  renderThemePreference(event.detail.preference);
});

renderThemePreference();

function formatDate(value) {
  if (!value) return "Date not set";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function emptyItem(message) {
  const item = document.createElement("p");
  item.className = "profile-empty";
  item.textContent = message;
  return item;
}

function formatBudget(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  } catch {
    return `${currency || "USD"} ${Number(amount || 0).toLocaleString()}`;
  }
}

function openCancelReadyTrip(trip) {
  cancellingTripId = trip.trip_id;
  document.querySelector("#cancel-ready-title").textContent =
    `Cancel ${trip.destination}?`;
  document.querySelector("#cancel-ready-feedback").textContent = "";
  if (typeof cancelReadyDialog.showModal === "function") {
    cancelReadyDialog.showModal();
    return;
  }
  if (window.confirm("Are you sure you want to cancel this ready trip?")) {
    cancelReadyTrip();
  }
}

function renderReadyTrips() {
  readyTripsList.replaceChildren();
  document.querySelector("#ready-trip-count").textContent =
    `${readyTrips.length} ${readyTrips.length === 1 ? "trip" : "trips"} ready`;
  if (!readyTrips.length) {
    readyTripsList.append(
      emptyItem("No trips are fully prepared yet. Complete a trip checklist and it will appear here."),
    );
    return;
  }

  for (const trip of readyTrips) {
    const card = document.createElement("article");
    card.className = "ready-profile-card";
    const head = document.createElement("div");
    head.className = "ready-profile-head";
    const destination = document.createElement("div");
    const label = document.createElement("small");
    label.textContent = "Destination";
    const title = document.createElement("h3");
    title.textContent = trip.destination;
    destination.append(label, title);
    const badge = document.createElement("span");
    badge.className = "ready-badge";
    badge.textContent = "Fully Prepared ✓";
    head.append(destination, badge);

    const details = document.createElement("dl");
    details.className = "ready-profile-details";
    const detailRows = [
      ["Travel dates", `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`],
      ["Budget", formatBudget(trip.budget_amount, trip.budget_currency)],
    ];
    for (const [term, value] of detailRows) {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = term;
      dd.textContent = value;
      row.append(dt, dd);
      details.append(row);
    }

    const actions = document.createElement("div");
    actions.className = "ready-profile-actions";
    const edit = document.createElement("a");
    edit.className = "button button-primary";
    edit.href = `/assist-trip?trip=${encodeURIComponent(trip.trip_id)}`;
    edit.textContent = "Edit Trip";
    const cancel = document.createElement("button");
    cancel.className = "button button-secondary";
    cancel.type = "button";
    cancel.textContent = "Cancel Trip";
    cancel.addEventListener("click", () => openCancelReadyTrip(trip));
    actions.append(edit, cancel);
    card.append(head, details, actions);
    readyTripsList.append(card);
  }
}

function renderInProgressTrips() {
  inProgressTripsList.replaceChildren();
  document.querySelector("#in-progress-trip-count").textContent =
    `${inProgressTrips.length} in progress`;
  if (!inProgressTrips.length) {
    inProgressTripsList.append(
      emptyItem("Trips with confirmed flights or hotels and unfinished checklist items will appear here."),
    );
    return;
  }

  for (const trip of inProgressTrips) {
    const percentage = Math.max(0, Math.min(100, Number(trip.progress_percentage) || 0));
    const remaining = Math.max(0, Number(trip.remaining_count) || 0);
    const card = document.createElement("article");
    card.className = "ready-profile-card in-progress-profile-card";

    const head = document.createElement("div");
    head.className = "ready-profile-head";
    const destination = document.createElement("div");
    const label = document.createElement("small");
    label.textContent = "Destination";
    const title = document.createElement("h3");
    title.textContent = trip.destination;
    destination.append(label, title);
    const badge = document.createElement("span");
    badge.className = "ready-badge in-progress-badge";
    badge.textContent = "Booked & Confirmed";
    head.append(destination, badge);

    const details = document.createElement("dl");
    details.className = "ready-profile-details";
    for (const [term, value] of [
      ["Travel dates", `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`],
      ["Budget", formatBudget(trip.budget_amount, trip.budget_currency)],
    ]) {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = term;
      dd.textContent = value;
      row.append(dt, dd);
      details.append(row);
    }

    const progress = document.createElement("div");
    progress.className = "trip-readiness-progress";
    const progressText = document.createElement("p");
    progressText.textContent = `${percentage}% Prepared — ${remaining} ${remaining === 1 ? "packing item" : "packing items"} remaining`;
    const track = document.createElement("div");
    track.className = "trip-readiness-progress-track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", `${trip.destination} preparation progress`);
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", String(percentage));
    const fill = document.createElement("span");
    fill.style.width = `${percentage}%`;
    track.append(fill);
    progress.append(progressText, track);

    const actions = document.createElement("div");
    actions.className = "ready-profile-actions single-action";
    const continueButton = document.createElement("a");
    continueButton.className = "button button-primary";
    continueButton.href = `/assist-trip?trip=${encodeURIComponent(trip.trip_id)}`;
    continueButton.textContent = "Continue Preparing";
    actions.append(continueButton);
    card.append(head, details, progress, actions);
    inProgressTripsList.append(card);
  }
}

async function cancelReadyTrip() {
  if (!cancellingTripId) return;
  confirmCancelReady.disabled = true;
  const feedback = document.querySelector("#cancel-ready-feedback");
  feedback.textContent = "Returning this trip to your saved plans…";
  try {
    await window.PackSwift.api(
      `/api/trips/${encodeURIComponent(cancellingTripId)}/readiness/cancel`,
      { method: "POST" },
    );
    cancellingTripId = null;
    cancelReadyDialog.close();
    await loadProfile();
  } catch (error) {
    feedback.textContent = error.message;
  } finally {
    confirmCancelReady.disabled = false;
  }
}

function renderProfile(profile) {
  const { user, savedTrips } = profile;
  inProgressTrips = Array.isArray(profile.inProgressTrips) ? profile.inProgressTrips : [];
  readyTrips = Array.isArray(profile.readyTrips) ? profile.readyTrips : [];
  document.querySelector("#profile-name").textContent = user.fullName;
  document.querySelector("#profile-handle").textContent = `@${user.username} · ${user.email}`;
  document.querySelector("#profile-initials").textContent = user.fullName
    .split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  settingsForm.elements.fullName.value = user.fullName;
  settingsForm.elements.username.value = user.username;
  settingsForm.elements.email.value = user.email;
  renderInProgressTrips();
  renderReadyTrips();

  const trips = document.querySelector("#profile-trips");
  trips.replaceChildren();
  if (!savedTrips.length) trips.append(emptyItem("No server-saved trips yet. Your next signed-in plan will appear here."));
  for (const trip of savedTrips) {
    let plan = trip.trip_data || {};
    if (typeof plan === "string") {
      try {
        plan = JSON.parse(plan);
      } catch {
        plan = {};
      }
    }
    const item = document.createElement("article");
    item.className = "profile-list-item";
    const title = document.createElement("strong");
    title.textContent = trip.destination;
    const meta = document.createElement("span");
    const score = plan.destination?.score
      ? ` · ${Math.round(plan.destination.score)}% match`
      : "";
    meta.textContent = `${trip.travel_month} · USD ${Number(trip.budget).toLocaleString()} budget${score}`;
    item.append(title, meta);
    trips.append(item);
  }
}

async function loadProfile() {
  const user = await window.PackSwift.authReady;
  if (!user) {
    profileGuest.hidden = false;
    return;
  }
  try {
    const result = await window.PackSwift.api("/api/profile");
    renderProfile(result.profile);
    profileContent.hidden = false;
  } catch (error) {
    if (error.status === 401) profileGuest.hidden = false;
    else {
      profileGuest.hidden = false;
      profileGuest.querySelector("h1").textContent = "Your profile is temporarily unavailable.";
      profileGuest.querySelector("p:not(.eyebrow)").textContent = error.message;
    }
  }
}

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const feedback = document.querySelector("#settings-feedback");
  feedback.textContent = "";
  if (!window.PackSwift.forms.validate(settingsForm)) return;
  try {
    const result = await window.PackSwift.api("/api/auth/settings", {
      method: "PUT",
      body: JSON.stringify(Object.fromEntries(new FormData(settingsForm))),
    });
    window.PackSwift.setCurrentUser(result.user);
    feedback.className = "form-feedback form-success";
    feedback.textContent = "Account settings saved.";
    document.querySelector("#profile-name").textContent = result.user.fullName;
    document.querySelector("#profile-handle").textContent = `@${result.user.username} · ${result.user.email}`;
  } catch (error) {
    feedback.className = "form-feedback";
    if (!window.PackSwift.forms.showServerErrors(settingsForm, error)) feedback.textContent = error.message;
  }
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const feedback = document.querySelector("#password-feedback");
  feedback.textContent = "";
  if (!window.PackSwift.forms.validate(passwordForm)) return;
  try {
    await window.PackSwift.api("/api/auth/password", {
      method: "PUT",
      body: JSON.stringify(Object.fromEntries(new FormData(passwordForm))),
    });
    passwordForm.reset();
    feedback.className = "form-feedback form-success";
    feedback.textContent = "Password updated securely.";
  } catch (error) {
    feedback.className = "form-feedback";
    if (!window.PackSwift.forms.showServerErrors(passwordForm, error)) feedback.textContent = error.message;
  }
});

confirmCancelReady.addEventListener("click", cancelReadyTrip);
loadProfile();
