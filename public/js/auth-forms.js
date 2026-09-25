const authForm = document.querySelector("[data-auth-form]");
const authFeedback = document.querySelector("[data-auth-feedback]");
const pendingPackswiftTripKey = "pending_packswift_trip";
const authRedirectTargetKey = "auth_redirect_target";
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
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function requestedRedirectPath() {
  const params = new URLSearchParams(window.location.search);
  return safeRelativePath(params.get("redirect") || params.get("return"));
}

function postAuthDestination() {
  if(new URLSearchParams(window.location.search).get('redirect')==='/trip-planner?resume_draft=1')return '/trip-planner?resume_draft=1';
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

window.PackSwift.authReady.then((user) => {
  if (user) window.location.replace(postAuthDestination());
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
    window.location.assign(postAuthDestination());
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
