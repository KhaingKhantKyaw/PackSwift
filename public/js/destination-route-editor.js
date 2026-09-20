/* Editable day-tour state is stored on the plan so Save to My Trips preserves it. */
window.PackSwiftRouteEditor = (() => {
  let currentRequest;
  const sampleStops = () => [
    ["Grand Palace", "09:00–16:00 (sample)", "THB 500 / person (sample)", "60–90 min"],
    ["Wat Pho", "08:00–18:30 (sample)", "THB 300 / person (sample)", "60–90 min"],
    ["Tha Tien Market", "Daytime (verify vendors)", "Food at own expense", "45–60 min"],
    ["Wat Arun", "08:00–18:00 (sample)", "THB 200 / person (sample)", "60–90 min"],
    ["ICONSIAM", "10:00–22:00 (sample)", "Purchases at own expense", "90–120 min"],
  ].map(([title, hours, ticket, stay], index) => ({
    id: `sample-bangkok-${index}`, title, hours, ticket, stay,
    imageUrl: `/images/packswift${index % 3 + 1}.jpg`,
    imageCredit: "Illustrative travel photo — not venue photography",
    isSample: true,
  }));

  function normalize(payload) {
    const list = Array.isArray(payload) ? payload : payload?.stops ?? payload?.days?.[0]?.activities;
    if (!Array.isArray(list) || payload?.source === "sample") return [];
    return list.filter(stop => stop && typeof (stop.title || stop.placeName || stop.name) === "string" && (stop.title || stop.placeName || stop.name).trim())
      .slice(0, 5).map(stop => ({ ...stop, title: stop.title || stop.placeName || stop.name }));
  }

  function syncDay(plan) {
    const route = plan.visualDayTour;
    const stops = route.stops.map((stop, index) => ({ ...stop, stopNumber: index + 1 }));
    route.stops = stops;
    // Never silently replace the selected destination with Bangkok sample content.
    if (route.source === "sample" && !/bangkok|bkk/i.test(plan.destination.name)) return;
    const day = { ...(plan.itinerary?.[0] || {}), day: 1, title: "Your arranged day tour", activities: stops,
      morning: stops.slice(0, 2).map(stop => stop.title).join(" · "),
      afternoon: stops.slice(2, 4).map(stop => stop.title).join(" · "),
      evening: stops.slice(4).map(stop => stop.title).join(" · ") };
    plan.itinerary = [day, ...(plan.itinerary || []).slice(1)];
  }

  function render(plan, focusIndex) {
    const target = document.getElementById("destination-route-timeline");
    const status = document.getElementById("destination-route-status");
    const route = plan.visualDayTour;
    status.textContent = route.source === "sample"
      ? "Bangkok sample route — not live data. Photos are illustrative; verify hours and prices. This sample does not change your selected destination."
      : `${plan.destination.name} · Arrange your day tour. Confirm current hours and prices before visiting.`;
    renderItinerary(route.stops, target.id, window.PackSwiftCurrency?.resolve(plan.destination).code || plan.input?.currency);
    const rows = target.querySelectorAll(".visual-route-stop");
    rows.forEach((row, index) => {
      const controls = document.createElement("div");
      controls.className = "route-edit-actions";
      const button = (label, text, disabled, action) => {
        const element = document.createElement("button");
        element.type = "button"; element.textContent = text;
        element.setAttribute("aria-label", label); element.title = label;
        element.disabled = disabled; element.addEventListener("click", action);
        controls.append(element);
      };
      const move = delta => {
        const other = index + delta;
        [route.stops[index], route.stops[other]] = [route.stops[other], route.stops[index]];
        syncDay(plan); render(plan, other);
      };
      button(`Move ${route.stops[index].title} up`, "↑", index === 0, () => move(-1));
      button(`Move ${route.stops[index].title} down`, "↓", index === rows.length - 1, () => move(1));
      button(`Remove ${route.stops[index].title}`, "✕", false, () => {
        route.stops.splice(index, 1); syncDay(plan); render(plan, Math.max(0, index - 1));
      });
      row.querySelector(".visual-route-details").append(controls);
    });
    if (!route.stops.length) target.textContent = "No stops yet. Add a place below.";
    const add = document.createElement("button");
    add.type = "button"; add.className = "button button-secondary route-add-place";
    add.textContent = "+ Add Place"; add.disabled = route.stops.length >= 20;
    target.append(add);
    const form = document.createElement("form");
    form.className = "route-custom-form"; form.hidden = true;
    const fields = [["title", "Place name", true], ["hours", "Opening hours", false], ["ticket", "Ticket / expenses", false], ["stay", "Suggested stay", false]];
    for (const [name, title, required] of fields) {
      const label = document.createElement("label"); label.htmlFor = `route-custom-${name}`; label.textContent = title;
      const input = document.createElement("input"); input.id = label.htmlFor; input.name = name; input.required = required; input.maxLength = 180; input.className = "field-control";
      form.append(label, input);
    }
    const submit = document.createElement("button"); submit.type = "submit"; submit.className = "button button-primary"; submit.textContent = "Add stop";
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "button button-secondary"; cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => { form.hidden = true; add.focus(); });
    form.append(submit, cancel); target.append(form);
    add.addEventListener("click", () => { form.hidden = false; form.elements.title.focus(); });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const title = form.elements.title.value.trim();
      if (!title) { form.elements.title.setCustomValidity("Enter a place name."); form.elements.title.reportValidity(); return; }
      route.stops.push({ id: crypto.randomUUID(), title, hours: form.elements.hours.value.trim(), ticket: form.elements.ticket.value.trim(), stay: form.elements.stay.value.trim(), imageUrl: "", custom: true });
      syncDay(plan); render(plan, route.stops.length - 1);
    });
    form.elements.title.addEventListener("input", () => form.elements.title.setCustomValidity(""));
    if (focusIndex != null) {
      const row = target.querySelectorAll(".visual-route-stop")[focusIndex];
      (row?.querySelector("button:not(:disabled)") || add).focus({ preventScroll: true });
    }
  }

  async function load(plan) {
    currentRequest?.abort();
    const controller = new AbortController(); currentRequest = controller;
    if (plan.visualDayTour && Array.isArray(plan.visualDayTour.stops)) { render(plan); return; }
    const target = document.getElementById("destination-route-timeline");
    target.setAttribute("aria-busy", "true");
    document.getElementById("destination-route-status").textContent = "Preparing your day tour…";
    const input = plan.input || {};
    const daily = Number(input.budgetUsd || 0) / Math.max(1, (plan.days || 1) * (input.travelers || 1));
    const userType = document.getElementById("visual-travel-style")?.value || (input.children > 0 ? "Family with Kids" : input.tripPurpose === "food" ? "Food & Culinary" : input.tripPurpose === "cultural" ? "Culture & Heritage" : daily < 60 ? "Budget / Backpacker" : "Solo / Aesthetic");
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch("/api/generate-itinerary", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ destination: [plan.destination.name, plan.destination.country].filter(Boolean).join(", "), userType, duration: 1,
          pace: ["relaxed", "balanced", "packed", "cultural", "culinary"].includes(input.pace) ? input.pace : "balanced", budgetCategory: daily < 60 ? "budget" : daily > 200 ? "luxury" : "mid" }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const stops = normalize(payload);
      if (!stops.length) throw new Error("No usable stops");
      if (controller !== currentRequest) return;
      plan.visualDayTour = { source: payload.source || "live", stops };
    } catch {
      if (controller !== currentRequest) return;
      plan.visualDayTour = { source: "sample", stops: sampleStops() };
    } finally {
      clearTimeout(timer);
      if (controller === currentRequest) target.setAttribute("aria-busy", "false");
    }
    if (controller === currentRequest) { syncDay(plan); render(plan); }
  }
  return { load, sampleStops, normalize };
})();
