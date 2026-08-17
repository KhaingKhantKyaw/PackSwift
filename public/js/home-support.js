const feedbackForm = document.querySelector("#home-feedback-form");
const feedbackStatus = document.querySelector("#home-feedback-status");
const copyEmailButton = document.querySelector("[data-copy-email]");

async function copySupportEmail() {
  const email = copyEmailButton.dataset.copyEmail;
  try {
    await navigator.clipboard.writeText(email);
  } catch {
    const helper = document.createElement("textarea");
    helper.value = email;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.append(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }
  copyEmailButton.textContent = "Copied ✓";
  copyEmailButton.dataset.tooltip = "Email copied";
  window.setTimeout(() => {
    copyEmailButton.textContent = "Copy Email";
    copyEmailButton.dataset.tooltip = "Copy email";
  }, 1800);
}

copyEmailButton?.addEventListener("click", copySupportEmail);

feedbackForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  feedbackStatus.className = "form-feedback";
  feedbackStatus.textContent = "";
  if (!window.PackSwift.forms.validate(feedbackForm)) return;

  const button = feedbackForm.querySelector('[type="submit"]');
  button.disabled = true;
  button.textContent = "Submitting…";
  try {
    const result = await window.PackSwift.api("/api/contact/feedback", {
      method: "POST",
      body: JSON.stringify({ message: feedbackForm.elements.message.value }),
    });
    feedbackForm.reset();
    feedbackStatus.className = "form-feedback form-success";
    feedbackStatus.textContent = result.message;
  } catch (error) {
    if (!window.PackSwift.forms.showServerErrors(feedbackForm, error)) {
      feedbackStatus.textContent = error.message;
    }
  } finally {
    button.disabled = false;
    button.textContent = "Submit Feedback";
  }
});
