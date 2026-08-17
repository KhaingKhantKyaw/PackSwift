const guideButtons = [...document.querySelectorAll("[data-filter]")];
const guideCount = document.querySelector("#guide-count");
const guideContainer = document.querySelector("#guide-destinations");
const guideSearch = document.querySelector("#guide-search");
const guideSort = document.querySelector("#guide-sort");
const insightsCard = document.querySelector("#guide-local-insights");
const previewDrawer = document.querySelector("#guide-preview-drawer");
const previewBackdrop = document.querySelector("#guide-preview-backdrop");

const trendingSlugs = [
  "bangkok", "tokyo", "paris", "bali", "singapore", "seoul", "dubai", "rome",
];

const destinationImages = {
  bangkok: "/images/destination-bangkok.jpg",
  tokyo: "/images/destination-tokyo.jpg",
  singapore: "/images/destination-singapore.jpg",
  bali: "/images/destination-bali.jpg",
  paris: "/images/destination-paris.jpg",
};

const transitInsights = {
  bangkok: "Use BTS/MRT stored-value cards, river ferries, and metered taxis. Skip peak-hour road trips when rail or boat routes are available.",
  tokyo: "Use an IC transit card and compare a 24-hour subway pass with pay-as-you-go fares. Group nearby neighborhoods on the same day.",
  singapore: "Tap a contactless card on MRT and buses. Downtown sights are compact enough to combine with shaded walking routes.",
  bali: "Group sights by area and agree on a full-day driver price before departure. Avoid crossing the island repeatedly in traffic.",
  hanoi: "Walk the Old Quarter, use fixed-fare ride apps, and group lakeside and heritage stops to avoid repeated transfers.",
  "chiang-mai": "Share red songthaews on central routes and use fixed-fare ride apps for Doi Suthep or evening trips.",
  yangon: "Use the circular railway for a low-cost local journey and confirm taxi or ride-app fares before longer cross-city trips.",
  paris: "Buy a carnet or day pass only after comparing your planned journeys. Walk between central Seine landmarks instead of changing metro lines.",
  lisbon: "Use a rechargeable Viva Viagem card, but walk connected central districts when hills and viewpoints are part of the experience.",
  "new-york-city": "Use OMNY fare capping and combine attractions by borough. Subway travel is usually faster and cheaper than short taxi trips.",
  sydney: "Use contactless Opal fares and travel after the morning peak. Ferries double as scenic sightseeing without a separate cruise ticket.",
};

const foodInsights = {
  Thailand: "Try khao man gai, boat noodles, and market fruit. Busy stalls with visible turnover are usually the best-value choice.",
  Japan: "Look for lunch sets, neighborhood noodle counters, and department-store food halls near closing time.",
  Singapore: "Use hawker centres for chicken rice, laksa, and kaya toast. Return trays and choose stalls with clear posted prices.",
  Indonesia: "Choose local warungs for nasi campur, satay, and fresh fruit. Confirm seafood prices by weight before ordering.",
  Vietnam: "Street-side phở, bún chả, and bánh mì offer excellent value. Choose busy vendors and carry small notes.",
  Myanmar: "Try mohinga, tea-leaf salad, and local tea shops. Morning markets offer the freshest low-cost choices.",
  France: "Use bakeries, covered markets, and fixed-price lunch menus. A picnic can cost far less than dining beside major landmarks.",
  Italy: "Look for neighborhood trattorias, pizza al taglio, and aperitivo snacks away from landmark squares.",
  Spain: "Choose menú del día lunches, market counters, and shared tapas. Ask whether bread or terrace service adds a charge.",
  Malaysia: "Food courts and kopitiams make nasi lemak, roti canai, and noodle dishes easy to compare by price.",
  default: "Explore busy public markets and neighborhood lunch specials. Check posted prices and choose places with steady local traffic.",
};

const visaInsights = {
  Thailand: "Short visa-exempt stays are available to many passports. PackSwift will prompt you to confirm the current allowance for your nationality.",
  Japan: "Many passports qualify for short visa-free visits; others need a visa before departure. Confirm passport-specific rules before booking.",
  Singapore: "Entry permission varies by passport and may require an arrival declaration. Check validity and onward-travel requirements.",
  Indonesia: "Visa-free, visa-on-arrival, and eVisa rules vary by passport. Verify the correct route before travel.",
  Vietnam: "Many travelers use an eVisa, while some passports receive an exemption. Apply only through the official portal.",
  Myanmar: "Entry rules and available checkpoints can change. Review official visa and travel-advisory information before confirming the trip.",
  France: "Schengen rules apply. Confirm visa-free eligibility or obtain a Schengen visa, and keep proof of accommodation and onward travel.",
  Italy: "Schengen rules apply. Confirm visa-free eligibility or obtain a Schengen visa before departure.",
  Spain: "Schengen rules apply. Confirm visa-free eligibility or obtain a Schengen visa before departure.",
  Germany: "Schengen rules apply. Confirm visa-free eligibility or obtain a Schengen visa before departure.",
  Greece: "Schengen rules apply. Confirm visa-free eligibility or obtain a Schengen visa before departure.",
  Netherlands: "Schengen rules apply. Confirm visa-free eligibility or obtain a Schengen visa before departure.",
  default: "Entry permission depends on your passport, stay length, and purpose. PackSwift will guide you to verify the current official requirement.",
};

const guidePhotoPool = [
  "/images/activities/bangkok-temples.jpg",
  "/images/activities/chao-phraya.jpg",
  "/images/activities/bangkok-shopping.jpg",
  "/images/activities/bangkok-street-food.jpg",
  "/images/activities/chatuchak-market.jpg",
  "/images/activities/bangkok-skyline.jpg",
  "/images/activities/pattaya-beach.jpg",
];

const pocketGuideOverrides = {
  bangkok: {
    quickRule: "Temples in the morning · malls at midday · riverside and night markets after sunset.",
    dayZones: [
      { day: 1, title: "Old City Temples", area: "Rattanakosin", rule: "Start before 09:00 for cooler walks and lighter crowds." },
      { day: 2, title: "Shopping & Malls", area: "Siam–Chidlom", rule: "Use BTS links and save indoor stops for the hottest hours." },
      { day: 3, title: "River & Skyline", area: "Chao Phraya", rule: "Travel by ferry, then finish with a sunset skyline view." },
    ],
    timeline: [
      { day: 1, time: "08:30", name: "Grand Palace", tag: "Royal heritage", image: "/images/activities/bangkok-temples.jpg", transit: "10 min Walk" },
      { day: 1, time: "10:30", name: "Wat Pho", tag: "Temple & architecture", image: "/images/activities/bangkok-temples.jpg", transit: "8 min Tuk-tuk" },
      { day: 1, time: "13:00", name: "Old Town lunch stop", tag: "Local food", image: "/images/activities/bangkok-street-food.jpg", transit: "15 min Boat" },
      { day: 2, time: "10:00", name: "Jim Thompson House", tag: "Design & history", image: "/images/destination-bangkok.jpg", transit: "8 min Walk" },
      { day: 2, time: "12:30", name: "Siam Paragon", tag: "Mall & lunch", image: "/images/activities/bangkok-shopping.jpg", transit: "12 min BTS" },
      { day: 2, time: "16:30", name: "Chatuchak or Ari", tag: "Market & café", image: "/images/activities/chatuchak-market.jpg", transit: "22 min MRT" },
      { day: 3, time: "09:30", name: "Wat Arun", tag: "Riverside icon", image: "/images/activities/chao-phraya.jpg", transit: "5 min Ferry" },
      { day: 3, time: "13:00", name: "ICONSIAM", tag: "Food hall & river", image: "/images/activities/bangkok-shopping.jpg", transit: "18 min Boat" },
      { day: 3, time: "18:00", name: "Mahanakhon SkyWalk", tag: "Sunset skyline", image: "/images/activities/bangkok-skyline.jpg", transit: null },
    ],
    stayZones: [
      ["Siam", "First visit & shopping", "BTS interchange", "First-timers · Families"],
      ["Riverside", "Views & slower evenings", "Boat + BTS links", "Couples · Families"],
      ["Silom", "Food & central access", "BTS + MRT", "Solo · Couples"],
      ["Ari", "Cafés & local rhythm", "BTS", "Solo · Returning visitors"],
    ],
    routeOrder: "Old City → Siam → Riverside keeps each day geographically focused.",
    transportTip: "Use rail for cross-city movement and ferries for riverside landmarks.",
    avoid: "Avoid road transfers during 07:30–09:30 and 16:30–19:30 when possible.",
    highlights: [
      ["Tom Yum Goong", "Must-try bite", "/images/activities/bangkok-street-food.jpg"],
      ["Pad Thai", "Must-try bite", "/images/activities/bangkok-street-food.jpg"],
      ["Mango Sticky Rice", "Must-try bite", "/images/activities/chatuchak-market.jpg"],
      ["Boat Noodles", "Must-try bite", "/images/activities/bangkok-street-food.jpg"],
      ["Grand Palace", "Must-see spot", "/images/activities/bangkok-temples.jpg"],
      ["Wat Arun", "Must-see spot", "/images/activities/chao-phraya.jpg"],
      ["Wat Pho", "Must-see spot", "/images/activities/bangkok-temples.jpg"],
      ["ICONSIAM", "Must-see spot", "/images/activities/bangkok-shopping.jpg"],
      ["Chatuchak Market", "Must-see spot", "/images/activities/chatuchak-market.jpg"],
      ["Mahanakhon", "Must-see spot", "/images/activities/bangkok-skyline.jpg"],
      ["Chao Phraya Ferry", "Local experience", "/images/activities/chao-phraya.jpg"],
      ["Bang Krachao", "Green escape", "/images/activities/pattaya-beach.jpg"],
    ],
    hub: {
      center: "Siam Center",
      branches: [["Old City", "25 min", "Tuk-tuk / taxi"], ["Riverside", "22 min", "BTS + boat"], ["Chatuchak", "20 min", "BTS"], ["Ari", "12 min", "BTS"], ["Mahanakhon", "16 min", "BTS"]],
    },
  },
  "chiang-mai": {
    quickRule: "Old City on foot · Nimman for cafés · mountain sights before afternoon cloud and traffic.",
    dayZones: [
      { day: 1, title: "Old City Temples", area: "Historic Core", rule: "Walk the square early and dress for active temples." },
      { day: 2, title: "Mountain & Nimman", area: "West Chiang Mai", rule: "Reach Doi Suthep early, then descend for cafés and galleries." },
      { day: 3, title: "Markets & Nature", area: "North & East", rule: "Cluster a market morning with one nature stop outside town." },
    ],
    stayZones: [
      ["Old City", "Temples & walking", "Walk + songthaew", "First-timers · Solo"],
      ["Nimman", "Cafés & nightlife", "Ride app + songthaew", "Couples · Digital nomads"],
      ["Riverside", "Quiet views", "Taxi + local shuttle", "Couples · Families"],
      ["Night Bazaar", "Markets & convenience", "Walk + songthaew", "Families · Groups"],
    ],
    routeOrder: "Old City → western mountain → northern markets avoids repeated cross-town drives.",
    transportTip: "Agree on songthaew fares before boarding and book mountain transfers as a return journey.",
    avoid: "Avoid an unplanned Doi Suthep trip at sunset; return transport can be limited.",
    hub: {
      center: "Old City Center",
      branches: [["Nimman", "10 min", "Drive"], ["Doi Suthep", "30 min", "Drive"], ["Night Bazaar", "12 min", "Songthaew"], ["Jing Jai Market", "15 min", "Drive"], ["Night Safari", "50 min", "Drive"]],
    },
  },
};

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
let destinations = [];
let visibleDestinations = [];
let activeFilter = "all";
let activeDestination = null;
let previewDestination = null;
let previewTrigger = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function bestSeason(destination) {
  return (destination.bestMonths || []).map((month) => monthNames[month - 1]).filter(Boolean).join(", ") || "Year-round";
}

function dailyCost(destination) {
  const base = Math.max(20, Number(destination.dailyBudgetUsd) || 75);
  return `$${Math.round(base * 0.8)}–$${Math.round(base * 1.15)}/day`;
}

function isBudgetSaver(destination) {
  return Number(destination.dailyBudgetUsd) * 3 < 350;
}

function popularityScore(destination) {
  const trendIndex = trendingSlugs.indexOf(destination.slug);
  const trendScore = trendIndex === -1 ? 0 : 100 - trendIndex * 5;
  return trendScore + Number(destination.familyScore || 0) * 2 + Number(destination.businessScore || 0);
}

function popularityTag(destination) {
  if (trendingSlugs.includes(destination.slug)) return "Trending";
  if (isBudgetSaver(destination)) return "Budget Saver";
  return "Popular";
}

function purposeFor(destination) {
  if (destination.interests.includes("food")) return "Food & Nightlife";
  if (destination.interests.includes("culture")) return "Culture & Heritage";
  if (destination.interests.some((interest) => ["nature", "coast", "adventure"].includes(interest))) return "Adventure & Outdoor";
  return "Leisure & Relaxation";
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function originFor(destination) {
  let storedOrigin = "Yangon";
  try {
    const latest = JSON.parse(localStorage.getItem("packswift.latest-plan.v1") || "null");
    storedOrigin = latest?.input?.origin || latest?.input?.route?.origin?.name || storedOrigin;
  } catch {
    // The safe default still creates a complete planner handoff.
  }
  return storedOrigin.toLowerCase().includes(destination.name.toLowerCase())
    ? "Bangkok"
    : storedOrigin;
}

function transitBaseline(destination) {
  if (destination.country === "Thailand") return 110;
  if (["Myanmar", "Vietnam", "Malaysia", "Singapore", "Indonesia", "Philippines"].includes(destination.country)) return 220;
  if (destination.region === "Asia") return 450;
  if (destination.region === "Middle East") return 600;
  return 750;
}

function recommendationFor(destination, guide = pocketGuideFor(destination)) {
  const start = new Date();
  start.setDate(start.getDate() + 30);
  const end = new Date(start);
  end.setDate(end.getDate() + 3);
  const totalBudget = Math.ceil((Number(destination.dailyBudgetUsd) * 4 + transitBaseline(destination)) / 50) * 50;
  return {
    scope: "Worldwide",
    origin: originFor(destination),
    destination: `${destination.name}, ${destination.country}`,
    start_date: formatDate(start),
    end_date: formatDate(end),
    total_budget: Math.max(500, totalBudget),
    currency: "USD",
    adults_count: 1,
    children_count: 0,
    pet_included: false,
    travel_purpose: purposeFor(destination),
    travel_group: "Solo",
    travel_pace: "Balanced & Steady",
    summary_pitch: `${destination.name} matches a balanced four-day discovery trip with an estimated ${dailyCost(destination)} local budget.`,
    curated_route: guide.timeline.map(({ day, time, name, tag, transit }) => ({ day, time, name, tag, transit })),
  };
}

function planDestination(destination) {
  const guide = pocketGuideFor(destination);
  const recommendation = recommendationFor(destination, guide);
  sessionStorage.setItem("packswift.guide.selected-destination", JSON.stringify({
    slug: destination.slug,
    name: destination.name,
    country: destination.country,
    selectedAt: new Date().toISOString(),
  }));
  sessionStorage.setItem("pending_ai_trip", JSON.stringify(recommendation));
  sessionStorage.setItem("pending_ai_trip_mode", "guest_preview");
  sessionStorage.setItem("packswift.guide.exact-itinerary", JSON.stringify({
    destination: destination.slug,
    route: recommendation.curated_route,
  }));
  window.location.assign("/trip-planner?pending_ai_trip=1&preview=guide");
}

function insightFor(destination) {
  return {
    transit: transitInsights[destination.slug] || `Use ${destination.name} public transport or official ride apps, and group nearby attractions to reduce repeat fares.`,
    food: foodInsights[destination.country] || foodInsights.default,
    visa: `${visaInsights[destination.country] || visaInsights.default} ${destination.culturalNotes?.[0] || "Follow local signs and dress expectations."}`,
  };
}

function updateInsights(destination) {
  if (!destination) return;
  activeDestination = destination;
  const insight = insightFor(destination);
  document.querySelector("#guide-insight-code").textContent = destination.code;
  document.querySelector("#guide-insight-title").textContent = `${destination.name}, ${destination.country}`;
  document.querySelector("#guide-insight-intro").textContent = `Practical ideas for seeing more of ${destination.name} without wasting time or budget.`;
  document.querySelector("#guide-insight-season").textContent = bestSeason(destination);
  document.querySelector("#guide-insight-cost").textContent = dailyCost(destination);
  document.querySelector("#guide-insight-transit").textContent = insight.transit;
  document.querySelector("#guide-insight-food").textContent = insight.food;
  document.querySelector("#guide-insight-visa").textContent = insight.visa;
  for (const card of document.querySelectorAll("[data-guide-destination]")) {
    card.classList.toggle("is-selected", card.dataset.guideDestination === destination.slug);
    card.setAttribute("aria-current", card.dataset.guideDestination === destination.slug ? "true" : "false");
  }
}

function packingTips(destination) {
  const tips = ["Comfortable walking shoes", "Reusable water bottle"];
  if (["high", "moderate"].includes(destination.rain)) tips.push("Compact rain layer");
  if (["tropical", "equatorial", "monsoon", "desert"].includes(destination.climateProfile)) tips.push("Sun protection and breathable layers");
  else tips.push("Light layers for changing temperatures");
  if (destination.interests.includes("culture")) tips.push("Modest layer for cultural sites");
  if (destination.interests.includes("coast")) tips.push("Swimwear and dry bag");
  return tips.slice(0, 5);
}

function pocketImage(destination, index = 0) {
  return destinationImages[destination.slug] || guidePhotoPool[index % guidePhotoPool.length];
}

function pocketGuideFor(destination) {
  const sourceSpots = [
    ...(destination.attractions || []),
    ...(destination.activityPreviews || []).map((activity) => activity.title),
  ];
  while (sourceSpots.length < 9) {
    sourceSpots.push(`${destination.name} ${["local market", "heritage walk", "food quarter", "scenic viewpoint", "neighborhood café"][sourceSpots.length % 5]}`);
  }
  const genericTimeline = sourceSpots.slice(0, 9).map((name, index) => ({
    day: Math.floor(index / 3) + 1,
    time: ["09:00", "12:30", "17:30"][index % 3],
    name,
    tag: ["Morning icon", "Local discovery", "Evening atmosphere"][index % 3],
    image: pocketImage(destination, index),
    transit: index === 8 ? null : [["10 min", "Walk"], ["15 min", "Local transit"], ["20 min", "Taxi / ride app"]][index % 3].join(" "),
  }));
  const genericHighlights = Array.from({ length: 12 }, (_, index) => {
    const attraction = sourceSpots[index % sourceSpots.length];
    const category = index < 4 ? "Local bite or market" : index < 9 ? "Must-see spot" : "Local experience";
    return [attraction, category, pocketImage(destination, index)];
  });
  const generic = {
    quickRule: "Major sights in the morning · indoor or shaded stops at midday · food districts and viewpoints in the evening.",
    dayZones: [
      { day: 1, title: "Historic Core", area: "Central landmarks", rule: "Start with the oldest sights while streets are quieter." },
      { day: 2, title: "Local Life", area: "Markets & neighborhoods", rule: "Cluster food, shopping, and creative stops by district." },
      { day: 3, title: "Nature & Views", area: "Outer highlights", rule: "Reserve the longer transfer for one focused day." },
    ],
    timeline: genericTimeline,
    stayZones: [
      ["City Centre", "Landmarks & convenience", "Main transit interchange", "First-timers · Families"],
      ["Old Quarter", "Culture & walking", "Walk + local transit", "Solo · Couples"],
      ["Riverside", "Views & calm evenings", "Ferry / local transit", "Couples · Families"],
      ["Creative District", "Food & local rhythm", "Metro / ride app", "Solo · Returning visitors"],
    ],
    routeOrder: "Central heritage → local neighborhoods → outer highlight keeps transfers predictable.",
    transportTip: `Group nearby ${destination.name} sights and compare day passes with single fares.`,
    avoid: "Avoid stacking distant landmarks on the same day or relying on rush-hour road transfers.",
    highlights: genericHighlights,
    hub: {
      center: `${destination.name} Centre`,
      branches: sourceSpots.slice(0, 5).map((name, index) => [name, `${10 + index * 8} min`, index < 2 ? "Walk / transit" : "Drive / transit"]),
    },
  };
  const override = pocketGuideOverrides[destination.slug] || {};
  return {
    ...generic,
    ...override,
    timeline: override.timeline || generic.timeline,
    highlights: override.highlights || generic.highlights,
    hub: override.hub || generic.hub,
  };
}

function summaryCard(title, copy) {
  const card = element("article", "pocket-summary-card");
  card.append(element("span", "", "✓"), element("h4", "", title), element("p", "", copy));
  return card;
}

function switchPocketTab(tabName, focus = false) {
  const tabs = [...document.querySelectorAll("[data-pocket-tab]")];
  for (const tab of tabs) {
    const selected = tab.dataset.pocketTab === tabName;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  }
  for (const panel of document.querySelectorAll("[data-pocket-panel]")) {
    panel.hidden = panel.dataset.pocketPanel !== tabName;
  }
}

function renderPocketTimeline(guide, selectedDay = null) {
  const timeline = document.querySelector("#pocket-timeline");
  const items = selectedDay ? guide.timeline.filter((item) => item.day === selectedDay) : guide.timeline;
  timeline.replaceChildren(...items.flatMap((item, index) => {
    const entry = element("article", "pocket-timeline-entry");
    const marker = element("div", "pocket-timeline-marker");
    marker.append(element("span", "", item.time), element("i", ""));
    const copy = element("div", "pocket-timeline-copy");
    copy.append(element("small", "", `Day ${item.day}`), element("h4", "", item.name), element("p", "", item.tag));
    const image = document.createElement("img");
    image.src = item.image;
    image.alt = `${item.name} travel preview`;
    image.width = 240;
    image.height = 160;
    image.loading = "lazy";
    entry.append(marker, copy, image);
    const nodes = [entry];
    if (item.transit && index < items.length - 1) {
      const transit = element("div", "pocket-transit", `↳ ${item.transit}`);
      nodes.push(transit);
    }
    return nodes;
  }));
}

function activeSavedTripId() {
  const plans = [];
  for (const key of ["packswift.latest-plan.v1", "packswift.trips.v1"]) {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "null");
      if (Array.isArray(stored)) plans.push(...stored.slice().reverse());
      else if (stored) plans.push(stored);
    } catch {
      // A malformed device cache should not prevent guide browsing.
    }
  }
  return plans.find((plan) => plan?.persistence?.saved && plan.persistence.tripId)?.persistence?.tripId || null;
}

function catalogPlaceId(destination, name) {
  const safeName = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
  return `packswift:${destination.slug}:${safeName}`;
}

async function addPocketSpot(destination, name, button) {
  const status = document.querySelector("#pocket-guide-status");
  status.className = "pocket-guide-status";
  status.textContent = "";
  const user = await window.PackSwift.authReady;
  if (!user) {
    status.textContent = "Log in and save a trip before adding this highlight.";
    return;
  }
  const tripId = activeSavedTripId();
  if (!tripId) {
    status.textContent = "Create or open a saved trip first, then return to add this highlight.";
    return;
  }
  button.disabled = true;
  button.textContent = "Adding…";
  try {
    const result = await window.PackSwift.api("/api/trip/plan/add", {
      method: "POST",
      body: JSON.stringify({
        trip_id: tripId,
        place_id: catalogPlaceId(destination, name),
        provider: "packswift_catalog",
      }),
    });
    button.classList.add("is-added");
    button.textContent = "Added ✓";
    status.className = "pocket-guide-status is-success";
    status.textContent = result.message || `${name} was added to your active trip.`;
  } catch (error) {
    button.disabled = false;
    button.textContent = "+ Add to trip";
    status.textContent = error.message || "This highlight could not be added yet.";
  }
}

function renderPocketGuide(destination, guide) {
  document.querySelector("#pocket-route-intro").textContent = `A compact three-day route for ${destination.name}, organized to reduce backtracking and wasted transit.`;
  const zones = document.querySelector("#pocket-day-zones");
  zones.replaceChildren(...guide.dayZones.map((zone) => {
    const button = element("button", "pocket-day-zone");
    button.type = "button";
    button.setAttribute("aria-label", `Show Day ${zone.day} timeline: ${zone.title}`);
    button.append(element("span", "pocket-day-number", `D${zone.day}`), element("strong", "", zone.title), element("small", "", zone.area), element("p", "", zone.rule));
    button.addEventListener("click", () => {
      renderPocketTimeline(guide, zone.day);
      switchPocketTab("timeline", true);
    });
    return button;
  }));
  const rule = document.querySelector("#pocket-quick-rule");
  rule.replaceChildren(element("span", "", "FAST RULE"), element("strong", "", guide.quickRule));
  document.querySelector("#pocket-route-cards").replaceChildren(
    summaryCard("Route Order", guide.routeOrder),
    summaryCard("Transport Tips", guide.transportTip),
    summaryCard("What to Avoid", guide.avoid),
  );

  renderPocketTimeline(guide);
  const stayRows = document.querySelector("#pocket-stay-rows");
  stayRows.replaceChildren(...guide.stayZones.map((row) => {
    const tr = document.createElement("tr");
    tr.append(...row.map((value, index) => element(index === 0 ? "th" : "td", "", value)));
    tr.firstElementChild.scope = "row";
    return tr;
  }));
  document.querySelector("#pocket-stay-tips").replaceChildren(
    summaryCard("Route Order", guide.routeOrder),
    summaryCard("Transport Tips", guide.transportTip),
    summaryCard("What to Avoid", guide.avoid),
  );

  const highlights = document.querySelector("#pocket-highlight-grid");
  highlights.replaceChildren(...guide.highlights.map(([name, type, imagePath], index) => {
    const card = element("article", "pocket-highlight-card");
    const image = document.createElement("img");
    image.src = imagePath;
    image.alt = `${name} in ${destination.name}`;
    image.width = 320;
    image.height = 220;
    image.loading = "lazy";
    const number = element("span", "pocket-highlight-number", String(index + 1).padStart(2, "0"));
    const body = element("div", "pocket-highlight-copy");
    body.append(element("small", "", type), element("h4", "", name));
    const addButton = element("button", "pocket-add-button", "+ Add to trip");
    addButton.type = "button";
    addButton.addEventListener("click", () => addPocketSpot(destination, name, addButton));
    body.append(addButton);
    card.append(image, number, body);
    return card;
  }));

  const map = document.querySelector("#pocket-radial-map");
  const hub = element("div", "pocket-hub-node");
  hub.append(element("small", "", "TRAVEL HUB"), element("strong", "", guide.hub.center));
  const branches = guide.hub.branches.map(([name, duration, mode], index) => {
    const branch = element("article", `pocket-hub-branch branch-${index + 1}`);
    branch.append(element("span", "pocket-hub-line"), element("strong", "", name), element("small", "", `${duration} · ${mode}`));
    return branch;
  });
  map.replaceChildren(hub, ...branches);
}

function setPreviewOpen(open) {
  previewDrawer.setAttribute("aria-hidden", String(!open));
  previewBackdrop.hidden = !open;
  document.body.classList.toggle("guide-preview-open", open);
  if (open) previewDrawer.querySelector("#close-guide-preview").focus();
  else previewTrigger?.focus();
}

function openPreview(destination, trigger) {
  previewDestination = destination;
  previewTrigger = trigger;
  updateInsights(destination);
  const guide = pocketGuideFor(destination);
  document.querySelector("#guide-preview-title").textContent = `${destination.name} Pocket Guide`;
  document.querySelector("#guide-preview-summary").textContent = `${destination.country} · ${dailyCost(destination)} · best in ${bestSeason(destination)}`;
  document.querySelector("#pocket-guide-status").textContent = "";
  renderPocketGuide(destination, guide);
  const packingList = document.querySelector("#guide-preview-packing-list");
  packingList.replaceChildren(...packingTips(destination).map((tip) => element("li", "", tip)));
  switchPocketTab("route");
  setPreviewOpen(true);
}

function createDestinationCard(destination) {
  const card = element("article", "guide-discovery-card");
  card.dataset.guideDestination = destination.slug;
  card.tabIndex = 0;
  card.setAttribute("aria-label", `Explore ${destination.name}, ${destination.country}`);

  const visual = element("div", "guide-card-visual");
  const imagePath = destinationImages[destination.slug];
  if (imagePath) {
    const image = document.createElement("img");
    image.src = imagePath;
    image.alt = "";
    image.width = 800;
    image.height = 600;
    image.loading = "lazy";
    visual.append(image);
  } else {
    visual.classList.add(`region-${destination.region.toLowerCase().replace(/\s+/g, "-")}`);
    visual.append(element("span", "guide-card-code", destination.code));
  }
  const badgeRow = element("div", "guide-card-badges");
  badgeRow.append(
    element("span", `guide-popularity-badge ${isBudgetSaver(destination) ? "is-budget" : ""}`, popularityTag(destination)),
    element("span", "guide-visa-badge", "🛂 Visa guide ready"),
  );
  visual.append(badgeRow);

  const body = element("div", "guide-card-body");
  const location = element("div", "guide-card-location");
  location.append(element("div", "", `${destination.country} · ${destination.region}`));
  const title = element("h2", "", destination.name);
  const summary = element("p", "", `Discover ${destination.attractions.slice(0, 3).join(", ")}.`);
  const facts = element("dl", "guide-card-facts");
  const cost = element("div");
  cost.append(element("dt", "", "Daily estimate"), element("dd", "", dailyCost(destination)));
  const season = element("div");
  season.append(element("dt", "", "Best season"), element("dd", "", bestSeason(destination)));
  facts.append(cost, season);
  const tags = element("div", "tag-row");
  for (const interest of destination.interests.slice(0, 3)) {
    tags.append(element("span", "tag", interest[0].toUpperCase() + interest.slice(1)));
  }
  const actions = element("div", "guide-card-actions");
  const plan = element("button", "button button-primary", "⚡ Plan in 1-Click");
  plan.type = "button";
  plan.addEventListener("click", (event) => {
    event.stopPropagation();
    planDestination(destination);
  });
  const preview = element("button", "button button-secondary", "Open Pocket Guide");
  preview.type = "button";
  preview.addEventListener("click", (event) => {
    event.stopPropagation();
    openPreview(destination, preview);
  });
  actions.append(plan, preview);
  body.append(location, title, summary, facts, tags, actions);
  card.append(visual, body);
  card.addEventListener("mouseenter", () => updateInsights(destination));
  card.addEventListener("focusin", () => updateInsights(destination));
  card.addEventListener("click", () => updateInsights(destination));
  return card;
}

function matchesFilter(destination) {
  if (activeFilter === "trending") return trendingSlugs.includes(destination.slug);
  if (activeFilter === "budget") return isBudgetSaver(destination);
  if (activeFilter === "food-culture") return destination.interests.includes("food") || destination.interests.includes("culture");
  if (activeFilter === "nature-beach") return destination.interests.some((interest) => ["nature", "coast", "adventure"].includes(interest));
  return true;
}

function sortDestinations(list) {
  const sorted = [...list];
  if (guideSort.value === "budget-low") sorted.sort((a, b) => a.dailyBudgetUsd - b.dailyBudgetUsd);
  else if (guideSort.value === "budget-high") sorted.sort((a, b) => b.dailyBudgetUsd - a.dailyBudgetUsd);
  else if (guideSort.value === "popular") sorted.sort((a, b) => popularityScore(b) - popularityScore(a));
  else if (guideSort.value === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
  else sorted.sort((a, b) => popularityScore(b) - popularityScore(a) || a.dailyBudgetUsd - b.dailyBudgetUsd);
  return sorted;
}

function renderDestinations() {
  const query = guideSearch.value.trim().toLowerCase();
  visibleDestinations = sortDestinations(destinations.filter((destination) => {
    const searchable = [destination.name, destination.country, destination.region, ...destination.interests, ...destination.attractions].join(" ").toLowerCase();
    return matchesFilter(destination) && (!query || searchable.includes(query));
  }));
  guideContainer.replaceChildren();
  if (!visibleDestinations.length) {
    const empty = element("div", "empty-state guide-empty-state");
    empty.append(element("h2", "", "No destinations match"), element("p", "", "Try a broader search or another discovery filter."));
    guideContainer.append(empty);
  } else {
    guideContainer.append(...visibleDestinations.map(createDestinationCard));
    const nextActive = visibleDestinations.find((destination) => destination.slug === activeDestination?.slug) || visibleDestinations[0];
    updateInsights(nextActive);
  }
  guideCount.textContent = `${visibleDestinations.length} ${visibleDestinations.length === 1 ? "destination" : "destinations"}`;
}

for (const button of guideButtons) {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    guideButtons.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    renderDestinations();
  });
}

guideSearch.addEventListener("input", renderDestinations);
guideSort.addEventListener("change", renderDestinations);
document.querySelector("#guide-sidebar-plan").addEventListener("click", () => activeDestination && planDestination(activeDestination));
document.querySelector("#guide-preview-plan").addEventListener("click", () => previewDestination && planDestination(previewDestination));
document.querySelector("#close-guide-preview").addEventListener("click", () => setPreviewOpen(false));
document.querySelector("#guide-preview-close-secondary").addEventListener("click", () => setPreviewOpen(false));
for (const tab of document.querySelectorAll("[data-pocket-tab]")) {
  tab.addEventListener("click", () => switchPocketTab(tab.dataset.pocketTab));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...document.querySelectorAll("[data-pocket-tab]")];
    const currentIndex = tabs.indexOf(tab);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    switchPocketTab(tabs[nextIndex].dataset.pocketTab, true);
  });
}
previewBackdrop.addEventListener("click", () => setPreviewOpen(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && previewDrawer.getAttribute("aria-hidden") === "false") setPreviewOpen(false);
});

fetch("/data/destinations.json")
  .then((response) => {
    if (!response.ok) throw new Error("Destination discovery is temporarily unavailable. Try again shortly.");
    return response.json();
  })
  .then((catalog) => {
    destinations = catalog;
    activeDestination = destinations.find((destination) => destination.slug === "bangkok") || destinations[0];
    renderDestinations();
  })
  .catch((error) => {
    guideContainer.replaceChildren(element("p", "status-banner status-error", error.message));
    guideCount.textContent = "Unavailable";
    insightsCard.hidden = true;
  });
