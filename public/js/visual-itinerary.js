/* Safe DOM rendering shared by the live and generated itinerary previews. */
function renderItinerary(data, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text != null) element.textContent = String(text);
    return element;
  };
  const safeUrl = (value) => {
    if (!value) return null;
    try {
      const url = new URL(value, location.origin);
      return ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch { return null; }
  };
  const list = node("ol", "visual-route");
  for (const [index, stop] of (Array.isArray(data) ? data : []).entries()) {
    if (!stop) continue;
    const row = node("li", "visual-route-stop");
    row.append(node("span", "visual-route-number", `STOP ${String(index + 1).padStart(2, "0")}`));
    const card = node("div", "visual-route-card");
    const media = node("div", "visual-route-media");
    const fallback = () => media.replaceChildren(node("span", "visual-route-fallback", "Photo unavailable"));
    const src = safeUrl(stop.imageUrl);
    if (src) {
      const image = node("img", "visual-route-image");
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.width = 240;
      image.height = 200;
      image.addEventListener("error", fallback, { once: true });
      image.src = src;
      media.append(image);
      if (stop.imageCredit) {
        const creditUrl = safeUrl(stop.imageSourceUrl);
        const credit = node(creditUrl ? "a" : "span", "visual-route-credit", stop.imageCredit);
        if (creditUrl) { credit.href = creditUrl; credit.target = "_blank"; credit.rel = "noopener noreferrer"; }
        media.append(credit);
      }
    } else fallback();
    const details = node("div", "visual-route-details");
    details.append(node("h4", "visual-route-title", stop.placeName || stop.title || stop.name || "Planned stop"));
    const facts = node("dl", "visual-route-facts");
    for (const [icon, label, value] of [
      ["◷", "Hours", stop.openingHours || stop.hours || "Check current opening hours"],
      ["◇", "Entry / expenses", stop.ticketPrice || stop.ticket || stop.priceRange || "Confirm locally"],
      ["⌛", "Suggested stay", stop.suggestedStay || stop.stay || "Flexible — allow time for transit"],
    ]) {
      const fact = node("div", "visual-route-fact");
      const symbol = node("span", "visual-route-icon", icon);
      symbol.setAttribute("aria-hidden", "true");
      fact.append(symbol, node("dt", "", label), node("dd", "", value));
      facts.append(fact);
    }
    details.append(facts);
    if (stop.rating) details.append(node("p", "visual-route-note", `Google Maps rating: ${stop.rating}/5`));
    const mapsUrl = safeUrl(stop.googleMapsUri);
    if (mapsUrl) {
      const link = node("a", "visual-route-map-link", "View on Google Maps");
      link.href = mapsUrl; link.target = "_blank"; link.rel = "noopener noreferrer";
      details.append(link);
    }
    card.append(media, details);
    row.append(card);
    list.append(row);
  }
  container.replaceChildren(list);
  if (!list.children.length) container.append(node("p", "visual-route-note", "Choose a destination to see your route."));
}

function renderItineraryDays(days, containerId, currency = "USD") {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.replaceChildren();
  container.classList.add("visual-route-days");
  for (const [index, day] of (days || []).entries()) {
    const section = document.createElement("section");
    const heading = document.createElement("h3");
    heading.textContent = `Day ${day.day || index + 1}${day.startTime ? ` · Starts ${day.startTime}` : ""}`;
    const target = document.createElement("div");
    target.id = `${containerId}-day-${index}`;
    section.append(heading, target);
    if (day.clusterNearby) {
      const note = document.createElement("p");
      note.className = "visual-route-note";
      note.textContent = "Nearby stops clustered to reduce transit.";
      section.append(note);
    }
    if (day.middayRest) {
      const rest = document.createElement("p");
      rest.className = "visual-route-note";
      rest.textContent = "Includes a 2-hour midday rest.";
      section.append(rest);
    }
    container.append(section);
    const activities = day.activities?.length ? day.activities : [day.morning, day.afternoon, day.evening].filter(Boolean).map(title => ({ title }));
    renderItinerary(activities.map(activity => {
      let ticketPrice = activity.ticketPrice;
      if (!ticketPrice && activity.costUsd != null && Number.isFinite(Number(activity.costUsd))) {
        const rate = typeof currencyRatesToUsd !== "undefined" ? currencyRatesToUsd[currency] : null;
        if (rate) ticketPrice = `Est. ${new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(activity.costUsd) / rate)} / person`;
      }
      return { ...activity, ticketPrice, suggestedStay: activity.suggestedStay || (activity.durationMinutes ? `${activity.durationMinutes} minutes` : null) };
    }), target.id);
  }
}
