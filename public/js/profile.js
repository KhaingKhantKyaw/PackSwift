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

const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};
const journeyLink=(text,href,primary=false)=>{const a=node('a',text,'button '+(primary?'button-primary':'button-secondary'));a.href=href;return a;};
function tripImage(destination){
 const names=['bangkok','singapore','bali','tokyo','paris'];const city=String(destination).split(',')[0].trim().toLowerCase();
 const img=node('img');img.src=names.includes(city)?'/images/destination-'+city+'.jpg':'/images/community-sunset.jpg';img.alt=names.includes(city)?destination:'Travel inspiration';img.loading='lazy';img.onerror=()=>{img.remove();};return img;
}
function journeyEmpty(title,copy,label='Plan a Trip',href='/trip-planner'){
 const box=node('div',null,'journey-empty');const icon=node('span','◇','empty-compass');icon.setAttribute('aria-hidden','true');const text=node('div');text.append(node('h3',title),node('p',copy));box.append(icon,text,journeyLink(label,href));return box;
}
function journeyCard(trip,compact=false){
 const d=trip.details,card=node('article',null,'journey-card'+(compact?' journey-card-compact':''));card.dataset.tripId=trip.tripId;
 const image=node('div',null,'journey-image');image.append(tripImage(d.destination));image.append(node('span',trip.progress.complete?'Plan complete':'In progress','journey-status'));
 const body=node('div',null,'journey-card-body');body.append(node('h3',d.destination),node('p',d.tripType==='local'?'Local journey':d.origin+' → '+d.destination,'journey-route'),node('p',formatDate(d.start)+' – '+formatDate(d.end),'journey-dates'));
 const progress=node('div',null,'journey-progress');const label=node('div');label.append(node('span','Planning progress'),node('strong',trip.progress.percent+'% planned'));const bar=node('progress');bar.max=100;bar.value=trip.progress.percent;bar.setAttribute('aria-label',d.destination+' planning progress');progress.append(label,bar);body.append(progress);
 if(!compact){const sections=node('div',null,'journey-milestones');for(const s of trip.progress.sections)sections.append(node('span',(s.done?'✓ ':'○ ')+s.label));body.append(sections,node('p',d.nights+' nights · '+(Number(d.adults)+Number(d.children))+' travelers · '+d.style,'journey-meta'));}
 const actions=node('div',null,'profile-actions');actions.append(journeyLink(compact?'View Trip':'Continue Planning','/trips/'+encodeURIComponent(trip.tripId),!compact));if(!compact)actions.append(journeyLink('Edit Trip','/trip-planner?trip_id='+encodeURIComponent(trip.tripId)));body.append(actions);card.append(image,body);return card;
}
function renderReadyTrips(){
 document.querySelector('#ready-trip-count').textContent=readyTrips.length+' '+(readyTrips.length===1?'trip':'trips')+' ready';
 readyTripsList.replaceChildren(...readyTrips.map(t=>journeyCard(t,true)));
 if(!readyTrips.length)readyTripsList.append(journeyEmpty('A little preparation, then you’re off.','Complete your itinerary, requirements and packing to move a journey here.','View My Trips','/trips'));
}
function renderInProgressTrips(){
 document.querySelector('#in-progress-trip-count').textContent=inProgressTrips.length+' in progress';
 inProgressTripsList.replaceChildren(...inProgressTrips.map(t=>journeyCard(t)));
 if(!inProgressTrips.length)inProgressTripsList.append(journeyEmpty('No journeys in progress','Your next adventure can start whenever you’re ready.'));
}
function renderPreferences(preferences){
 const root=document.querySelector('#profile-preferences');root.replaceChildren();
 const fields=[['planning_goal','Budget approach'],['accommodation_style','Stay style'],['food_style','Food style'],['transport_style','Getting around'],['activity_style','Activities'],['shopping_style','Shopping']];
 for(const [key,label] of fields){if(!preferences?.[key])continue;const item=node('div',null,'preference-tile');item.append(node('small',label),node('strong',String(preferences[key]).replaceAll('-',' ').replaceAll('_',' ')));root.append(item);}
 if(!root.children.length)root.append(journeyEmpty('A journey that feels like you','Set your travel preferences in the planner to make future planning faster.','Set Preferences','/trip-planner'));
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

  document.querySelector('#stat-total').textContent=savedTrips.length;
  document.querySelector('#stat-active').textContent=inProgressTrips.length;
  document.querySelector('#stat-ready').textContent=readyTrips.length;
  renderPreferences(profile.travelPreferences);
  const trips=document.querySelector('#profile-trips');trips.replaceChildren(...savedTrips.map(t=>journeyCard(t,true)));
  if(!savedTrips.length)trips.append(journeyEmpty('Your story starts here','Save your first journey and find it here whenever you need it.'));

}

async function loadProfile() {
  const sequence=++profileSequence;
  profileController?.abort();profileController=new AbortController();
  profileStatus.textContent='Loading trips…';profileStatus.hidden=false;
  for(const id of ['stat-total','stat-active','stat-ready'])document.getElementById(id).textContent='—';
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
