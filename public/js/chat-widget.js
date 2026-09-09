(() => {
  if (document.querySelector("#packswift-concierge")) return;

  const historyStorageKey = "packswift.concierge.history.v1";
  const packingContextKey = "packswift.packing-context.v1";
  const latestPlanKey = "packswift.latest-plan.v1";
  const generatedTripKey = "packswift.concierge.generated-trip.v1";
  const pendingPackswiftTripKey = "pending_packswift_trip";
  const legacyPendingAiTripKey = "pending_ai_trip";
  const pendingAiTripModeKey = "pending_ai_trip_mode";
  const authRedirectTargetKey = "auth_redirect_target";
  const modulePathPattern = /\/(assist-trip|assist-visa|trip-planner|trip-itinerary|packing-list|travel-guide)\b/g;
  const quickPrompts = [
    "💡 3-Day Bangkok Itinerary",
    "🎒 What to pack for Chiang Mai?",
    "💰 Budget trip under $300",
  ];
  const welcomeMessage = "Hi! I’m PackSwift Concierge. ✨ Tell me where you’re going, or ask about destinations, budgets, weather, attractions, packing, visas, and itineraries.";

  function safeJson(storage, key) {
    try {
      return JSON.parse(storage.getItem(key) || "null");
    } catch {
      return null;
    }
  }

  function loadHistory() {
    const stored = safeJson(sessionStorage, historyStorageKey);
    if (!Array.isArray(stored)) return [{ role: "assistant", content: welcomeMessage }];
    const history = stored
      .filter((entry) =>
        ["user", "assistant"].includes(entry?.role) &&
        typeof entry?.content === "string" && entry.content.trim())
      .slice(-20)
      .map((entry) => {
        const tripCard = entry.trip_card || entry.trip_recommendation;
        return {
          role: entry.role,
          content: entry.content.slice(0, 6000),
          ...(validRecommendation(tripCard) ? { trip_card: tripCard } : {}),
        };
      });
    return history.length ? history : [{ role: "assistant", content: welcomeMessage }];
  }

  let chatHistory = loadHistory();
  let sending = false;

  function validRecommendation(value) {
    const enums = {
      scope: ["Nationwide", "Worldwide"],
      currency: ["USD", "THB", "MMK", "SGD", "CNY"],
      travel_purpose: ["Adventure & Outdoor", "Adventure & Leisure", "Leisure & Relaxation", "Culture & Heritage", "Food & Nightlife"],
      travel_group: ["Solo", "Couples", "Friends", "Family"],
      travel_pace: ["Slow & Relaxed", "Balanced & Steady", "Packed & Fast"],
    };
    return Boolean(value && typeof value === "object" &&
      Object.entries(enums).every(([key, choices]) => choices.includes(value[key])) &&
      typeof value.origin === "string" && typeof value.destination === "string" &&
      /^\d{2}\/\d{2}\/\d{4}$/.test(value.start_date) &&
      /^\d{2}\/\d{2}\/\d{4}$/.test(value.end_date) &&
      Number.isInteger(Number(value.duration_nights)) && Number(value.duration_nights) >= 1 &&
      Number(value.duration_days) === Number(value.duration_nights) + 1 &&
      Number(value.total_budget) > 0 && Number.isInteger(Number(value.adults_count)) &&
      Number.isInteger(Number(value.children_count)) && typeof value.pet_included === "boolean" &&
      typeof value.summary_pitch === "string" && Array.isArray(value.day_by_day_highlights) &&
      value.day_by_day_highlights.length === Number(value.duration_days));
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(historyStorageKey, JSON.stringify(chatHistory.slice(-20)));
    } catch {
      // The chat remains available for the current page when storage is unavailable.
    }
  }

  function currentTripContext() {
    const handoff = safeJson(sessionStorage, packingContextKey) || {};
    const plan = safeJson(localStorage, latestPlanKey) || {};
    const input = plan.input || handoff.input || {};
    const destination = plan.destination || handoff.destination || {};
    const tripId = new URLSearchParams(window.location.search).get("trip") ||
      plan.persistence?.tripId || handoff.tripId || null;
    return {
      page: document.body.dataset.page || window.location.pathname,
      tripId,
      destination: {
        name: destination.name || handoff.destinationName || input.destination || null,
        country: destination.country || destination.countryName || null,
        displayName: destination.displayName || handoff.destinationDisplayName || null,
      },
      dates: {
        start: input.startDate || handoff.startDate || null,
        end: input.endDate || handoff.endDate || null,
      },
      route: input.route || handoff.route || null,
      budget: input.budget ? { amount: input.budget, currency: input.currency } : null,
      travelers: input.travelers || handoff.travelers || null,
      tripPurpose: input.tripPurpose || handoff.tripPurpose || null,
      travelGroup: input.travelerDemographic || handoff.travelerDemographic || null,
      pace: input.pace || handoff.pace || null,
      weather: plan.weather || handoff.weather || null,
    };
  }

  const root = document.createElement("div");
  root.id = "packswift-concierge";
  root.className = "concierge-root";
  root.innerHTML = `
    <section id="concierge-panel" class="concierge-panel" role="dialog" aria-label="PackSwift Concierge" hidden>
      <header class="concierge-header">
        <span class="concierge-avatar" aria-hidden="true">✦</span>
        <span class="concierge-heading">
          <strong>PackSwift Concierge</strong>
          <small><span class="concierge-online-dot" aria-hidden="true"></span> Online travel support</small>
        </span>
        <button class="concierge-close" type="button" aria-label="Minimize PackSwift Concierge">−</button>
      </header>
      <div class="concierge-suggestions" aria-label="Suggested questions"></div>
      <div class="concierge-messages" role="log" aria-live="polite" aria-relevant="additions"></div>
      <div class="concierge-typing" role="status" aria-label="PackSwift Concierge is typing" hidden>
        <span></span><span></span><span></span><i aria-hidden="true"></i><small>Concierge is preparing your answer</small>
      </div>
      <form class="concierge-form">
        <div class="concierge-input-group"><label class="concierge-input-label" for="concierge-input">Message PackSwift Concierge</label><textarea id="concierge-input" rows="1" maxlength="1200" placeholder="e.g. Plan four days in Bangkok" required></textarea></div>
        <button class="concierge-send" type="submit" aria-label="Send message"><span>Send</span><b aria-hidden="true">→</b></button>
      </form>
    </section>
    <button class="concierge-launcher" type="button" aria-controls="concierge-panel" aria-expanded="false">
      <span aria-hidden="true">✦</span><span class="sr-only">Open PackSwift Concierge</span>
    </button>
    <section class="concierge-auth-modal" role="dialog" aria-modal="true" aria-labelledby="concierge-auth-title" hidden>
      <button class="concierge-auth-backdrop" type="button" aria-label="Close sign-in invitation"></button>
      <div class="concierge-auth-card">
        <button class="concierge-auth-close" type="button" aria-label="Close sign-in invitation">×</button>
        <span class="concierge-auth-icon" aria-hidden="true">✦</span>
        <p class="concierge-auth-eyebrow">Your tailored trip is ready</p>
        <h2 id="concierge-auth-title">Save Your Trip &amp; Unlock 1-Click Planning</h2>
        <p class="concierge-auth-copy">Create a free PackSwift account to save this itinerary, unlock live weather &amp; packing checklists, get automated visa requirements, and track real-world budgets.</p>
        <ul class="concierge-auth-perks">
          <li><span aria-hidden="true">✓</span> Instant auto-generated packing lists</li>
          <li><span aria-hidden="true">✓</span> Offline trip access &amp; PDF exports</li>
          <li><span aria-hidden="true">✓</span> Destination-aware visa and cultural guidance</li>
        </ul>
        <div class="concierge-auth-actions">
          <a class="concierge-auth-primary" href="/login?redirect=/trip-planner">Log In <span aria-hidden="true">→</span></a>
          <a class="concierge-auth-secondary" href="/signup?redirect=/trip-planner">Create an Account</a>
        </div>
        <small>Your preview stays in this browser while you sign in.</small>
      </div>
    </section>`;
  document.body.append(root);

  const panel = root.querySelector(".concierge-panel");
  const launcher = root.querySelector(".concierge-launcher");
  const closeButton = root.querySelector(".concierge-close");
  const messages = root.querySelector(".concierge-messages");
  const suggestions = root.querySelector(".concierge-suggestions");
  const form = root.querySelector(".concierge-form");
  const input = root.querySelector("#concierge-input");
  const sendButton = root.querySelector(".concierge-send");
  const typing = root.querySelector(".concierge-typing");
  const authModal = root.querySelector(".concierge-auth-modal");
  const authModalCard = root.querySelector(".concierge-auth-card");
  const authModalClose = root.querySelector(".concierge-auth-close");
  const authModalBackdrop = root.querySelector(".concierge-auth-backdrop");
  const authModalLogin = root.querySelector(".concierge-auth-primary");
  const authModalSignup = root.querySelector(".concierge-auth-secondary");
  let pendingModalRecommendation = null;
  let pendingModalTrigger = null;

  function appendLinkedText(container, text) {
    let start = 0;
    for (const match of text.matchAll(modulePathPattern)) {
      container.append(document.createTextNode(text.slice(start, match.index)));
      const link = document.createElement("a");
      link.href = match[0];
      link.textContent = match[0];
      link.className = "concierge-module-link";
      container.append(link);
      start = match.index + match[0].length;
    }
    container.append(document.createTextNode(text.slice(start)));
  }

  function renderAssistantContent(container, content) {
    const lines = content.split("\n");
    let list = null;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        list = null;
        continue;
      }
      const bullet = line.match(/^(?:•|-|\*)\s*(.+)$/);
      if (bullet) {
        if (!list) {
          list = document.createElement("ul");
          container.append(list);
        }
        const item = document.createElement("li");
        appendLinkedText(item, bullet[1]);
        list.append(item);
        continue;
      }
      list = null;
      const paragraph = document.createElement("p");
      appendLinkedText(paragraph, line.replace(/^#{1,3}\s*/, ""));
      container.append(paragraph);
    }
  }

  function recommendationMeta(label, value) {
    const row = document.createElement("span");
    row.className = "concierge-trip-meta-item";
    const term = document.createElement("small");
    term.textContent = label;
    const detail = document.createElement("strong");
    detail.textContent = value;
    row.append(term, detail);
    return row;
  }

  function showTripToast(message, mode = "success") {
    let toast = document.querySelector("#concierge-trip-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "concierge-trip-toast";
      toast.className = "concierge-trip-toast";
      toast.setAttribute("role", "status");
      document.body.append(toast);
    }
    toast.className = `concierge-trip-toast is-${mode} is-visible`;
    toast.textContent = message;
    window.clearTimeout(showTripToast.timer);
    showTripToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function storePendingAiTrip(recommendation, mode) {
    try {
      const pendingTrip = { source: "concierge", recommendation };
      sessionStorage.setItem(pendingPackswiftTripKey, JSON.stringify(pendingTrip));
      sessionStorage.setItem(legacyPendingAiTripKey, JSON.stringify(recommendation));
      sessionStorage.setItem(pendingAiTripModeKey, mode || "save_after_auth");
      sessionStorage.setItem(authRedirectTargetKey, "/trip-planner");
      return true;
    } catch {
      showTripToast("This browser could not preserve the trip preview.", "error");
      return false;
    }
  }

  function closeAuthModal() {
    authModal.hidden = true;
    document.documentElement.classList.remove("concierge-modal-open");
    const trigger = pendingModalTrigger;
    pendingModalRecommendation = null;
    pendingModalTrigger = null;
    trigger?.focus();
  }

  function openAuthModal(recommendation, trigger) {
    if (!storePendingAiTrip(recommendation, "save_after_auth")) return;
    pendingModalRecommendation = recommendation;
    pendingModalTrigger = trigger;
    const returnTo = "/trip-planner";
    authModalLogin.href = `/login?redirect=${encodeURIComponent(returnTo)}`;
    authModalSignup.href = `/signup?redirect=${encodeURIComponent(returnTo)}`;
    authModal.hidden = false;
    document.documentElement.classList.add("concierge-modal-open");
    requestAnimationFrame(() => authModalClose.focus());
  }

  async function createRecommendedTrip(recommendation, button) {
    if (button.disabled) return;
    storePendingAiTrip(recommendation, "save_after_auth");
    button.disabled = true;
    button.textContent = "Creating your trip…";
    try {
      const result = await window.PackSwift.api("/api/trips/create", {
        method: "POST",
        body: JSON.stringify({ recommendation }),
      });
      const persistedPlan = result.plan || null;
      if (persistedPlan) {
        try {
          localStorage.setItem(latestPlanKey, JSON.stringify(persistedPlan));
          sessionStorage.setItem(generatedTripKey, JSON.stringify({
            tripId: result.trip_id,
            plan: persistedPlan,
          }));
        } catch {
          // The saved database trip remains available when browser storage is unavailable.
        }
      }
      sessionStorage.removeItem(pendingPackswiftTripKey);
      sessionStorage.removeItem(legacyPendingAiTripKey);
      sessionStorage.removeItem(pendingAiTripModeKey);
      sessionStorage.removeItem(authRedirectTargetKey);
      showTripToast("Trip plan generated successfully! 🎉");
      window.setTimeout(() => {
        window.location.assign(result.redirect_url || `/trip-planner?trip_id=${encodeURIComponent(result.trip_id)}`);
      }, 850);
    } catch (error) {
      button.disabled = false;
      button.textContent = "⚡ Plan & Customize This Trip with PackSwift";
      showTripToast(error.message || "The trip could not be created. Please try again.", "error");
    }
  }

  async function handleRecommendationAction(recommendation, button) {
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = "Checking your account…";
    const user = await window.PackSwift.authReady;
    if (user) {
      button.disabled = false;
      await createRecommendedTrip(recommendation, button);
      return;
    }
    button.disabled = false;
    button.textContent = "⚡ Plan & Customize This Trip with PackSwift";
    openAuthModal(recommendation, button);
  }

  function recommendationCard(recommendation) {
    const card = document.createElement("section");
    card.className = "concierge-trip-card";
    card.setAttribute("aria-label", `Recommended trip to ${recommendation.destination}`);

    const eyebrow = document.createElement("span");
    eyebrow.className = "concierge-trip-eyebrow";
    eyebrow.textContent = "✦ Concierge trip match";
    const title = document.createElement("h3");
    title.textContent = recommendation.destination;
    const route = document.createElement("p");
    route.className = "concierge-trip-route";
    route.textContent = `${recommendation.origin} → ${recommendation.destination}`;
    const pitch = document.createElement("p");
    pitch.className = "concierge-trip-pitch";
    pitch.textContent = recommendation.summary_pitch;

    const badges = document.createElement("div");
    badges.className = "concierge-trip-badges";
    [recommendation.scope, recommendation.travel_group, recommendation.travel_purpose, recommendation.travel_pace]
      .forEach((value) => {
        const badge = document.createElement("span");
        badge.textContent = value;
        badges.append(badge);
      });

    const meta = document.createElement("div");
    meta.className = "concierge-trip-meta";
    const passengerCount = recommendation.adults_count + recommendation.children_count;
    meta.append(
      recommendationMeta("Duration", `${recommendation.duration_nights} night${recommendation.duration_nights === 1 ? "" : "s"} / ${recommendation.duration_days} days`),
      recommendationMeta("Dates", `${recommendation.start_date} – ${recommendation.end_date}`),
      recommendationMeta("Travellers", `${passengerCount} (${recommendation.adults_count} adult${recommendation.adults_count === 1 ? "" : "s"}${recommendation.children_count ? `, ${recommendation.children_count} child${recommendation.children_count === 1 ? "" : "ren"}` : ""})${recommendation.pet_included ? " + pet" : ""}`),
      recommendationMeta("Total budget", new Intl.NumberFormat("en-US", {
        style: "currency", currency: recommendation.currency, maximumFractionDigits: 0,
      }).format(recommendation.total_budget)),
    );

    const itinerary = document.createElement("div");
    itinerary.className = "concierge-trip-itinerary";
    const itineraryTitle = document.createElement("strong");
    itineraryTitle.textContent = "Day-by-day highlights";
    const itineraryList = document.createElement("ol");
    recommendation.day_by_day_highlights.forEach((day) => {
      const item = document.createElement("li");
      const label = document.createElement("b");
      label.textContent = `Day ${day.day}: ${day.title}`;
      const detail = document.createElement("span");
      detail.textContent = day.highlights.join(" • ");
      item.append(label, detail);
      itineraryList.append(item);
    });
    itinerary.append(itineraryTitle, itineraryList);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "concierge-trip-apply";
    button.textContent = "⚡ Plan & Customize This Trip with PackSwift";
    button.addEventListener("click", () => handleRecommendationAction(recommendation, button));
    card.append(eyebrow, title, route, badges, meta, pitch, itinerary, button);
    return card;
  }

  function messageElement(entry) {
    const article = document.createElement("article");
    article.className = `concierge-message is-${entry.role}`;
    const label = document.createElement("span");
    label.className = "concierge-message-label";
    label.textContent = entry.role === "user" ? "You" : "PackSwift Concierge";
    const bubble = document.createElement("div");
    bubble.className = "concierge-bubble";
    if (entry.role === "assistant") renderAssistantContent(bubble, entry.content);
    else bubble.textContent = entry.content;
    article.append(label, bubble);
    if (entry.role === "assistant" && validRecommendation(entry.trip_card)) {
      article.append(recommendationCard(entry.trip_card));
    }
    return article;
  }

  function renderHistory() {
    messages.replaceChildren(...chatHistory.map(messageElement));
    requestAnimationFrame(() => { messages.scrollTop = messages.scrollHeight; });
  }

  function setOpen(open) {
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
    launcher.classList.toggle("is-open", open);
    if (open) {
      renderHistory();
      setTimeout(() => input.focus(), 40);
    } else {
      launcher.focus();
    }
  }

  function setSending(active) {
    sending = active;
    typing.hidden = !active;
    input.disabled = active;
    sendButton.disabled = active;
    if (active) requestAnimationFrame(() => { messages.scrollTop = messages.scrollHeight; });
  }

  async function sendMessage(text) {
    const message = text.trim().slice(0, 1200);
    if (!message || sending) return;
    const previousHistory = chatHistory.map((entry) => ({
      role: entry.role === "assistant" ? "model" : "user",
      text: entry.content,
    }));
    chatHistory.push({ role: "user", content: message });
    saveHistory();
    renderHistory();
    input.value = "";
    setSending(true);
    try {
      const result = await window.PackSwift.api("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          tripContext: currentTripContext(),
          history: previousHistory,
        }),
      });
      const tripCard = result.trip_card || result.trip_recommendation;
      chatHistory.push({
        role: "assistant",
        content: result.text || result.reply,
        ...(validRecommendation(tripCard)
          ? { trip_card: tripCard }
          : {}),
      });
    } catch (error) {
      chatHistory.push({
        role: "assistant",
        content: error.status === 429
          ? "I’ve received several messages at once. Please wait a moment, then try again. ⏳"
          : "I couldn’t reach the travel service just now. Please try again in a moment.",
      });
    } finally {
      setSending(false);
      saveHistory();
      renderHistory();
      input.focus();
    }
  }

  suggestions.replaceChildren(...quickPrompts.map((prompt) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "concierge-chip";
    chip.textContent = prompt;
    chip.addEventListener("click", () => sendMessage(prompt));
    return chip;
  }));

  launcher.addEventListener("click", () => setOpen(panel.hidden));
  closeButton.addEventListener("click", () => setOpen(false));
  document.addEventListener("packswift:concierge:ask", (event) => {
    const message = String(event.detail?.message || "").trim();
    if (!message) {
      event.detail?.fallback?.();
      return;
    }
    setOpen(true);
    sendMessage(message);
  });
  authModalClose.addEventListener("click", closeAuthModal);
  authModalBackdrop.addEventListener("click", closeAuthModal);
  authModalLogin.addEventListener("click", () => {
    if (pendingModalRecommendation) {
      storePendingAiTrip(pendingModalRecommendation, "save_after_auth");
    }
    closeAuthModal();
  });
  authModalSignup.addEventListener("click", () => {
    if (pendingModalRecommendation) {
      storePendingAiTrip(pendingModalRecommendation, "save_after_auth");
    }
    closeAuthModal();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 92)}px`;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !authModal.hidden) closeAuthModal();
    else if (event.key === "Escape" && !panel.hidden) setOpen(false);
  });

  renderHistory();
  window.PackSwift.concierge = { open: setOpen, ask: sendMessage };
})();
