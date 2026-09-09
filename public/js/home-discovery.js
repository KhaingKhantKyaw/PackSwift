const homeDestinationGrid = document.querySelector("#home-destination-grid");
const homeDestinationSearch = document.querySelector("#home-destination-search");
const homeDestinationCount = document.querySelector("#home-destination-count");
const homeDestinationFilters = [...document.querySelectorAll("[data-home-filter]")];

const homeFeaturedSlugs = ["bangkok", "tokyo", "singapore", "bali", "paris", "hanoi"];
const homeDestinationImages = {
  bangkok: "/images/destination-bangkok.jpg",
  tokyo: "/images/destination-tokyo.jpg",
  singapore: "/images/destination-singapore.jpg",
  bali: "/images/destination-bali.jpg",
  paris: "/images/destination-paris.jpg",
};
const homeMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let homeDestinations = [];
let homeActiveFilter = "featured";

function homeNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function homeBestSeason(destination) {
  const months = (destination.bestMonths || [])
    .slice(0, 3)
    .map((month) => homeMonthNames[month - 1])
    .filter(Boolean);
  return months.join(" · ") || "Year-round";
}

function homeDailyCost(destination) {
  const daily = Math.max(20, Number(destination.dailyBudgetUsd) || 75);
  return `$${Math.round(daily * 0.8)}–$${Math.round(daily * 1.15)}/day`;
}

function homePurpose(destination) {
  const interests = destination.interests || [];
  if (interests.includes("food")) return "Food & Nightlife";
  if (interests.includes("culture")) return "Culture & Heritage";
  if (interests.some((interest) => ["nature", "coast", "adventure"].includes(interest))) return "Adventure & Outdoor";
  return "Leisure & Relaxation";
}

function homeFormatDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function homeOriginFor(destination) {
  try {
    const latest = JSON.parse(localStorage.getItem("packswift.latest-plan.v1") || "null");
    const origin = latest?.input?.origin || latest?.input?.route?.origin?.name || "Yangon";
    return origin.toLowerCase().includes(destination.name.toLowerCase()) ? "Bangkok" : origin;
  } catch {
    return "Yangon";
  }
}

function homeTransitEstimate(destination) {
  if (destination.country === "Thailand") return 110;
  if (["Myanmar", "Vietnam", "Malaysia", "Singapore", "Indonesia", "Philippines"].includes(destination.country)) return 220;
  if (destination.region === "Asia") return 450;
  if (destination.region === "Middle East") return 600;
  return 750;
}

function planFromHome(destination) {
  const start = new Date();
  start.setDate(start.getDate() + 30);
  const end = new Date(start);
  end.setDate(end.getDate() + 3);
  const estimatedBudget = Math.ceil((Number(destination.dailyBudgetUsd) * 4 + homeTransitEstimate(destination)) / 50) * 50;
  const recommendation = {
    scope: "Worldwide",
    origin: homeOriginFor(destination),
    destination: `${destination.name}, ${destination.country}`,
    start_date: homeFormatDate(start),
    end_date: homeFormatDate(end),
    total_budget: Math.max(500, estimatedBudget),
    currency: "USD",
    adults_count: 1,
    children_count: 0,
    pet_included: false,
    travel_purpose: homePurpose(destination),
    travel_group: "Solo",
    travel_pace: "Balanced & Steady",
    summary_pitch: `${destination.name} is a strong four-day match with a typical local budget of ${homeDailyCost(destination)}.`,
  };

  sessionStorage.setItem("packswift.guide.selected-destination", JSON.stringify({
    slug: destination.slug,
    name: destination.name,
    country: destination.country,
    selectedAt: new Date().toISOString(),
  }));
  sessionStorage.setItem("pending_ai_trip", JSON.stringify(recommendation));
  sessionStorage.setItem("pending_ai_trip_mode", "guest_preview");
  window.location.assign("/trip-planner?pending_ai_trip=1&preview=home-guide");
}

function createHomeDestinationCard(destination) {
  const card = homeNode("article", "home-destination-card");
  const visual = homeNode("a", "home-destination-visual");
  visual.href = `/travel-guide?destination=${encodeURIComponent(destination.slug)}`;
  visual.setAttribute("aria-label", `Open the ${destination.name} travel guide`);

  const imagePath = homeDestinationImages[destination.slug];
  if (imagePath) {
    const image = document.createElement("img");
    image.src = imagePath;
    image.alt = `${destination.name}, ${destination.country}`;
    image.width = 800;
    image.height = 600;
    image.loading = "lazy";
    visual.append(image);
  } else {
    visual.classList.add(`region-${String(destination.region).toLowerCase().replace(/\s+/g, "-")}`);
    visual.append(homeNode("span", "home-destination-code", destination.code));
  }

  const location = homeNode("div", "home-destination-location");
  location.append(
    homeNode("span", "", destination.country),
    homeNode("h3", "", destination.name),
  );
  visual.append(location);

  const body = homeNode("div", "home-destination-body");
  const facts = homeNode("div", "home-destination-facts");
  const cost = homeNode("span", "");
  cost.append(homeNode("small", "", "Typical spend"), homeNode("strong", "", homeDailyCost(destination)));
  const season = homeNode("span", "");
  season.append(homeNode("small", "", "Best months"), homeNode("strong", "", homeBestSeason(destination)));
  facts.append(cost, season);

  const highlights = homeNode(
    "p",
    "home-destination-highlights",
    (destination.attractions || []).slice(0, 3).join(" · ") || "Local highlights and practical travel guidance",
  );
  const actions = homeNode("div", "home-destination-actions");
  const plan = homeNode("button", "home-destination-plan", "Plan this trip");
  plan.type = "button";
  plan.addEventListener("click", () => planFromHome(destination));
  const guide = homeNode("a", "home-destination-guide", "View guide →");
  guide.href = `/travel-guide?destination=${encodeURIComponent(destination.slug)}`;
  actions.append(plan, guide);
  body.append(facts, highlights, actions);
  card.append(visual, body);
  return card;
}

function homeMatchesFilter(destination) {
  const interests = destination.interests || [];
  if (homeActiveFilter === "featured") return homeFeaturedSlugs.includes(destination.slug);
  if (homeActiveFilter === "budget") return Number(destination.dailyBudgetUsd) <= 85;
  if (homeActiveFilter === "food") return interests.includes("food") || interests.includes("culture");
  if (homeActiveFilter === "nature") return interests.some((interest) => ["nature", "coast", "adventure"].includes(interest));
  return true;
}

function renderHomeDestinations() {
  const query = homeDestinationSearch.value.trim().toLowerCase();
  let matches = homeDestinations.filter((destination) => {
    const searchable = [destination.name, destination.country, destination.region, ...(destination.interests || []), ...(destination.attractions || [])]
      .join(" ")
      .toLowerCase();
    return homeMatchesFilter(destination) && (!query || searchable.includes(query));
  });

  if (homeActiveFilter === "featured") {
    matches.sort((a, b) => homeFeaturedSlugs.indexOf(a.slug) - homeFeaturedSlugs.indexOf(b.slug));
  } else {
    matches.sort((a, b) => Number(a.dailyBudgetUsd) - Number(b.dailyBudgetUsd));
  }
  matches = matches.slice(0, 6);

  homeDestinationGrid.replaceChildren();
  if (!matches.length) {
    const empty = homeNode("div", "home-destination-empty");
    empty.append(homeNode("strong", "", "No close matches yet."), homeNode("p", "", "Try another place or a broader travel style."));
    homeDestinationGrid.append(empty);
  } else {
    homeDestinationGrid.append(...matches.map(createHomeDestinationCard));
  }
  homeDestinationCount.textContent = `${matches.length} ${matches.length === 1 ? "place" : "places"} to explore`;
}

for (const filter of homeDestinationFilters) {
  filter.addEventListener("click", () => {
    homeActiveFilter = filter.dataset.homeFilter;
    homeDestinationFilters.forEach((button) => button.setAttribute("aria-pressed", String(button === filter)));
    renderHomeDestinations();
  });
}

homeDestinationSearch.addEventListener("input", () => {
  if (homeDestinationSearch.value.trim()) {
    homeActiveFilter = "all";
    homeDestinationFilters.forEach((button) => button.setAttribute("aria-pressed", "false"));
  }
  renderHomeDestinations();
});

fetch("/data/destinations.json")
  .then((response) => {
    if (!response.ok) throw new Error("Destination ideas are taking a little longer to load.");
    return response.json();
  })
  .then((catalog) => {
    homeDestinations = catalog;
    renderHomeDestinations();
  })
  .catch((error) => {
    homeDestinationCount.textContent = "Travel Guide temporarily unavailable";
    const message = homeNode("p", "home-destination-empty", error.message);
    homeDestinationGrid.replaceChildren(message);
  });
