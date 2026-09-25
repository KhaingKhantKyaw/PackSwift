const themeStorageKey = "packswift-theme-preference";
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
const supportedThemes = new Set(["system", "light", "dark"]);

function storedThemePreference() {
  try {
    const saved = localStorage.getItem(themeStorageKey);
    return supportedThemes.has(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

let themePreference = storedThemePreference();

function resolvedTheme(preference = themePreference) {
  return preference === "system"
    ? systemThemeQuery.matches ? "dark" : "light"
    : preference;
}

function syncHeaderThemeToggles(theme = resolvedTheme()) {
  for (const toggle of document.querySelectorAll("[data-theme-toggle]")) {
    const nextTheme = theme === "dark" ? "light" : "dark";
    toggle.setAttribute("aria-pressed", String(theme === "dark"));
    toggle.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
    toggle.title = `Switch to ${nextTheme} mode`;
  }
}

function applyThemePreference(preference = themePreference, persist = false) {
  themePreference = supportedThemes.has(preference) ? preference : "system";
  const theme = resolvedTheme(themePreference);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = themePreference;
  document.documentElement.style.colorScheme = theme;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = theme === "dark" ? "#0D1B2A" : "#00A8B5";
  syncHeaderThemeToggles(theme);
  if (persist) {
    try {
      localStorage.setItem(themeStorageKey, themePreference);
    } catch {
      // The preference still applies for the current page when storage is unavailable.
    }
  }
  window.dispatchEvent(new CustomEvent("packswift:themechange", {
    detail: { preference: themePreference, theme },
  }));
  return { preference: themePreference, theme };
}

applyThemePreference(themePreference);

function handleSystemThemeChange() {
  if (themePreference === "system") applyThemePreference("system");
}

if (typeof systemThemeQuery.addEventListener === "function") {
  systemThemeQuery.addEventListener("change", handleSystemThemeChange);
} else if (typeof systemThemeQuery.addListener === "function") {
  systemThemeQuery.addListener(handleSystemThemeChange);
}

const page = document.body.dataset.page;
const navigationStyles=document.createElement('link');navigationStyles.rel='stylesheet';navigationStyles.href='/css/navigation.css';document.head.append(navigationStyles);
const sharedStyles=document.createElement('link');sharedStyles.rel='stylesheet';sharedStyles.href='/css/site-design.css';document.head.append(sharedStyles);
const journeyStyles=document.createElement('link');journeyStyles.rel='stylesheet';journeyStyles.href='/css/journey-theme.css';document.head.append(journeyStyles);
const advisoryStyles=document.createElement('link');advisoryStyles.rel='stylesheet';advisoryStyles.href='/css/advisory-compact.css';document.head.append(advisoryStyles);

const mainNavigation = `
  <a class="nav-link" data-nav="home" href="/">Home</a>
  <a class="nav-link" data-nav="planner" href="/trip-planner">Plan Trip</a>
  <a class="nav-link" data-nav="trips" data-auth="user" hidden href="/my-trips">My Trips</a>
  <a class="nav-link" data-nav="help" href="/help">Help</a>`;

const mobileNavigation = `
  <a data-nav="home" href="/"><span aria-hidden="true">⌂</span><span>Home</span></a>
  <a data-nav="planner" href="/trip-planner"><span aria-hidden="true">◇</span><span>Plan</span></a>
  <a data-nav="trips" data-auth="user" hidden href="/my-trips"><span aria-hidden="true">▤</span><span>My Trips</span></a>
  <a data-nav="help" href="/help"><span aria-hidden="true">?</span><span>Help</span></a>
  <a data-nav="profile" href="/profile"><span aria-hidden="true">○</span><span>Account</span></a>`;

for (const navigation of document.querySelectorAll(".desktop-nav")) {
  navigation.innerHTML = mainNavigation;
}
for (const navigation of document.querySelectorAll(".mobile-nav")) {
  navigation.innerHTML = mobileNavigation;
}
for (const navigation of document.querySelectorAll('.slider-menu')) navigation.innerHTML = mainNavigation;
for (const signup of document.querySelectorAll('a[href="/signup"]')) signup.textContent = 'Get Started';
const footer=document.querySelector('.site-footer .footer-inner, .slider-footer');
if(footer){const links=document.createElement('nav');links.className='footer-help-links';links.setAttribute('aria-label','Information and support');for(const [label,url] of [['About PackSwift','/about'],['Contact & Feedback','/help#contact'],['Privacy','/help#privacy'],['Terms','/help#terms']]){const a=document.createElement('a');a.textContent=label;a.href=url;links.append(a);}footer.append(links);}
document.addEventListener('click',event=>{if(event.target.closest('[data-open-concierge]'))window.PackSwift?.concierge?.open(true);});

for (const oldAction of document.querySelectorAll(".header-action")) {
  const accountNavigation = document.createElement("div");
  accountNavigation.className = "account-navigation";
  accountNavigation.innerHTML = `
    <span data-auth="guest" class="account-guest">
      <a class="account-link" href="/login">Login</a>
      <a class="account-link" href="/signup">Get Started</a>
    </span>
    <span data-auth="user" class="account-user" hidden>
      <a class="account-link" href="/profile"><span data-profile-name>Profile</span></a>
      <button class="account-link account-logout" type="button" data-logout>Logout</button>
    </span>
    <button class="theme-toggle" type="button" data-theme-toggle aria-pressed="false" aria-label="Switch theme">
      <span class="theme-toggle-thumb" aria-hidden="true">☀</span>
    </button>`;
  oldAction.replaceWith(accountNavigation);
}

syncHeaderThemeToggles();
for(const logo of document.querySelectorAll('.brand,.slider-brand')){
  logo.innerHTML='<span class="unified-brand-mark" aria-hidden="true">◇</span><span>Pack<span class="unified-brand-accent">Swift</span></span>';
}

for (const link of document.querySelectorAll("[data-nav]")) {
  if (link.dataset.nav === page || (page === "trips" && link.dataset.nav === "profile")) {
    link.setAttribute("aria-current", "page");
  } else {
    link.removeAttribute("aria-current");
  }
}

for (const year of document.querySelectorAll("[data-current-year]")) {
  year.textContent = new Date().getFullYear();
}

for (const footer of document.querySelectorAll(".footer-inner")) {
  if (footer.querySelector('a[href="/packing-list"]')) continue;
  const links = document.createElement("span");
  links.className = "footer-quick-links";
  links.innerHTML = '<a href="/packing-list">Packing List</a> · <a href="/my-trips">My Trips</a>';
  footer.append(links);
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...options, headers, credentials: "same-origin" });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || "The request could not be completed.");
    error.status = response.status;
    error.fields = payload?.fields || [];
    throw error;
  }
  return payload;
}

function setAuthNavigation(user) {
  for (const guest of document.querySelectorAll('[data-auth="guest"]')) guest.hidden = Boolean(user);
  for (const member of document.querySelectorAll('[data-auth="user"]')) member.hidden = !user;
  for (const name of document.querySelectorAll("[data-profile-name]")) {
    name.textContent = user?.fullName?.split(" ")[0] || "Profile";
  }
  document.documentElement.dataset.authenticated = String(Boolean(user));
}

function formControlLabel(control) {
  const label = control.labels?.[0];
  const directText = label
    ? [...label.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
    : "";
  const text = directText || label?.textContent?.replace(/\s+/g, " ").trim();
  if (text) return text.replace(/\(optional\)/i, "").trim();
  return control.getAttribute("aria-label") || control.name || "this field";
}

function fieldValidationMessage(control) {
  const label = formControlLabel(control);
  const validity = control.validity;
  if (validity.valueMissing) return `Enter ${label.toLowerCase()}.`;
  if (validity.typeMismatch && control.type === "email") {
    return "Enter an email address in the format example@gmail.com.";
  }
  if (validity.rangeUnderflow) return `${label} must be at least ${control.min}.`;
  if (validity.rangeOverflow) return `${label} must be no more than ${control.max}.`;
  if (validity.tooShort) return `${label} must contain at least ${control.minLength} characters.`;
  if (validity.tooLong) return `${label} must contain no more than ${control.maxLength} characters.`;
  if (validity.stepMismatch) return `Enter a supported value for ${label.toLowerCase()}.`;
  if (validity.patternMismatch) {
    return control.dataset.patternMessage || `Use the requested format for ${label.toLowerCase()}.`;
  }
  return control.validationMessage || `Review ${label.toLowerCase()} and try again.`;
}

function fieldErrorContainer(control) {
  return control.closest(".form-field") || control.closest("label") || control.parentElement;
}

function clearFieldError(control) {
  const errorId = control.dataset.fieldErrorId;
  if (errorId) document.getElementById(errorId)?.remove();
  control.removeAttribute("aria-invalid");
  if (errorId) {
    const describedBy = (control.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter((id) => id && id !== errorId);
    if (describedBy.length) control.setAttribute("aria-describedby", describedBy.join(" "));
    else control.removeAttribute("aria-describedby");
  }
  delete control.dataset.fieldErrorId;
  fieldErrorContainer(control)?.classList.remove("has-field-error");
}

function showFieldError(control, message = fieldValidationMessage(control)) {
  if (!control || control.type === "hidden") return;
  clearFieldError(control);
  if (!control.id) control.id = `field-${Math.random().toString(36).slice(2, 9)}`;
  const error = document.createElement("span");
  error.id = `${control.id}-error`;
  error.className = "field-error";
  error.setAttribute("role", "alert");
  error.textContent = message;
  const container = fieldErrorContainer(control);
  container?.append(error);
  container?.classList.add("has-field-error");
  control.dataset.fieldErrorId = error.id;
  control.setAttribute("aria-invalid", "true");
  const describedBy = new Set((control.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
  describedBy.add(error.id);
  control.setAttribute("aria-describedby", [...describedBy].join(" "));
}

function validateForm(form) {
  const controls = [...form.elements].filter((control) =>
    control instanceof HTMLInputElement ||
    control instanceof HTMLSelectElement ||
    control instanceof HTMLTextAreaElement,
  );
  controls.forEach(clearFieldError);
  const invalid = controls.find((control) => !control.disabled && control.type !== "hidden" && !control.checkValidity());
  if (!invalid) return true;
  showFieldError(invalid);
  invalid.focus({ preventScroll: true });
  invalid.scrollIntoView({ behavior: "smooth", block: "center" });
  return false;
}

function showServerErrors(form, error) {
  const fields = Array.isArray(error?.fields) ? error.fields : [];
  let firstControl = null;
  for (const item of fields) {
    const field = item.field || item.path || item.param;
    const control = field ? form.elements.namedItem(field) : null;
    if (!(control instanceof HTMLElement)) continue;
    showFieldError(control, item.message || "Review this field and try again.");
    firstControl ||= control;
  }
  firstControl?.focus({ preventScroll: true });
  return Boolean(firstControl);
}

document.addEventListener("invalid", (event) => {
  const control = event.target;
  if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
    event.preventDefault();
    showFieldError(control);
  }
}, true);

document.addEventListener("input", (event) => {
  const control = event.target;
  if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) return;
  if (control.validity.valid) clearFieldError(control);
});

let currentUser = null;
const authReady = api("/api/auth/me")
  .then(({ user }) => {
    currentUser = user;
    setAuthNavigation(user);
    document.dispatchEvent(new CustomEvent("packswift:auth", { detail: { user } }));
    return user;
  })
  .catch(() => {
    setAuthNavigation(null);
    document.dispatchEvent(new CustomEvent("packswift:auth", { detail: { user: null } }));
    return null;
  });

document.addEventListener("click", async (event) => {
  const themeToggle = event.target.closest("[data-theme-toggle]");
  if (themeToggle) {
    const nextTheme = resolvedTheme() === "dark" ? "light" : "dark";
    applyThemePreference(nextTheme, true);
    return;
  }

  const logout = event.target.closest("[data-logout]");
  if (!logout) return;
  logout.disabled = true;
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.assign("/");
  }
});

window.PackSwift = {
  api,
  authReady,
  forms: {
    clearFieldError,
    showFieldError,
    showServerErrors,
    validate: validateForm,
  },
  get themePreference() {
    return themePreference;
  },
  get resolvedTheme() {
    return resolvedTheme();
  },
  setThemePreference(preference) {
    return applyThemePreference(preference, true);
  },
  get currentUser() {
    return currentUser;
  },
  setCurrentUser(user) {
    currentUser = user;
    setAuthNavigation(user);
  },
};

if (!document.querySelector('script[data-packswift-concierge]')) {
  const conciergeScript = document.createElement("script");
  conciergeScript.src = "/js/chat-widget.js";
  conciergeScript.dataset.packswiftConcierge = "true";
  document.head.append(conciergeScript);
}

document.documentElement.classList.add("js");
