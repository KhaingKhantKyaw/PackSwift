const authForm = document.querySelector("[data-auth-form]");
const authFeedback = document.querySelector("[data-auth-feedback]");
const pendingPackswiftTripKey = "pending_packswift_trip";
const authRedirectTargetKey = "auth_redirect_target";

function safeRelativePath(value, fallback = "/profile") {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function requestedRedirectPath() {
  const params = new URLSearchParams(window.location.search);
  return safeRelativePath(params.get("redirect") || params.get("return"));
}

function postAuthDestination() {
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

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authFeedback.textContent = "";
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
    const hasInlineError = window.PackSwift.forms.showServerErrors(authForm, error);
    if (!hasInlineError && mode === "signup" && error.status === 409) {
      const message = "Choose another email address or username; one of these is already connected to an account.";
      window.PackSwift.forms.showFieldError(authForm.elements.username, message);
      window.PackSwift.forms.showFieldError(authForm.elements.email, message);
    } else if (!hasInlineError) {
      authFeedback.textContent = error.message;
    }
  } finally {
    button.disabled = false;
    button.textContent = mode === "login" ? "Sign in →" : "Create account →";
  }
});
