const authForm = document.querySelector("[data-auth-form]");
const authFeedback = document.querySelector("[data-auth-feedback]");
const pendingPackswiftTripKey = "pending_packswift_trip";
const authRedirectTargetKey = "auth_redirect_target";
const plannerSaveIntentKey = "packswift.planner-save-intent.v1";
const invalidLoginMessage = "Email or password is incorrect";

function loginCredentialControls() {
  return [authForm.elements.identity, authForm.elements.password].filter(
    (control) => control instanceof HTMLInputElement,
  );
}

function clearLoginError() {
  if (authForm.dataset.authForm !== "login") return;
  authFeedback.textContent = "";
  authFeedback.classList.remove("is-error");
  for (const control of loginCredentialControls()) {
    control.classList.remove("is-auth-invalid");
    control.removeAttribute("aria-invalid");
    const describedBy = (control.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter((id) => id && id !== authFeedback.id);
    if (describedBy.length) control.setAttribute("aria-describedby", describedBy.join(" "));
    else control.removeAttribute("aria-describedby");
  }
}

function showInvalidLoginError() {
  if (!authFeedback.id) authFeedback.id = "login-auth-feedback";
  authFeedback.textContent = invalidLoginMessage;
  authFeedback.classList.add("is-error");
  for (const control of loginCredentialControls()) {
    control.classList.add("is-auth-invalid");
    control.setAttribute("aria-invalid", "true");
    const describedBy = new Set(
      (control.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean),
    );
    describedBy.add(authFeedback.id);
    control.setAttribute("aria-describedby", [...describedBy].join(" "));
  }
}

function safeRelativePath(value, fallback = "/profile") {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname.startsWith("//")) return fallback;
    return url.pathname + url.search + url.hash;
  } catch { return fallback; }
}

function requestedRedirectPath() {
  const params = new URLSearchParams(window.location.search);
  return safeRelativePath(params.get("redirect") || params.get("return"));
}

const requested = new URL(requestedRedirectPath(), window.location.origin);
const resumeId = requested.pathname === "/trip-planner" && requested.searchParams.get("resume_draft");
const isPlannerSave = typeof resumeId === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(resumeId);
function matchingIntent() {
  if (!isPlannerSave) return null;
  try {
    const intent = JSON.parse(sessionStorage.getItem(plannerSaveIntentKey));
    return intent?.id === resumeId && intent.action === "save" ? intent : null;
  } catch { return null; }
}

function returnToPlanning() {
  const path = safeRelativePath(matchingIntent()?.returnPath, "/trip-planner");
  const url = new URL(path, window.location.origin);
  if (url.pathname !== "/trip-planner") return "/trip-planner";
  // Preserve the guest's starting destination without admitting a second save action.
  const destination = url.searchParams.get("destination");
  return destination ? "/trip-planner?" + new URLSearchParams({ destination }) : "/trip-planner";
}

function postAuthDestination() {
  if (isPlannerSave) {
    // The planner validates and consumes the tab-local snapshot; expired links
    // return an explicit status instead of silently presenting an empty plan.
    return "/trip-planner?resume_draft=" + resumeId;
  }
  if (requested.pathname === "/trip-planner" && resumeId === "1") return "/trip-planner?resume_draft=1";
  let hasPendingTrip = false;
  try {
    hasPendingTrip = Boolean(sessionStorage.getItem(pendingPackswiftTripKey));
  } catch {
    hasPendingTrip = false;
  }
  if (!hasPendingTrip) return requestedRedirectPath();
  return safeRelativePath(sessionStorage.getItem(authRedirectTargetKey), "/trip-planner");
}

const authSwitchLink = document.querySelector(".auth-switch a");
if (authSwitchLink) {
  const target = authForm.dataset.authForm === "login" ? "/signup" : "/login";
  authSwitchLink.href = `${target}?redirect=${encodeURIComponent(postAuthDestination())}`;
}

let leavingPlannerAuth = false;
if (isPlannerSave) {
  const active = matchingIntent()?.expires > Date.now();
  const login = authForm.dataset.authForm === "login";
  authForm.querySelector(".panel-title").textContent = active
    ? (login ? "Sign in to save your trip" : "Create an account to save your trip")
    : (login ? "Sign in" : "Create your account");
  authForm.querySelector(".panel-copy").textContent = active
    ? "Finish within 20 minutes and we’ll save this plan to My Trips."
    : "This save request is no longer active. Return to the planner to review your trip.";
  if (authSwitchLink) authSwitchLink.textContent = login ? "Create an account" : "Sign in";
  // The shared header has its own sign-in / sign-up links. Preserve the same
  // handoff there too, so switching forms never drops the selected trip.
  for (const link of document.querySelectorAll(".ps-header-auth a")) {
    if (["/login", "/signup"].includes(link.pathname)) {
      link.search = new URLSearchParams({ redirect: postAuthDestination() }).toString();
    }
  }
  const back = document.createElement("a");
  back.href = returnToPlanning();
  back.textContent = "Back to planning";
  back.className = "button button-secondary";
  back.addEventListener("click", (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    leavingPlannerAuth = true;
    // Keep the guest draft; only the explicit request to save to an account is cancelled.
    if (matchingIntent()) sessionStorage.removeItem(plannerSaveIntentKey);
    window.location.replace(back.href);
  });
  authForm.querySelector(".form-actions").append(back);
}

window.PackSwift.authReady.then((user) => {
  if (user && !leavingPlannerAuth) window.location.replace(postAuthDestination());
});

if (authForm.dataset.authForm === "login") {
  for (const control of loginCredentialControls()) {
    control.addEventListener("input", clearLoginError);
  }
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearLoginError();
  authFeedback.textContent = "";
  authFeedback.classList.remove("is-error");
  if (!window.PackSwift.forms.validate(authForm)) return;

  const mode = authForm.dataset.authForm;
  const payload = Object.fromEntries(new FormData(authForm));
  const button = authForm.querySelector('[type="submit"]');
  button.disabled = true;
  button.textContent = mode === "login" ? "Signing in…" : "Creating account…";

  try {
    const result = await window.PackSwift.api(`/api/auth/${mode}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    window.PackSwift.setCurrentUser(result.user);
    if (leavingPlannerAuth) return;
    if (isPlannerSave || resumeId === "1") window.location.replace(postAuthDestination());
    else window.location.assign(postAuthDestination());
  } catch (error) {
    if (mode === "login" && error.status === 401) {
      showInvalidLoginError();
    } else {
      const hasInlineError = window.PackSwift.forms.showServerErrors(authForm, error);
      if (!hasInlineError && mode === "signup" && error.status === 409) {
        const message = "Choose another email address or username; one of these is already connected to an account.";
        window.PackSwift.forms.showFieldError(authForm.elements.username, message);
        window.PackSwift.forms.showFieldError(authForm.elements.email, message);
      } else if (!hasInlineError) {
        authFeedback.textContent = error.message;
        authFeedback.classList.add("is-error");
      }
    }
  } finally {
    button.disabled = false;
    button.textContent = mode === "login" ? "Sign in →" : "Create account →";
  }
});
