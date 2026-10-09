const profileGuest = document.querySelector("#profile-guest");
const profileContent = document.querySelector("#profile-content");
const settingsForm = document.querySelector("#settings-form");
const passwordForm = document.querySelector("#password-form");
const inProgressTripsList = document.querySelector("#profile-in-progress-trips");
const readyTripsList = document.querySelector("#profile-ready-trips");
const themeButtons = [...document.querySelectorAll("[data-theme-option]")];
const activeThemeLabel = document.querySelector("#active-theme-label");
const themeFeedback = document.querySelector("#theme-feedback");
let readyTrips = [];
let inProgressTrips = [];
let profileSequence = 0;
let profileController;
let reloadTimer;
const profileStatus = document.querySelector("#profile-load-status");

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
  return PackSwiftTripContext.displayDate(value);
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
    title.textContent = trip.details.destination;
    destination.append(label, title);
    const badge = document.createElement("span");
    badge.className = "ready-badge";
    badge.textContent = "Plan Complete ✓";
    head.append(destination, badge);

    const details = document.createElement("dl");
    details.className = "ready-profile-details";
    const detailRows = [
      ["Travel dates", `${formatDate(trip.details.start)} – ${formatDate(trip.details.end)}`],
      ["Budget", formatBudget(trip.details.budget, trip.details.currency)],
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
    edit.href = `/trip-planner?trip_id=${encodeURIComponent(trip.tripId)}`;
    edit.textContent = "Edit Trip";
    const cancel = document.createElement("a");
    cancel.className = "button button-secondary";
    cancel.textContent = "View Trip";
    cancel.href = `/trips/${encodeURIComponent(trip.tripId)}`;
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
      emptyItem("No trips in progress. Start a new trip to plan your next adventure."),
    );
    return;
  }

  for (const trip of inProgressTrips) {
    const percentage = Math.max(0, Math.min(100, Number(trip.progress.percent) || 0));
    const card = document.createElement("article");
    card.className = "ready-profile-card in-progress-profile-card";

    const head = document.createElement("div");
    head.className = "ready-profile-head";
    const destination = document.createElement("div");
    const label = document.createElement("small");
    label.textContent = "Destination";
    const title = document.createElement("h3");
    title.textContent = trip.details.destination;
    destination.append(label, title);
    const badge = document.createElement("span");
    badge.className = "ready-badge in-progress-badge";
    badge.textContent = "In progress";
    head.append(destination, badge);

    const details = document.createElement("dl");
    details.className = "ready-profile-details";
    for (const [term, value] of [
      ["Travel dates", `${formatDate(trip.details.start)} – ${formatDate(trip.details.end)}`],
      ["Budget", formatBudget(trip.details.budget, trip.details.currency)],
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
    progressText.textContent = `${percentage}% planned`;
    const track = document.createElement("div");
    track.className = "trip-readiness-progress-track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", `${trip.details.destination} preparation progress`);
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
    continueButton.href = `/trips/${encodeURIComponent(trip.tripId)}`;
    continueButton.textContent = "Continue Planning";
    actions.append(continueButton);
    card.append(head, details, progress, actions);
    inProgressTripsList.append(card);
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
  if (!settingsForm.contains(document.activeElement)) {
    settingsForm.elements.fullName.value = user.fullName;
    settingsForm.elements.username.value = user.username;
    settingsForm.elements.email.value = user.email;
  }
  renderInProgressTrips();
  renderReadyTrips();

  const trips = document.querySelector("#profile-trips");
  trips.replaceChildren();
  if (!savedTrips.length) trips.append(emptyItem("No trips yet. Your next saved plan will appear here."));
  for (const trip of savedTrips) {
    const item = document.createElement('article');item.className='profile-list-item';
    const title=document.createElement('a');title.className='profile-trip-link';title.textContent=trip.details.destination;title.href='/trips/'+encodeURIComponent(trip.tripId);
    const meta=document.createElement('span');meta.textContent=`${trip.details.origin} → ${trip.details.destination} · ${formatDate(trip.details.start)} – ${formatDate(trip.details.end)} · ${trip.progress.percent}% planned`;
    item.append(title,meta);trips.append(item);
  }
}

async function loadProfile() {
  const sequence=++profileSequence;
  profileController?.abort();profileController=new AbortController();
  profileStatus.textContent='Loading trips…';profileStatus.hidden=false;
  document.querySelector('#in-progress-trip-count').textContent='Loading…';
  document.querySelector('#ready-trip-count').textContent='Loading…';
  const user=await window.PackSwift.authReady;
  if(sequence!==profileSequence)return;
  if(!user){profileGuest.hidden=false;profileContent.hidden=true;profileStatus.hidden=true;return;}
  try {
    const result=await window.PackSwift.api('/api/profile',{cache:'no-store',signal:profileController.signal});
    if(sequence!==profileSequence)return;
    renderProfile(result.profile);profileContent.hidden=false;profileGuest.hidden=true;profileStatus.hidden=true;
  }catch(error){
    if(error.name==='AbortError'||sequence!==profileSequence)return;
    document.querySelector('#in-progress-trip-count').textContent='Unavailable';
    document.querySelector('#ready-trip-count').textContent='Unavailable';
    inProgressTripsList.replaceChildren();readyTripsList.replaceChildren();document.querySelector('#profile-trips').replaceChildren();
    profileStatus.textContent="We couldn't load your trips. ";
    const retry=document.createElement('button');retry.type='button';retry.className='button button-secondary';retry.textContent='Try again';retry.onclick=loadProfile;profileStatus.append(retry);
    if(error.status===401){profileContent.hidden=true;profileGuest.hidden=false;}
  }
}
function queueProfileRefresh(){clearTimeout(reloadTimer);reloadTimer=setTimeout(loadProfile,60);}
window.addEventListener('packswift:trips-changed',queueProfileRefresh);
window.addEventListener('storage',event=>{if(event.key==='packswift:trips-changed')queueProfileRefresh();});
window.addEventListener('focus',queueProfileRefresh);
window.addEventListener('pageshow',event=>{if(event.persisted)queueProfileRefresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)queueProfileRefresh();});

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

loadProfile();
