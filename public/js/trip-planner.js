const plannerForm = document.querySelector("#trip-planner-form");
const plannerFeedback = document.querySelector("#planner-feedback");
const emptyResult = document.querySelector("#result-empty");
const planResult = document.querySelector("#plan-result");
const saveTripButton = document.querySelector("#save-trip-button");
const createPackingListButton = document.querySelector(
  "#create-packing-list-button",
);
const assistReadyButton = document.querySelector("#assist-ready-button");
const saveTripFeedback = document.querySelector("#save-trip-feedback");
const tripLoginRequiredDialog = document.querySelector(
  "#trip-login-required-dialog",
);
const tripLoginLink = document.querySelector("#trip-login-link");
const tripSignupLink = document.querySelector("#trip-signup-link");
const originSearch = document.querySelector("#origin-search");
const destinationSearch = document.querySelector("#destination-search");
const domesticDestinationInput = document.querySelector("#domestic-destination");
const destinationField = document.querySelector("#destination-field");
const destinationFieldHint = document.querySelector("#destination-field-hint");
const budgetInput = document.querySelector("#budget");
const currencyInput = document.querySelector("#currency");
const budgetField = document.querySelector(".budget-field");
const budgetCurrencySymbol = document.querySelector("#budget-currency-symbol");
const adultInput = document.querySelector("#adults");
const childInput = document.querySelector("#children");
const tripNotesInput = document.querySelector("#trip-notes");
const budgetMinimumHint = document.querySelector("#budget-minimum-hint");
const budgetInfoTitle = document.querySelector("#budget-info-title");
const budgetInfoRoute = document.querySelector("#budget-info-route");
const budgetInfoAmount = document.querySelector("#budget-info-amount");
const budgetInfoDetail = document.querySelector("#budget-info-detail");
const startDateInput = document.querySelector("#start-date");
const endDateInput = document.querySelector("#end-date");
const startDateDisplay = document.querySelector("#start-date-display");
const endDateDisplay = document.querySelector("#end-date-display");
const startDatePicker = document.querySelector("#start-date-picker");
const endDatePicker = document.querySelector("#end-date-picker");
const POPULAR_DESTINATIONS = [
  { id: "bkk", city: "Bangkok", country: "Thailand", attraction: "Wat Arun & Grand Palace", code: "BKK", image: "/images/destination-bangkok.jpg" },
  { id: "tyo", city: "Tokyo", country: "Japan", attraction: "Senso-ji Temple & Mt. Fuji View", code: "TYO", image: "/images/destination-tokyo.jpg" },
  { id: "sin", city: "Singapore", country: "Singapore", attraction: "Marina Bay Sands & Gardens", code: "SIN", image: "/images/destination-singapore.jpg" },
  { id: "dps", city: "Bali", country: "Indonesia", attraction: "Uluwatu Temple & Beaches", code: "DPS", image: "/images/destination-bali.jpg" },
  { id: "par", city: "Paris", country: "France", attraction: "Eiffel Tower & Louvre Museum", code: "PAR", image: "/images/destination-paris.jpg" },
];

function popularDestinationCard(destination) {
  const button = document.createElement("button");
  button.className = "featured-preset";
  button.type = "button";
  button.dataset.featuredDestination = destination.city;
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-label", `Choose ${destination.city}, ${destination.country}`);

  const image = document.createElement("img");
  image.src = destination.image;
  image.alt = "";
  image.width = 800;
  image.height = 600;
  image.loading = "lazy";
  image.decoding = "async";

  const shade = document.createElement("span");
  shade.className = "featured-preset-shade";
  shade.setAttribute("aria-hidden", "true");

  const meta = document.createElement("span");
  meta.className = "featured-preset-meta";
  const code = document.createElement("span");
  code.className = "featured-preset-code";
  code.textContent = destination.code;
  const country = document.createElement("span");
  country.className = "featured-preset-country";
  country.textContent = destination.country;
  meta.append(code, country);

  const copy = document.createElement("span");
  copy.className = "featured-preset-copy";
  const city = document.createElement("strong");
  city.textContent = destination.city;
  const attraction = document.createElement("small");
  attraction.textContent = destination.attraction;
  copy.append(city, attraction);

  button.append(image, shade, meta, copy);
  return button;
}

document.querySelector("#popular-destination-grid").replaceChildren(
  ...POPULAR_DESTINATIONS.map(popularDestinationCard),
);
const featuredPresets = [...document.querySelectorAll("[data-featured-destination]")];
const storageKey = "packswift.trips.v1";
const latestPlanKey = "packswift.latest-plan.v1";
const conciergeGeneratedTripKey = "packswift.concierge.generated-trip.v1";
const pendingPackswiftTripKey = "pending_packswift_trip";
const legacyPendingAiTripKey = "pending_ai_trip";
const pendingAiTripModeKey = "pending_ai_trip_mode";
const authRedirectTargetKey = "auth_redirect_target";
const packingHandoffKey = "packswift.packing-context.v1";
const pendingTripSaveKey = "packswift.pending-trip-save.v1";
const liveActivityGrid = document.querySelector("#live-activity-grid");
const liveActivityStatus = document.querySelector("#live-activity-status");
const selectedPlacesSection = document.querySelector("#selected-places-section");
const selectedPlacesList = document.querySelector("#selected-places-list");
const selectedPlacesCount = document.querySelector("#selected-places-count");
const liveItineraryList = document.querySelector("#live-itinerary-list");
const liveItineraryDensity = document.querySelector("#live-itinerary-density");
const activityChoiceStorageKey = "packswift.planner.activity-choices.v1";

const currencyRatesToUsd = {
  USD: 1,
  THB: 1 / 35,
  MMK: 1 / 2100,
  CNY: 1 / 7.2,
  SGD: 1 / 1.35,
  EUR: 1.08,
  JPY: 0.0067,
};
const currencySymbols = Object.fromEntries(Object.entries(PackSwiftCurrency.currencies).map(([code, item]) => [code, item.symbol]));
const formatCurrency = PackSwiftCurrency.formatCurrency;
function syncDestinationCurrency() {
  const local = PackSwiftCurrency.resolve(resolveRouteLocation(destinationSearch.value) || destinationSearch.value);
  currencyInput.value = local.code;
  for (const option of currencyInput.options) option.disabled = option.value !== local.code;
  currencyInput.title = "Currency follows your destination";
  budgetInput.placeholder = `e.g. ${local.suggested.toLocaleString("en")}`;
  syncBudgetCurrencySymbol();
}
const minimumDailyBudgetUsd = 40;
const regionalRoundTripTransitUsd = new Map([
  ["bangkok::yangon", 100],
  ["bangkok::kuala-lumpur", 105],
  ["bangkok::singapore", 125],
  ["kuala-lumpur::singapore", 80],
  ["singapore::yangon", 170],
]);
const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const purposeInterests = {
  business: ["design", "food"],
  leisure: ["culture", "food", "wellness", "coast"],
  adventure: ["adventure", "nature", "coast"],
  cultural: ["culture", "history", "design"],
  food: ["food", "culture", "design"],
  events: ["food", "culture", "design", "coast"],
  family: ["family", "culture", "nature"],
};
const purposeLabels = {
  leisure: "Leisure & Relaxation",
  cultural: "Cultural & Historical",
  adventure: "Adventure & Outdoor",
  food: "Food & Culinary",
  business: "Business / Workation",
  events: "Special Events & Celebrations",
  family: "Family",
};
const paceLabels = {
  relaxed: "Slow & Relaxed 🌿",
  balanced: "Balanced & Steady ⚖️",
  packed: "Packed & Fast ⚡",
  cultural: "Cultural Deep Dive 🎨",
  culinary: "Culinary & Foodie 🍜",
};
const groupLabels = {
  solo: "Solo",
  couples: "Couples",
  "family-with-children": "Family",
  "friends-group": "Friends / Group",
  "business-duo": "Digital Nomad / Business Duo",
  senior: "Senior Travelers",
};
const planningGoalLabels = {
  "make-possible": "Make the trip possible",
  "fixed-budget": "Stay within my exact budget",
  "best-value": "Best value",
  "comfort-first": "Comfort first",
  luxury: "Luxury experience",
  "once-in-lifetime": "Once-in-a-lifetime trip",
};
const planningGoalSettings = {
  "make-possible": { dailyMultiplier: 0.72, activityReserveUsd: 0 },
  "fixed-budget": { dailyMultiplier: 0.9, activityReserveUsd: 0 },
  "best-value": { dailyMultiplier: 1, activityReserveUsd: 0 },
  "comfort-first": { dailyMultiplier: 1.22, activityReserveUsd: 0 },
  luxury: { dailyMultiplier: 1.85, activityReserveUsd: 0 },
  "once-in-lifetime": { dailyMultiplier: 1.05, activityReserveUsd: 90 },
};
const lifestyleDailyRatesUsd = {
  accommodation: { hostel: 13, budget: 25, comfortable: 45, boutique: 75, luxury: 170 },
  food: { street: 9, local: 17, mixed: 30, fine: 85 },
  transport: { public: 5, mixed: 14, private: 42, premium: 85 },
  activities: { free: 3, essential: 16, balanced: 32, premium: 95 },
  shopping: { none: 0, light: 5, planned: 15, priority: 40 },
};
const liveBudgetRanks = { budget: 0, mid: 1, luxury: 2 };
const livePaceActivityCount = {
  relaxed: 2,
  balanced: 4,
  packed: 5,
  cultural: 3,
  culinary: 4,
};
const livePaceResultCount = {
  relaxed: 4,
  balanced: 6,
  packed: 8,
  cultural: 6,
  culinary: 6,
};
const livePaceScores = {
  relaxed: { slow: 18, balanced: 5, fast: -20 },
  balanced: { slow: 10, balanced: 18, fast: 6 },
  packed: { slow: -8, balanced: 12, fast: 22 },
  cultural: { slow: 18, balanced: 16, fast: 2 },
  culinary: { slow: 10, balanced: 20, fast: 10 },
};
const specializedPaceTags = {
  cultural: ["culture", "history", "temple", "museum", "heritage"],
  culinary: ["food", "market", "cafe", "dinner", "culinary"],
};
const liveGroupTags = {
  "friends-group": ["group", "social", "nightlife", "shopping", "beach", "yacht"],
  couples: ["romantic", "spa", "sunset", "dinner", "cruise", "wellness"],
  "family-with-children": ["kids", "family", "waterpark", "temple", "private-transfer"],
  "business-duo": ["workation", "networking", "business", "social"],
  solo: ["culture", "food", "market", "workation"],
  senior: ["culture", "temple", "relaxed", "private-transfer"],
};
const fallbackActivityImages = [
  "/images/packswift1.jpg",
  "/images/packswift2.jpg",
  "/images/packswift3.jpg",
];

let activePlan = null;
let destinationCatalog = [];
let focusedDestination = null;
let liveRecommendationTimer = null;
let liveRecommendationSequence = 0;
let plannerActivitySeedPromise = null;
let liveRecommendationBackupQueue = [];
let liveRecommendationNextPageToken = null;
let liveRecommendationInput = null;
let liveRecommendationDestination = null;
let liveRecommendationRefilling = false;
let liveRecommendationRefreshAttempted = false;
const selectedActivityPlaceIds = new Set();
const selectedActivityDetails = new Map();
const dismissedActivityPlaceIds = new Set();
let activeActivityContextKey = "";
const activityPlanToast = document.querySelector("#activity-plan-toast");

function titleCase(value) {
  return String(value || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parseBudgetValue(value) {
  const digits = String(value || "").replace(/[^0-9]/g, "");
  return digits ? Number(digits) : 0;
}

function formatBudgetValue(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)
    : "";
}

function setBudgetValue(value) {
  budgetInput.value = formatBudgetValue(value);
}

function isoToDisplayDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function displayToIsoDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || "").trim());
  if (!match) return "";
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) return "";
  return `${year}-${month}-${day}`;
}

function formatDateTyping(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter(Boolean)
    .join("/");
}

function setPlannerDate(type, isoValue, { announce = false } = {}) {
  const isStart = type === "start";
  const isoInput = isStart ? startDateInput : endDateInput;
  const displayInput = isStart ? startDateDisplay : endDateDisplay;
  const pickerInput = isStart ? startDatePicker : endDatePicker;
  const nextValue = /^\d{4}-\d{2}-\d{2}$/.test(String(isoValue || ""))
    ? String(isoValue)
    : "";
  const previousValue = isoInput.value;
  isoInput.value = nextValue;
  displayInput.value = isoToDisplayDate(nextValue);
  pickerInput.value = nextValue;
  displayInput.setCustomValidity("");
  if (isStart) endDatePicker.min = nextValue;
  if (announce && previousValue !== nextValue) {
    isoInput.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function syncDateFromDisplay(type) {
  const isStart = type === "start";
  const displayInput = isStart ? startDateDisplay : endDateDisplay;
  const isoValue = displayToIsoDate(displayInput.value);
  const hasValue = displayInput.value.length > 0;
  displayInput.setCustomValidity(
    hasValue && !isoValue ? "Enter a valid date in DD/MM/YYYY format." : "",
  );
  const isoInput = isStart ? startDateInput : endDateInput;
  const pickerInput = isStart ? startDatePicker : endDatePicker;
  const previousValue = isoInput.value;
  isoInput.value = isoValue;
  pickerInput.value = isoValue;
  if (isStart) endDatePicker.min = isoValue;
  if (previousValue !== isoValue) {
    isoInput.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function setupFormattedDateControl(type) {
  const isStart = type === "start";
  const displayInput = isStart ? startDateDisplay : endDateDisplay;
  const pickerInput = isStart ? startDatePicker : endDatePicker;
  const button = document.querySelector(`[data-date-picker="${type}"]`);
  if (!button) return; // Embedded calendar owns date selection.

  displayInput.addEventListener("input", () => {
    displayInput.value = formatDateTyping(displayInput.value);
    syncDateFromDisplay(type);
  });
  displayInput.addEventListener("blur", () => syncDateFromDisplay(type));
  pickerInput.addEventListener("change", () => {
    setPlannerDate(type, pickerInput.value, { announce: true });
  });
  button.addEventListener("click", () => {
    pickerInput.value = (isStart ? startDateInput : endDateInput).value;
    try {
      if (typeof pickerInput.showPicker === "function") pickerInput.showPicker();
      else pickerInput.click();
    } catch {
      pickerInput.click();
    }
  });
}

function syncBudgetCurrencySymbol() {
  budgetCurrencySymbol.textContent = currencySymbols[currencyInput.value] || currencyInput.value;
}

function resolveRouteLocation(value) {
  const query = String(value || "").trim().toLowerCase();
  if (!query || !destinationCatalog.length) return null;
  const exact = destinationCatalog.find((destination) =>
    destination.slug.toLowerCase() === query ||
    destination.name.toLowerCase() === query ||
    `${destination.name}, ${destination.country}`.toLowerCase() === query,
  );
  const match = exact || destinationCatalog.find((destination) =>
    destination.country.toLowerCase() === query,
  ) || destinationCatalog.find((destination) =>
    [destination.name, destination.country, destination.region].some((part) =>
      part.toLowerCase().includes(query),
    ),
  );
  if (!match) return null;
  return {
    slug: match.slug,
    name: match.name,
    country: match.country,
    region: match.region,
    code: match.code || match.slug.slice(0, 3).toUpperCase(),
    latitude: Number(match.latitude),
    longitude: Number(match.longitude),
  };
}

function toRadians(value) {
  return Number(value) * (Math.PI / 180);
}

function routeDistanceKm(origin, destination) {
  if (!origin || !destination) return null;
  if (origin.slug && destination.slug && origin.slug === destination.slug) return 0;
  const coordinates = [
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
  ].map(Number);
  if (!coordinates.every(Number.isFinite)) return null;
  const [originLatitude, originLongitude, destinationLatitude, destinationLongitude] =
    coordinates.map(toRadians);
  const latitudeDelta = destinationLatitude - originLatitude;
  const longitudeDelta = destinationLongitude - originLongitude;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
}

function roundToNearestFive(value) {
  return Math.round(Number(value) / 5) * 5;
}

function estimateTransitCostUsd(origin, destination) {
  if (!origin || !destination) return 180;
  const routeKey = [origin.slug, destination.slug].filter(Boolean).sort().join("::");
  if (regionalRoundTripTransitUsd.has(routeKey)) {
    return regionalRoundTripTransitUsd.get(routeKey);
  }
  const distanceKm = routeDistanceKm(origin, destination);
  if (distanceKm === 0) return 0;
  if (!Number.isFinite(distanceKm)) {
    if (origin.country === destination.country) return 100;
    return origin.region === destination.region ? 180 : 700;
  }
  let estimate;
  if (origin.country === destination.country) {
    if (distanceKm <= 250) estimate = Math.max(25, 20 + distanceKm * 0.1);
    else if (distanceKm <= 900) estimate = 35 + distanceKm * 0.08;
    else estimate = 70 + distanceKm * 0.06;
  } else if (distanceKm <= 1500) {
    estimate = 45 + distanceKm * 0.112;
  } else if (distanceKm <= 4000) {
    estimate = 105 + distanceKm * 0.075;
  } else if (distanceKm <= 8000) {
    estimate = 220 + distanceKm * 0.06;
  } else {
    estimate = 360 + distanceKm * 0.045;
  }
  return Math.max(origin.country === destination.country ? 25 : 75, roundToNearestFive(estimate));
}

function travelStyleFromFormData(data) {
  return {
    planningGoal: String(data.get("planningGoal") || "best-value"),
    accommodationStyle: String(data.get("accommodationStyle") || "comfortable"),
    foodStyle: String(data.get("foodStyle") || "mixed"),
    transportStyle: String(data.get("transportStyle") || "mixed"),
    activityStyle: String(data.get("activityStyle") || "balanced"),
    shoppingStyle: String(data.get("extrasStyle") || "light"),
    dateFlexible: data.get("dateFlexible") === "true",
    tripLengthFlexible: data.get("tripLengthFlexible") === "true",
    mustHaveExperience: String(data.get("mustHaveExperience") || "").trim(),
  };
}

function lifestyleDailyRateUsd(style = {}) {
  const base =
    (lifestyleDailyRatesUsd.accommodation[style.accommodationStyle] || 45) +
    (lifestyleDailyRatesUsd.food[style.foodStyle] || 30) +
    (lifestyleDailyRatesUsd.transport[style.transportStyle] || 14) +
    (lifestyleDailyRatesUsd.activities[style.activityStyle] || 32) +
    (lifestyleDailyRatesUsd.shopping[style.shoppingStyle] ?? 5);
  const settings = planningGoalSettings[style.planningGoal] || planningGoalSettings["best-value"];
  return Math.max(22, Math.round(base * settings.dailyMultiplier));
}

function tripBudgetScenarios({
  scope, origin, destination, adults = 1, children = 0, days = 1,
  budgetUsd = 0, style = {},
}) {
  const travelers = Math.max(1, Number(adults) + Number(children));
  const travelerUnits = Math.max(1, Number(adults) + Number(children) * 0.65);
  const transitPerPersonUsd = estimateTransitCostUsd(origin, destination);
  const transitTotalUsd = transitPerPersonUsd * travelers;
  const lifestyleRate = lifestyleDailyRateUsd(style);
  const mustHaveReserve = style.mustHaveExperience
    ? (planningGoalSettings[style.planningGoal]?.activityReserveUsd || 55) * travelers
    : 0;
  const viableUsd = transitTotalUsd + 24 * travelerUnits * days;
  const recommendedUsd = transitTotalUsd + lifestyleRate * travelerUnits * days + mustHaveReserve;
  const comfortDailyRate = Math.max(105, lifestyleRate * 1.35);
  const comfortUsd = transitTotalUsd + comfortDailyRate * travelerUnits * days + mustHaveReserve;
  const fit = budgetUsd >= comfortUsd ? "comfort"
    : budgetUsd >= recommendedUsd ? "recommended"
      : budgetUsd >= viableUsd ? "viable" : "stretch";
  return {
    scope,
    transitPerPersonUsd,
    transitTotalUsd,
    lifestyleDailyRateUsd: lifestyleRate,
    viableUsd: Math.round(viableUsd),
    recommendedUsd: Math.round(recommendedUsd),
    comfortUsd: Math.round(comfortUsd),
    fit,
  };
}

function minimumTripBudgetDetails(scope, origin, destination, travelers, days, dailyRateUsd = minimumDailyBudgetUsd) {
  const normalizedTravelers = Math.max(1, Math.min(20, Math.round(Number(travelers) || 1)));
  const normalizedDays = Math.max(1, Math.min(30, Math.round(Number(days) || 1)));
  const transitCostPerPersonUsd = estimateTransitCostUsd(origin, destination);
  const totalTransitCostUsd = transitCostPerPersonUsd * normalizedTravelers;
  const normalizedDailyRate = Math.max(1, Number(dailyRateUsd) || minimumDailyBudgetUsd);
  const dailyStayCostUsd = normalizedDailyRate * normalizedTravelers * normalizedDays;
  return {
    scope,
    distanceKm: routeDistanceKm(origin, destination),
    travelers: normalizedTravelers,
    days: normalizedDays,
    dailyRatePerPersonUsd: normalizedDailyRate,
    transitCostPerPersonUsd,
    totalTransitCostUsd,
    dailyStayCostUsd,
    minimumBudgetUsd: totalTransitCostUsd + dailyStayCostUsd,
  };
}

function minimumBudgetForCurrentRoute() {
  const data = new FormData(plannerForm);
  const scope = String(data.get("tripScope") || "international");
  const origin = resolveRouteLocation(data.get("origin"));
  const destination = resolveRouteLocation(data.get("destination"));
  const travelers = Math.max(1, Number(data.get("adults") || 1)) +
    Math.max(0, Number(data.get("children") || 0));
  const days = getDays(String(data.get("startDate") || ""), String(data.get("endDate") || ""));
  const style = travelStyleFromFormData(data);
  const adults = Math.max(1, Number(data.get("adults") || 1));
  const children = Math.max(0, Number(data.get("children") || 0));
  const budget = parseBudgetValue(data.get("budget"));
  const currency = String(data.get("currency") || "USD");
  const scenarios = tripBudgetScenarios({
    scope, origin, destination, adults, children, days,
    budgetUsd: budget * currencyRatesToUsd[currency], style,
  });
  const details = minimumTripBudgetDetails(scope, origin, destination, travelers, days, 24);
  const minimumUsd = scenarios.viableUsd;
  const minimumAmount = Math.ceil(minimumUsd / currencyRatesToUsd[currency]);
  return { ...details, ...scenarios, style, origin, destination, minimumUsd, currency, minimumAmount };
}

function updateBudgetMinimum() {
  syncDestinationCurrency();
  const rule = minimumBudgetForCurrentRoute();
  budgetInput.dataset.minimum = String(rule.minimumAmount);
  const routeText = rule.origin && rule.destination
    ? `${rule.origin.name} → ${rule.destination.name}`
    : "the selected route";
  const amount = parseBudgetValue(budgetInput.value);
  const isBelowMinimum = amount > 0 && amount < rule.minimumAmount;
  syncBudgetCurrencySymbol();
  budgetInfoTitle.textContent = isBelowMinimum
    ? "A leaner version is possible"
    : `${planningGoalLabels[rule.style.planningGoal] || "Trip"} budget guide`;
  budgetInfoRoute.textContent = routeText;
  budgetInfoAmount.textContent = formatMoney(rule.minimumAmount, rule.currency);
  const travellerLabel = rule.travelers === 1 ? "traveller" : "travellers";
  const distanceLabel = Number.isFinite(rule.distanceKm)
    ? `${new Intl.NumberFormat("en-US").format(rule.distanceKm)} km route. `
    : "";
  const estimateFormula =
    `${distanceLabel}~${formatMoney(rule.transitCostPerPersonUsd / currencyRatesToUsd[rule.currency], rule.currency)} transit/person × ${rule.travelers} ${travellerLabel} + ` +
    `a minimum ${formatMoney(24 / currencyRatesToUsd[rule.currency], rule.currency)}/day travel baseline across ${rule.days} days.`;
  budgetInfoDetail.textContent = isBelowMinimum
    ? `${formatMoney(amount, rule.currency)} is still accepted. PackSwift will suggest fewer days, flexible dates, lower-cost stays, public transit, and free highlights. ${estimateFormula}`
    : `${estimateFormula} Your lifestyle-matched recommendation is ${formatMoney(rule.recommendedUsd / currencyRatesToUsd[rule.currency], rule.currency)}.`;
  budgetMinimumHint.classList.toggle("is-warning", isBelowMinimum);
  budgetField.classList.toggle("is-warning", isBelowMinimum);
  budgetInput.setCustomValidity("");
  return rule;
}

function setTravellerCount(type, value) {
  const isAdult = type === "adults";
  const input = isAdult ? adultInput : childInput;
  const minimum = isAdult ? 1 : 0;
  const maximum = isAdult ? 12 : 8;
  const next = Math.max(minimum, Math.min(maximum, Number(value) || minimum));
  input.value = String(next);
  document.querySelector(isAdult ? "#adult-count" : "#child-count").textContent = String(next);
}

function isDomesticTrip() {
  return plannerForm.querySelector('input[name="tripScope"]:checked')?.value === "domestic";
}

function syncTripScopeState({ preserveInternationalDestination = true } = {}) {
  const domestic = isDomesticTrip();
  if (domestic) {
    if (!destinationSearch.disabled && preserveInternationalDestination) {
      destinationSearch.dataset.internationalValue = destinationSearch.value;
    }
    destinationSearch.value = originSearch.value;
    destinationSearch.disabled = true;
    destinationSearch.setAttribute("aria-disabled", "true");
    domesticDestinationInput.value = originSearch.value;
    domesticDestinationInput.disabled = false;
    destinationField.classList.add("is-disabled");
    destinationFieldHint.textContent = "Nationwide trips automatically use your origin as the domestic destination.";
    setFeaturedState(originSearch.value.trim());
    return;
  }

  domesticDestinationInput.disabled = true;
  destinationSearch.disabled = false;
  destinationSearch.removeAttribute("aria-disabled");
  destinationField.classList.remove("is-disabled");
  destinationFieldHint.textContent = "Arrival city or country.";
  if (destinationSearch.dataset.internationalValue) {
    destinationSearch.value = destinationSearch.dataset.internationalValue;
  }
  setFeaturedState(destinationSearch.value.trim());
}

function liveBudgetProfile(budgetUsd, days, travelers) {
  const perPersonDayUsd = Math.max(0, Number(budgetUsd) || 0) /
    Math.max(1, days) /
    Math.max(1, travelers);
  const tier = perPersonDayUsd < 70 ? "budget" : perPersonDayUsd < 180 ? "mid" : "luxury";
  return {
    tier,
    label: tier === "budget" ? "Value" : tier === "mid" ? "Comfort" : "Premium",
    perPersonDayUsd: Math.round(perPersonDayUsd * 100) / 100,
  };
}

function resolveLiveDestination(input) {
  if (!destinationCatalog.length) return null;
  const query = input.destination.trim().toLowerCase();
  if (query) {
    return destinationCatalog.find((destination) =>
      destination.slug.toLowerCase() === query || destination.name.toLowerCase() === query,
    ) || destinationCatalog.find((destination) =>
      [destination.country, destination.region].some((value) =>
        value.toLowerCase() === query,
      ),
    ) || destinationCatalog.find((destination) =>
      [destination.name, destination.country, destination.region].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }
  const days = input.startDate && input.endDate ? getDays(input.startDate, input.endDate) : 7;
  return [...destinationCatalog].sort((first, second) =>
    Math.abs(first.dailyBudgetUsd * days * input.travelers - input.budgetUsd) -
    Math.abs(second.dailyBudgetUsd * days * input.travelers - input.budgetUsd),
  )[0];
}

function liveActivityScore(activity, input, profile) {
  if (!(activity.suitableGroups || []).includes(input.travelerDemographic)) {
    return Number.NEGATIVE_INFINITY;
  }
  let score = 40;
  score += (activity.purposeTags || []).includes(input.tripPurpose) ? 30 : -12;
  score += livePaceScores[input.pace]?.[activity.paceLevel] || 0;
  const budgetDistance = liveBudgetRanks[activity.budgetTier] - liveBudgetRanks[profile.tier];
  score += budgetDistance === 0 ? 18 : budgetDistance < 0 ? 10 : -12 * budgetDistance;
  if (activity.costUsd > profile.perPersonDayUsd * 1.5) score -= 12;
  if (["make-possible", "fixed-budget"].includes(input.planningGoal)) {
    score += activity.budgetTier === "budget" ? 24 : activity.budgetTier === "luxury" ? -24 : 2;
  } else if (input.planningGoal === "luxury") {
    score += activity.budgetTier === "luxury" ? 26 : activity.budgetTier === "budget" ? -8 : 8;
  } else if (input.planningGoal === "once-in-lifetime") {
    score += activity.budgetTier === "luxury" ? 12 : 5;
  }
  if (input.activityStyle === "free") score += activity.costUsd === 0 ? 28 : activity.budgetTier === "budget" ? 12 : -18;
  if (input.activityStyle === "premium") score += activity.budgetTier === "luxury" ? 22 : -4;
  if (input.shoppingStyle === "none" && (activity.experienceTags || []).includes("shopping")) score -= 30;
  if (["planned", "priority"].includes(input.shoppingStyle) && (activity.experienceTags || []).includes("shopping")) {
    score += input.shoppingStyle === "priority" ? 28 : 16;
  }
  if (input.mustHaveExperience) {
    const wanted = input.mustHaveExperience.toLowerCase().split(/\s+/).filter((word) => word.length > 3);
    const searchable = `${activity.title} ${activity.description} ${(activity.experienceTags || []).join(" ")}`.toLowerCase();
    score += wanted.filter((word) => searchable.includes(word)).length * 16;
  }
  const preferredTags = liveGroupTags[input.travelerDemographic] || [];
  score += (activity.experienceTags || [])
    .filter((tag) => preferredTags.includes(tag)).length * 8;
  const paceTags = specializedPaceTags[input.pace] || [];
  score += (activity.experienceTags || [])
    .filter((tag) => paceTags.includes(tag)).length * 14;
  if (
    input.travelerDemographic === "friends-group" && input.tripPurpose === "leisure" &&
    (activity.experienceTags || []).includes("yacht")
  ) score += 36;
  if (
    input.travelerDemographic === "couples" && input.tripPurpose === "leisure" &&
    (activity.experienceTags || []).includes("romantic")
  ) score += 28;
  if (
    input.travelerDemographic === "family-with-children" &&
    (activity.experienceTags || []).includes("kids")
  ) score += 28;
  return score;
}

function recommendLiveActivities(activities, input, destination) {
  const days = input.startDate && input.endDate ? getDays(input.startDate, input.endDate) : 1;
  const budget = liveBudgetProfile(input.budgetUsd, days, input.travelers);
  const ranked = activities
    .map((activity, index) => ({
      activity,
      index,
      score: liveActivityScore(activity, input, budget),
    }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((first, second) => second.score - first.score || first.index - second.index)
    .map(({ activity }) => activity);
  const perDay = livePaceActivityCount[input.pace] || 3;
  const resultCount = livePaceResultCount[input.pace] || 6;
  const specializedTags = specializedPaceTags[input.pace] || [];
  const displayRanked = specializedTags.length
    ? ranked.filter((activity) =>
        (activity.experienceTags || []).some((tag) => specializedTags.includes(tag)))
    : ranked;
  const itinerarySource = ranked.slice(0, Math.max(perDay * 3, 6));
  const previewDays = Math.max(1, Math.min(days, 3));
  const candidates = (displayRanked.length ? displayRanked : ranked).map((activity) => ({
    ...activity,
    provider: activity.provider || "packswift_catalog",
    placeId: activity.providerPlaceId || `catalog:${activity.slug}`,
  })).filter((activity) =>
    !selectedActivityPlaceIds.has(activity.placeId) &&
    !dismissedActivityPlaceIds.has(activity.placeId));
  return {
    city: { id: destination?.slug || "global", name: destination?.name || "Worldwide" },
    budget,
    activitiesPerDay: perDay,
    schedule: {
      startTime: input.smartPace.lateRiser ? "10:30" : "08:30",
      middayRest: input.smartPace.middayRest,
      clusterNearby: input.smartPace.clusterNearby,
    },
    activities: candidates.slice(0, Math.min(6, resultCount)),
    primary: candidates.slice(0, Math.min(6, resultCount)),
    backupQueue: candidates.slice(Math.min(6, resultCount), 20),
    nextPageToken: null,
    hasMore: false,
    itinerary: Array.from({ length: previewDays }, (_, dayIndex) => ({
      day: dayIndex + 1,
      startTime: input.smartPace.lateRiser ? "10:30" : "08:30",
      middayRest: input.smartPace.middayRest,
      clusterNearby: input.smartPace.clusterNearby,
      activities: Array.from({ length: perDay }, (_, activityIndex) =>
        itinerarySource[(dayIndex * perDay + activityIndex) % itinerarySource.length],
      ).filter(Boolean),
    })),
  };
}

function genericActivitiesFor(destination, input) {
  const previews = destination?.activityPreviews?.length
    ? destination.activityPreviews
    : (destination?.attractions || []).map((title) => ({
        title,
        category: "Destination highlight",
        description: `Explore ${title} with timing adjusted to your selected travel pace.`,
        costUsd: Math.max(8, Math.round((destination?.dailyBudgetUsd || 80) * 0.2)),
      }));
  return previews.map((activity, index) => ({
    ...activity,
    cityId: destination?.slug || "global",
    cityName: destination?.name || "Worldwide",
    slug: `${destination?.slug || "global"}-${index + 1}`,
    imageUrl: fallbackActivityImages[index % fallbackActivityImages.length],
    imageAlt: `${activity.title} travel activity in ${destination?.name || "the selected destination"}`,
    imageCredit: "PackSwift travel collection",
    imageSourceUrl: "",
    suitableGroups: Object.keys(groupLabels),
    purposeTags: [input.tripPurpose],
    budgetTier: activity.costUsd < 20 ? "budget" : activity.costUsd < 80 ? "mid" : "luxury",
    paceLevel: ["slow", "balanced", "fast"][index % 3],
    experienceTags: [...(activity.interests || []), ...(liveGroupTags[input.travelerDemographic] || []).slice(0, 2)],
  }));
}

function loadPlannerActivitySeed() {
  plannerActivitySeedPromise ??= fetch("/data/planner-activities.json")
    .then((response) => {
      if (!response.ok) throw new Error("Activity catalog unavailable.");
      return response.json();
    });
  return plannerActivitySeedPromise;
}

async function requestLiveRecommendation(
  input,
  destination,
  { pageToken = null, refreshQueue = false } = {},
) {
  const days = input.startDate && input.endDate ? getDays(input.startDate, input.endDate) : 1;
  const requestedDestination = input.destination.trim();
  const isKnownCity = Boolean(destination) &&
    destination.name.toLowerCase() === requestedDestination.toLowerCase();
  const isKnownCountry = Boolean(destination) &&
    destination.country.toLowerCase() === requestedDestination.toLowerCase() &&
    !isKnownCity;
  try {
    const response = await fetch("/api/activities/recommend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        destination: requestedDestination,
        destination_country: isKnownCity ? destination.country : undefined,
        destination_scope: isKnownCountry ? "country" : isKnownCity ? "city" : undefined,
        travel_purpose: input.tripPurpose,
        travel_group: input.travelerDemographic,
        travel_pace: input.pace,
        budget: Math.max(1, input.budgetUsd),
        days,
        travelers: input.travelers,
        late_riser: input.smartPace.lateRiser,
        midday_rest: input.smartPace.middayRest,
        cluster_nearby: input.smartPace.clusterNearby,
        planning_goal: input.planningGoal,
        activity_style: input.activityStyle,
        shopping_style: input.shoppingStyle,
        must_have_experience: input.mustHaveExperience || undefined,
        trip_id: activePlan?.persistence?.saved ? activePlan.persistence.tripId : undefined,
        saved_place_ids: [...selectedActivityPlaceIds],
        excluded_place_ids: [...dismissedActivityPlaceIds],
        page_token: pageToken || undefined,
        refresh_queue: refreshQueue || undefined,
      }),
    });
    if (response.ok) return response.json();
  } catch {
    // The bundled destination catalog keeps previews available without a provider key.
  }
  if (destination?.slug === "bangkok") {
    const seed = await loadPlannerActivitySeed();
    return recommendLiveActivities(
      seed.filter((activity) => activity.cityId === "bkk"),
      input,
      destination,
    );
  }
  return recommendLiveActivities(genericActivitiesFor(destination, input), input, destination);
}

function activityPlaceIdentity(activity) {
  return {
    placeId: activity.placeId || activity.providerPlaceId || `catalog:${activity.slug}`,
    provider: activity.provider === "google_places" ? "google_places" : "packswift_catalog",
  };
}

function activityContextKey(input) {
  return [input.origin, input.destination]
    .map((value) => String(value || "").trim().toLowerCase())
    .join("::");
}

function storedActivityChoice(activity) {
  const { placeId, provider } = activityPlaceIdentity(activity);
  return {
    placeId,
    provider,
    title: String(activity.title || "Selected place").slice(0, 180),
    category: String(activity.category || "Place to visit").slice(0, 100),
    imageUrl: String(activity.imageUrl || fallbackActivityImages[0]).slice(0, 1000),
    imageAlt: String(activity.imageAlt || activity.title || "Selected place").slice(0, 240),
  };
}

function readActivityChoices() {
  try {
    const value = JSON.parse(sessionStorage.getItem(activityChoiceStorageKey) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function persistActivityChoices() {
  if (!activeActivityContextKey) return;
  const choices = readActivityChoices();
  choices[activeActivityContextKey] = {
    selected: [...selectedActivityDetails.values()].map(storedActivityChoice),
    dismissed: [...dismissedActivityPlaceIds].slice(0, 100),
  };
  sessionStorage.setItem(activityChoiceStorageKey, JSON.stringify(choices));
}

function activateActivityContext(input) {
  const nextContextKey = activityContextKey(input);
  if (!nextContextKey || nextContextKey === activeActivityContextKey) return;
  activeActivityContextKey = nextContextKey;
  selectedActivityPlaceIds.clear();
  selectedActivityDetails.clear();
  dismissedActivityPlaceIds.clear();
  const saved = readActivityChoices()[nextContextKey];
  for (const activity of Array.isArray(saved?.selected) ? saved.selected : []) {
    const { placeId } = activityPlaceIdentity(activity);
    if (!placeId) continue;
    selectedActivityPlaceIds.add(placeId);
    selectedActivityDetails.set(placeId, activity);
  }
  for (const placeId of Array.isArray(saved?.dismissed) ? saved.dismissed : []) {
    if (typeof placeId === "string" && placeId.length >= 3) {
      dismissedActivityPlaceIds.add(placeId);
    }
  }
  renderSelectedPlaces();
}

function renderSelectedPlaces() {
  const activities = [...selectedActivityDetails.values()];
  selectedPlacesSection.hidden = activities.length === 0;
  selectedPlacesCount.textContent = `${activities.length} ${activities.length === 1 ? "place" : "places"}`;
  selectedPlacesList.replaceChildren(...activities.map((activity) => {
    const item = document.createElement("article");
    item.className = "selected-place-item";
    const thumbnail = document.createElement("figure");
    thumbnail.className = "selected-place-thumbnail";
    const image = document.createElement("img");
    image.src = activity.imageUrl || fallbackActivityImages[0];
    image.alt = activity.imageAlt || `${activity.title || "Selected place"} thumbnail`;
    image.loading = "lazy";
    image.decoding = "async";
    image.width = 96;
    image.height = 72;
    image.addEventListener("error", () => {
      if (image.dataset.fallbackApplied === "true") return;
      image.dataset.fallbackApplied = "true";
      image.src = fallbackActivityImages[0];
      image.alt = `${activity.title || "Selected place"} PackSwift placeholder`;
    });
    thumbnail.append(image);
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = activity.title || "Selected place";
    const category = document.createElement("small");
    category.textContent = `${activity.category || "Place to visit"} · Added ✓`;
    copy.append(title, category);
    item.append(thumbnail, copy);
    return item;
  }));
}

function rememberSelectedActivity(activity) {
  const stored = storedActivityChoice(activity);
  selectedActivityPlaceIds.add(stored.placeId);
  selectedActivityDetails.set(stored.placeId, stored);
  dismissedActivityPlaceIds.delete(stored.placeId);
  persistActivityChoices();
  renderSelectedPlaces();
}

function showActivityPlanToast(message = "Added to your plan! ✓") {
  activityPlanToast.textContent = message;
  activityPlanToast.hidden = false;
  activityPlanToast.classList.remove("is-visible");
  requestAnimationFrame(() => activityPlanToast.classList.add("is-visible"));
  clearTimeout(showActivityPlanToast.timer);
  showActivityPlanToast.timer = setTimeout(() => {
    activityPlanToast.classList.remove("is-visible");
    setTimeout(() => { activityPlanToast.hidden = true; }, 220);
  }, 2200);
}

async function refillLiveRecommendationQueue() {
  if (
    liveRecommendationRefilling || !liveRecommendationInput ||
    (!liveRecommendationNextPageToken && liveRecommendationRefreshAttempted)
  ) return;
  liveRecommendationRefilling = true;
  try {
    const refreshQueue = !liveRecommendationNextPageToken;
    if (refreshQueue) liveRecommendationRefreshAttempted = true;
    const next = await requestLiveRecommendation(
      liveRecommendationInput,
      liveRecommendationDestination,
      { pageToken: liveRecommendationNextPageToken, refreshQueue },
    );
    liveRecommendationNextPageToken = next.nextPageToken || null;
    const currentIds = new Set([
      ...selectedActivityPlaceIds,
      ...dismissedActivityPlaceIds,
      ...liveRecommendationBackupQueue.map((activity) => activityPlaceIdentity(activity).placeId),
      ...[...liveActivityGrid.querySelectorAll("[data-place-id]")]
        .map((card) => card.dataset.placeId),
    ]);
    for (const activity of [...(next.primary || next.activities || []), ...(next.backupQueue || [])]) {
      const { placeId } = activityPlaceIdentity(activity);
      if (!currentIds.has(placeId)) {
        liveRecommendationBackupQueue.push(activity);
        currentIds.add(placeId);
      }
    }
    if (liveRecommendationBackupQueue.length <= 2 && liveRecommendationNextPageToken) {
      setTimeout(refillLiveRecommendationQueue, 80);
    }
  } catch {
    // Existing matches stay usable if a background page cannot be loaded.
  } finally {
    liveRecommendationRefilling = false;
  }
}

async function replaceLiveActivityCard(card, currency) {
  let replacement = liveRecommendationBackupQueue.shift();
  if (!replacement) {
    await refillLiveRecommendationQueue();
    replacement = liveRecommendationBackupQueue.shift();
  }
  card.classList.add("is-leaving");
  await new Promise((resolve) => setTimeout(resolve, 220));
  if (replacement) {
    const replacementCard = buildLiveActivityCard(replacement, currency);
    replacementCard.classList.add("is-entering");
    card.replaceWith(replacementCard);
    requestAnimationFrame(() => replacementCard.classList.remove("is-entering"));
  } else {
    card.remove();
    liveActivityStatus.textContent = "No more matching places right now";
  }
  if (liveRecommendationBackupQueue.length <= 2) {
    refillLiveRecommendationQueue();
  }
}

async function syncSelectedActivitiesToPlan(plan) {
  if (!plan?.persistence?.tripId || selectedActivityDetails.size === 0) return;
  for (const activity of selectedActivityDetails.values()) {
    const { placeId, provider } = activityPlaceIdentity(activity);
    await window.PackSwift.api("/api/trip/plan/add", {
      method: "POST",
      body: JSON.stringify({
        trip_id: plan.persistence.tripId,
        place_id: placeId,
        provider,
      }),
    });
  }
}

async function addActivityToPlan(activity, card, button, currency) {
  if (card.classList.contains("is-leaving")) return;
  button.disabled = true;
  button.textContent = "Adding…";
  try {
    const user = await window.PackSwift.authReady;
    rememberSelectedActivity(activity);
    let message = user ? "Added to your trip choices ✓" : "Added to this trip preview ✓";
    if (user && activePlan?.persistence?.tripId) {
      try {
        await syncSelectedActivitiesToPlan(activePlan);
        message = "Added to your saved trip! ✓";
      } catch {
        message = "Added now — it will sync when you save the trip";
      }
    }
    showActivityPlanToast(message);
    await replaceLiveActivityCard(card, currency);
  } catch (error) {
    button.disabled = false;
    button.innerHTML = '<span aria-hidden="true">+</span> Add to visit';
    showActivityPlanToast(error.message || "Could not add this activity.");
  }
}

async function dismissActivityRecommendation(activity, card, button, currency) {
  if (card.classList.contains("is-leaving")) return;
  button.disabled = true;
  button.textContent = "Replacing…";
  const { placeId } = activityPlaceIdentity(activity);
  dismissedActivityPlaceIds.add(placeId);
  persistActivityChoices();
  showActivityPlanToast("Noted — showing another place");
  await replaceLiveActivityCard(card, currency);
}

function buildLiveActivityCard(activity, currency) {
  const card = document.createElement("article");
  card.className = "live-activity-card";
  const { placeId } = activityPlaceIdentity(activity);
  card.dataset.placeId = placeId;
  const figure = document.createElement("figure");
  const image = document.createElement("img");
  image.src = activity.imageUrl;
  image.alt = activity.imageAlt || activity.title;
  image.loading = "lazy";
  image.decoding = "async";
  figure.append(image);
  if (activity.imageCredit) {
    const credit = activity.imageSourceUrl
      ? document.createElement("a")
      : document.createElement("span");
    credit.className = "live-photo-credit";
    credit.textContent = activity.imageCredit;
    if (activity.imageSourceUrl) {
      credit.href = activity.imageSourceUrl;
      credit.target = "_blank";
      credit.rel = "noreferrer";
    }
    figure.append(credit);
  }
  const body = document.createElement("div");
  const category = document.createElement("span");
  category.className = "live-activity-category";
  category.textContent = activity.category;
  const title = document.createElement("strong");
  title.textContent = activity.title;
  const description = document.createElement("p");
  description.textContent = activity.description;
  const cost = document.createElement("small");
  const converted = Number(activity.costUsd || 0) / currencyRatesToUsd[currency];
  const detailParts = [];
  if (Number(activity.rating) > 0) {
    detailParts.push(`★ ${Number(activity.rating).toFixed(1)}`);
  }
  if (activity.priceRange) detailParts.push(activity.priceRange);
  detailParts.push(`Est. ${formatMoney(converted, currency)} per person`);
  cost.textContent = detailParts.join(" · ");
  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "live-activity-add";
  addButton.innerHTML = '<span aria-hidden="true">+</span> Add to visit';
  addButton.addEventListener("click", () => addActivityToPlan(
    activity,
    card,
    addButton,
    currency,
  ));
  const dismissButton = document.createElement("button");
  dismissButton.type = "button";
  dismissButton.className = "live-activity-skip";
  dismissButton.textContent = "Not interested";
  dismissButton.setAttribute("aria-label", `Not interested in ${activity.title}. Show another place.`);
  dismissButton.addEventListener("click", () => dismissActivityRecommendation(
    activity,
    card,
    dismissButton,
    currency,
  ));
  const actions = document.createElement("div");
  actions.className = "live-activity-actions";
  actions.append(addButton, dismissButton);
  body.append(category, title, description, cost, actions);
  card.append(figure, body);
  return card;
}

function appendLiveActivityCard(activity, currency) {
  liveActivityGrid.append(buildLiveActivityCard(activity, currency));
}

function renderLiveRecommendation(recommendation, input) {
  liveRecommendationInput = input;
  liveRecommendationBackupQueue = [...(recommendation.backupQueue || [])];
  liveRecommendationNextPageToken = recommendation.nextPageToken || null;
  liveRecommendationRefreshAttempted = false;
  for (const placeId of recommendation.savedPlaceIds || []) {
    selectedActivityPlaceIds.add(placeId);
  }
  for (const activity of recommendation.selectedPlaces || []) {
    const stored = storedActivityChoice(activity);
    selectedActivityPlaceIds.add(stored.placeId);
    selectedActivityDetails.set(stored.placeId, stored);
  }
  persistActivityChoices();
  renderSelectedPlaces();
  liveActivityGrid.replaceChildren();
  for (const activity of recommendation.primary || recommendation.activities || []) {
    appendLiveActivityCard(activity, input.currency);
  }
  liveActivityStatus.textContent = recommendation.activities?.length
    ? `${recommendation.activities.length} tailored matches · ${recommendation.budget.label}${recommendation.source === "google_places" ? " · Live data from Google Maps" : ""}`
    : "No exact matches yet";
  liveItineraryDensity.textContent =
    `${recommendation.activitiesPerDay} ${recommendation.activitiesPerDay === 1 ? "activity" : "activities"} per day`;
  // Visual itinerary has its own live provider request; nearby stops clustered
  // and midday rest remain part of that preview's scheduling context.
}

let visualItineraryController;
document.getElementById("visual-travel-style").addEventListener("change", updateLiveTripPreview);
async function refreshVisualItinerary(input, sequence) {
  const destination = String(input.destination || "").trim();
  if (!destination) {
    liveItineraryList.textContent = "Choose a destination to generate a visual route.";
    return;
  }
  visualItineraryController = new AbortController();
  const duration = Math.min(14, getDays(input.startDate, input.endDate) || 1);
  const dailyBudget = input.budgetUsd / Math.max(1, input.travelers * duration);
  const automaticType = input.children > 0 || input.travelerDemographic === "family-with-children" ? "Family with Kids"
    : input.tripPurpose === "food" || input.pace === "culinary" ? "Food & Culinary"
    : input.tripPurpose === "cultural" || input.pace === "cultural" ? "Culture & Heritage"
    : dailyBudget < 60 ? "Budget / Backpacker" : "Solo / Aesthetic";
  const userType = document.getElementById("visual-travel-style").value || automaticType;
  liveItineraryList.setAttribute("aria-busy", "true");
  liveItineraryList.textContent = "Finding places and building your route…";
  try {
    const response = await fetch("/api/generate-itinerary", {
      method: "POST", headers: { "Content-Type": "application/json" },
      signal: visualItineraryController.signal,
      body: JSON.stringify({ destination, userType, duration, budgetCategory: dailyBudget < 60 ? "budget" : dailyBudget > 200 ? "luxury" : "mid", pace: input.pace }),
    });
    if (!response.ok) throw new Error("Could not load route");
    const result = await response.json();
    if (sequence !== liveRecommendationSequence) return;
    renderItineraryDays(result.days.map(day => ({ ...day, startTime: input.smartPace.lateRiser ? "10:30" : "08:30", middayRest: input.smartPace.middayRest })), "live-itinerary-list", input.currency);
    const notice = document.createElement("p");
    notice.className = "visual-route-note";
    notice.textContent = result.message + (result.partial ? " Fewer matches available; some days need additional stops." : "");
    liveItineraryList.prepend(notice);
  } catch (error) {
    if (error.name !== "AbortError" && sequence === liveRecommendationSequence) liveItineraryList.textContent = "The route could not load. Change a preference to retry.";
  } finally {
    if (sequence === liveRecommendationSequence) liveItineraryList.setAttribute("aria-busy", "false");
  }
}

function scheduleLiveRecommendation(input) {
  visualItineraryController?.abort();
  activateActivityContext(input);
  clearTimeout(liveRecommendationTimer);
  liveActivityStatus.textContent = "Updating…";
  const sequence = ++liveRecommendationSequence;
  liveRecommendationTimer = setTimeout(async () => {
    refreshVisualItinerary(input, sequence);
    const destination = resolveLiveDestination(input);
    liveRecommendationDestination = destination;
    try {
      const recommendation = await requestLiveRecommendation(input, destination);
      if (sequence === liveRecommendationSequence) {
        renderLiveRecommendation(recommendation, input);
      }
    } catch {
      if (sequence === liveRecommendationSequence) {
        liveActivityStatus.textContent = "Choose a supported destination";
        liveActivityGrid.replaceChildren();
      }
    }
  }, 500);
}

function renderLiveBudgetOptions(scenarios, currency, planningGoal) {
  const options = [
    {
      key: "viable",
      eyebrow: "Lowest realistic",
      title: "Minimum viable trip",
      amountUsd: scenarios.viableUsd,
      detail: "Safe basics, simple stays, public transport, and mostly free highlights.",
    },
    {
      key: "recommended",
      eyebrow: "Matched to you",
      title: planningGoalLabels[planningGoal] || "Recommended trip",
      amountUsd: scenarios.recommendedUsd,
      detail: "Reflects the accommodation, food, transport, and activity levels you selected.",
    },
    {
      key: "comfort",
      eyebrow: "Optional upgrade",
      title: "Comfort upgrade",
      amountUsd: scenarios.comfortUsd,
      detail: "Adds easier logistics, stronger location choices, and more spending flexibility.",
    },
  ];
  const fitMessages = {
    comfort: "Your budget can support this level",
    recommended: "Your budget supports your matched plan",
    viable: "Your budget supports the lean version",
    stretch: "Adjustments are needed, but planning stays open",
  };
  document.querySelector("#live-budget-options").replaceChildren(
    ...options.map((option) => {
      const card = document.createElement("article");
      card.className = `live-budget-option${option.key === "recommended" ? " is-recommended" : ""}`;
      const eyebrow = document.createElement("span");
      eyebrow.textContent = option.eyebrow;
      const title = document.createElement("strong");
      title.textContent = option.title;
      const detail = document.createElement("small");
      detail.textContent = option.detail;
      const amount = document.createElement("em");
      amount.textContent = formatMoney(option.amountUsd / currencyRatesToUsd[currency], currency);
      card.append(eyebrow, title, detail, amount);
      return card;
    }),
  );
  const fit = document.createElement("span");
  fit.textContent = fitMessages[scenarios.fit];
  fit.dataset.budgetFit = scenarios.fit;
  return fit;
}

function updateLiveTripPreview() {
  syncDestinationCurrency();
  window.refreshDemandCalendar?.();
  window.refreshDynamicBudget?.();
  const data = new FormData(plannerForm);
  const origin = String(data.get("origin") || "").trim();
  const destination = String(data.get("destination") || "").trim();
  const currency = String(data.get("currency") || "USD");
  const budget = parseBudgetValue(data.get("budget"));
  const adults = Math.max(1, Number(data.get("adults") || 1));
  const children = Math.max(0, Number(data.get("children") || 0));
  const travelers = adults + children;
  const startDate = String(data.get("startDate") || "");
  const endDate = String(data.get("endDate") || "");
  const purposeValue = String(data.get("tripPurpose") || "leisure");
  const paceValue = String(data.get("pace") || "balanced");
  const groupValue = String(data.get("travelerDemographic") || "couples");
  const travelStyle = travelStyleFromFormData(data);
  const planningGoal = travelStyle.planningGoal;
  const smartPace = {
    lateRiser: data.get("lateRiser") === "true",
    middayRest: data.get("middayRest") === "true",
    clusterNearby: data.get("clusterNearby") === "true",
  };
  const purpose = purposeLabels[purposeValue] || titleCase(purposeValue);
  const pace = paceLabels[paceValue] || titleCase(paceValue);
  const group = groupLabels[groupValue] || titleCase(groupValue);
  const withPets = data.get("travelingWithPets") === "true";
  const days = startDate && endDate ? getDays(startDate, endDate) : 1;
  const budgetUsd = budget * currencyRatesToUsd[currency];
  const budgetProfile = liveBudgetProfile(budgetUsd, days, travelers);
  const budgetScenarios = tripBudgetScenarios({
    scope: String(data.get("tripScope") || "international"),
    origin: resolveRouteLocation(origin),
    destination: resolveRouteLocation(destination),
    adults,
    children,
    days,
    budgetUsd,
    style: travelStyle,
  });

  document.querySelector("#live-destination").textContent =
    origin && destination ? `${origin} → ${destination}` : destination || "Choose a route";
  document.querySelector("#live-budget").textContent =
    budget > 0 ? formatMoney(budget, currency) : "Add your budget";
  document.querySelector("#live-budget-category").textContent =
    `${budgetProfile.label} · ${formatMoney(
      budgetProfile.perPersonDayUsd / currencyRatesToUsd[currency],
      currency,
    )}/person/day`;
  document.querySelector("#live-planning-goal").textContent =
    planningGoalLabels[planningGoal] || titleCase(planningGoal);
  document.querySelector("#live-travellers").textContent =
    `${adults} ${adults === 1 ? "adult" : "adults"} · ${children} ${children === 1 ? "child" : "children"}`;
  document.querySelector("#live-style").textContent =
    `${purpose} · ${pace} · ${group}`;

  let dateText = "Select your dates";
  if (startDate && endDate) {
    dateText = `${startDate} → ${endDate} · ${getDays(startDate, endDate)} days`;
  } else if (startDate) {
    dateText = `Starting ${startDate} · choose an end date`;
  }
  document.querySelector("#live-dates").textContent = dateText;
  document.querySelector("#live-tag-destination").textContent =
    origin && destination ? `${origin} → ${destination}` : destination || "Route pending";
  document.querySelector("#live-tag-dates").textContent =
    startDate && endDate ? `${days} ${days === 1 ? "day" : "days"}` : "Dates pending";
  document.querySelector("#live-tag-budget").textContent =
    `${budgetProfile.label} budget`;
  document.querySelector("#live-tag-goal").textContent =
    planningGoalLabels[planningGoal] || titleCase(planningGoal);
  document.querySelector("#live-tag-group").textContent = group;
  document.querySelector("#live-tag-pace").textContent = pace;
  const activeSmartPace = [
    smartPace.lateRiser && "Late Riser",
    smartPace.middayRest && "Midday Rest",
    smartPace.clusterNearby && "Cluster Nearby",
  ].filter(Boolean);
  const smartPaceTag = document.querySelector("#live-tag-smart-pace");
  smartPaceTag.hidden = activeSmartPace.length === 0;
  smartPaceTag.textContent = activeSmartPace.join(" · ");

  const notices = [];
  if (origin && destination) {
    notices.push(`PackSwift is planning only for your ${origin} to ${destination} route.`);
  } else if (destination) {
    notices.push(`PackSwift will prioritize ${destination} and nearby city matches.`);
  } else {
    notices.push("Worldwide discovery is active for the strongest budget match.");
  }
  if (withPets) notices.push("Pet documents and pet-care essentials will be added.");
  if (travelStyle.mustHaveExperience) {
    notices.push(`Protected priority: ${travelStyle.mustHaveExperience}. PackSwift will save elsewhere before removing it.`);
  }
  if (travelStyle.dateFlexible) notices.push("Flexible dates can be used to reduce transport and stay costs.");
  if (travelStyle.tripLengthFlexible) notices.push("Trip length may be adjusted before essential experiences are removed.");
  if (smartPace.lateRiser) notices.push("Daily activities will begin after 10 AM.");
  if (smartPace.middayRest) notices.push("Each day includes a protected 2-hour afternoon rest.");
  if (smartPace.clusterNearby) notices.push("Activities will be grouped by nearby areas to reduce transit.");
  if (budget > 0) {
    notices.push(
      `${formatMoney(
        budgetProfile.perPersonDayUsd / currencyRatesToUsd[currency],
        currency,
      )} per person/day is treated as a ${budgetProfile.label.toLowerCase()} travel budget.`,
    );
  }
  document.querySelector("#live-announcement").textContent = notices[0];
  const budgetFitNotice = renderLiveBudgetOptions(budgetScenarios, currency, planningGoal);
  document.querySelector("#live-notices").replaceChildren(
    budgetFitNotice,
    ...notices.slice(1).map((notice) => {
      const item = document.createElement("span");
      item.textContent = notice;
      return item;
    }),
  );
  scheduleLiveRecommendation({
    tripScope: String(data.get("tripScope") || "international"),
    origin,
    destination,
    currency,
    budget,
    budgetUsd,
    travelers,
    adults,
    children,
    startDate,
    endDate,
    tripPurpose: purposeValue,
    pace: paceValue,
    smartPace,
    travelerDemographic: groupValue,
    travelingWithPets: withPets,
    ...travelStyle,
  });
}

function dateValue(date) {
  return new Date(`${date}T00:00:00`).valueOf();
}

function getDays(startDate, endDate) {
  return Math.max(
    1,
    Math.min(30, Math.round((dateValue(endDate) - dateValue(startDate)) / 86400000) + 1),
  );
}

function setInitialDates() {
  const start = new Date();
  start.setDate(start.getDate() + 30);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  setPlannerDate("start", start.toISOString().slice(0, 10));
  setPlannerDate("end", end.toISOString().slice(0, 10));
}

function applyPlannerQuery() {
  const params = new URLSearchParams(window.location.search);
  const origin = params.get("origin")?.trim();
  const destination = params.get("destination")?.trim();
  if (origin && origin.length <= 100) originSearch.value = titleCase(origin);
  if (destination && destination.length <= 100) {
    destinationSearch.value = titleCase(destination);
    setFeaturedState(destinationSearch.value);
  }
  const scope = params.get("scope");
  if (["domestic", "international"].includes(scope)) {
    const input = plannerForm.querySelector(`input[name="tripScope"][value="${scope}"]`);
    if (input) input.checked = true;
  }

  const currency = params.get("currency");
  const budget = Number(params.get("budget"));
  if (currency && currencyRatesToUsd[currency]) currencyInput.value = currency;
  if (Number.isFinite(budget) && budget > 0) setBudgetValue(budget);
}

function applyFocusedDestinationMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("focus") !== "1") return;

  const query = params.get("destination")?.trim().toLowerCase();
  if (!query) return;
  focusedDestination = destinationCatalog.find(
    (destination) =>
      destination.slug.toLowerCase() === query ||
      destination.name.toLowerCase() === query,
  );
  if (!focusedDestination) return;

  document.body.classList.add("focused-planner");
  destinationSearch.value = focusedDestination.name;
  destinationSearch.readOnly = true;
  destinationSearch.setAttribute(
    "aria-description",
    "This destination was selected from the Home Page and is locked for this planning session.",
  );
  document.querySelector(".featured-destinations").hidden = true;
  document.querySelector("#alternative-preview").hidden = true;

  const context = document.querySelector("#focused-destination-context");
  context.hidden = false;
  document.querySelector("#focused-destination-code").textContent =
    focusedDestination.code;
  document.querySelector("#focused-destination-name").textContent =
    focusedDestination.name;
  document.querySelector("#focused-destination-country").textContent =
    `${focusedDestination.country} · ${focusedDestination.region}`;
  document.querySelector("#focused-destination-season").textContent =
    focusedDestination.bestMonths
      .map((month) => monthNames[month - 1])
      .join(", ");
  document.querySelector("#focused-destination-attractions").textContent =
    focusedDestination.attractions.slice(0, 4).join(" · ");
  document.querySelector("#planner-eyebrow").textContent =
    `${focusedDestination.name} trip planner`;
  document.querySelector("#planner-heading").innerHTML =
    `Plan only for <span>${focusedDestination.name}.</span>`;
  document.querySelector("#planner-intro").textContent =
    `Your destination is fixed to ${focusedDestination.name}, ${focusedDestination.country}. Adjust the practical details below and PackSwift will keep every recommendation, activity, and logistics note specific to this trip.`;
}

async function loadDestinationCatalog() {
  const response = await fetch("/data/destinations.json");
  if (!response.ok) throw new Error("Destination catalog unavailable.");
  destinationCatalog = await response.json();

  const datalist = document.querySelector("#destination-options");
  const labels = new Set();
  for (const destination of destinationCatalog) {
    labels.add(destination.name);
    labels.add(`${destination.name}, ${destination.country}`);
    labels.add(destination.country);
    labels.add(destination.region);
  }
  datalist.replaceChildren(
    ...[...labels].sort().map((label) => {
      const option = document.createElement("option");
      option.value = label;
      return option;
    }),
  );
  applyFocusedDestinationMode();
  updateBudgetMinimum();
  updateLiveTripPreview();
}

function collectInput() {
  syncDestinationCurrency();
  const formData = new FormData(plannerForm);
  const travelStyle = travelStyleFromFormData(formData);
  const currency = String(formData.get("currency"));
  const budget = parseBudgetValue(formData.get("budget"));
  const tripPurpose = String(formData.get("tripPurpose") || "leisure");
  const adults = Math.max(1, Number(formData.get("adults") || 1));
  const children = Math.max(0, Number(formData.get("children") || 0));
  return {
    tripScope: String(formData.get("tripScope") || "international"),
    origin: String(formData.get("origin") || ""),
    budget,
    budgetUsd: budget * currencyRatesToUsd[currency],
    currency,
    travelers: adults + children,
    adults,
    children,
    startDate: String(formData.get("startDate")),
    endDate: String(formData.get("endDate")),
    destination: String(formData.get("destination")),
    preferredClimate: "any",
    pace: String(formData.get("pace")),
    smartPace: {
      lateRiser: formData.get("lateRiser") === "true",
      middayRest: formData.get("middayRest") === "true",
      clusterNearby: formData.get("clusterNearby") === "true",
    },
    tripPurpose,
    travelerDemographic: String(formData.get("travelerDemographic")),
    travelingWithPets: formData.get("travelingWithPets") === "true",
    interests: [...(purposeInterests[tripPurpose] || purposeInterests.leisure)],
    notes: String(formData.get("notes") || "").trim(),
    ...travelStyle,
  };
}

function validateInput(input) {
  const origin = resolveRouteLocation(input.origin);
  const destination = resolveRouteLocation(input.destination);
  if (!origin) return "Choose a supported origin city or country.";
  if (!destination) return "Choose a supported destination city or country.";
  if (input.tripScope !== "domestic" && origin.slug === destination.slug) {
    return "Choose a destination different from your origin.";
  }
  if (input.tripScope === "domestic" && origin.country !== destination.country) {
    return "Nationwide trips require the origin and destination to be in the same country.";
  }
  updateBudgetMinimum();
  if (
    !Number.isFinite(input.budget) ||
    input.budget <= 0 ||
    input.budgetUsd > 250000
  ) {
    return "Enter a trip budget greater than zero and within the supported planning range.";
  }
  if (!input.startDate || !input.endDate || dateValue(input.endDate) < dateValue(input.startDate)) {
    return "Choose an end date that is on or after your start date.";
  }
  return "";
}

function plannerValidationControl(input) {
  const origin = resolveRouteLocation(input.origin);
  const destination = resolveRouteLocation(input.destination);
  if (!origin) return document.querySelector("#origin-search");
  if (!destination || input.tripScope !== "domestic" && origin.slug === destination.slug) {
    return document.querySelector("#destination-search");
  }
  if (input.tripScope === "domestic" && origin.country !== destination.country) {
    return document.querySelector("#destination-search");
  }
  if (!Number.isFinite(input.budget) || input.budget <= 0 || input.budgetUsd > 250000) {
    return document.querySelector("#budget");
  }
  if (!input.startDate) return document.querySelector("#start-date-display");
  if (!input.endDate || dateValue(input.endDate) < dateValue(input.startDate)) {
    return document.querySelector("#end-date-display");
  }
  return null;
}

function weatherForMonth(destination, month) {
  const northWinter = [12, 1, 2].includes(month);
  const northSummer = [6, 7, 8].includes(month);
  const southSummer = [12, 1, 2].includes(month);
  const southWinter = [6, 7, 8].includes(month);
  const profiles = {
    "northern-seasonal": northWinter
      ? { low: -1, high: 8, climate: "cool" }
      : northSummer
        ? { low: 18, high: 29, climate: "warm" }
        : { low: 9, high: 21, climate: "mild" },
    "southern-seasonal": southSummer
      ? { low: 18, high: 29, climate: "warm" }
      : southWinter
        ? { low: 8, high: 18, climate: "cool" }
        : { low: 13, high: 24, climate: "mild" },
    mediterranean: northSummer
      ? { low: 21, high: 32, climate: "warm" }
      : northWinter
        ? { low: 7, high: 16, climate: "mild" }
        : { low: 14, high: 25, climate: "mild" },
    tropical: { low: 23, high: 32, climate: "warm" },
    equatorial: { low: 25, high: 32, climate: "warm" },
    monsoon: { low: 22, high: 32, climate: "warm" },
    desert: northSummer
      ? { low: 28, high: 42, climate: "hot" }
      : { low: 14, high: 28, climate: "warm" },
    highland: { low: 11, high: 24, climate: "mild" },
    "coastal-temperate": northSummer
      ? { low: 14, high: 23, climate: "mild" }
      : { low: 6, high: 15, climate: "cool" },
  };
  const profile = profiles[destination.climateProfile] || profiles["northern-seasonal"];
  let rain = destination.rain;
  if (
    ["monsoon", "tropical"].includes(destination.climateProfile) &&
    [6, 7, 8, 9, 10].includes(month)
  ) {
    rain = "high";
  }
  return {
    ...profile,
    rain,
    note: `${monthNames[month - 1]} typically brings ${profile.climate} conditions around ${profile.low}–${profile.high}°C with ${rain} rainfall likelihood.`,
  };
}

function buildLocalPacking(input, weather) {
  const list = {
    Essentials: ["Passport and travel documents", "Phone charger and adapter"],
    Clothing: ["Comfortable walking shoes", "Versatile day layers"],
    Comfort: ["Small day bag", "Basic first-aid items"],
  };
  if (["warm", "hot"].includes(weather.climate)) list.Comfort.push("Sun protection");
  if (weather.rain !== "low") list.Comfort.push("Compact umbrella or rain shell");
  if (input.tripPurpose === "business") list.Essentials.push("Meeting documents and laptop");
  if (input.tripPurpose === "adventure") list.Comfort.push("Activity-ready footwear");
  if (input.accommodationStyle === "hostel") list.Comfort.push("Travel towel", "Small luggage lock", "Sleep mask");
  if (input.foodStyle === "fine" || input.planningGoal === "luxury") list.Clothing.push("Smart evening outfit");
  if (input.transportStyle === "public") list.Comfort.push("Compact transit daypack", "Offline transit map");
  if (input.travelingWithPets) list["Pet care"] = ["Pet documents", "Secure carrier", "Food and medication"];
  return list;
}

function localScore(destination, input, days, month, weather) {
  const estimated = destination.dailyBudgetUsd * days * input.travelers;
  const budgetFit = estimated <= input.budgetUsd
    ? 35 +
      (1 - estimated / input.budgetUsd <= 0.05
        ? 4
        : 1 - estimated / input.budgetUsd <= 0.1
          ? 2
          : 0)
    : 35 * (input.budgetUsd / estimated);
  const matches = destination.interests.filter((interest) =>
    input.interests.includes(interest),
  ).length;
  const purposeMatches = destination.interests.filter((interest) =>
    (purposeInterests[input.tripPurpose] || purposeInterests.leisure).includes(interest),
  ).length;
  const monthFit = destination.bestMonths.includes(month) ? 15 : 7;
  const purposeFit = input.tripPurpose === "business"
    ? destination.businessScore * 3
    : input.tripPurpose === "family"
      ? destination.familyScore * 3
      : Math.min(15, 7 + purposeMatches * 3);
  const petFit = input.travelingWithPets ? destination.petScore : 5;
  const climateFit =
    input.preferredClimate === "any" ||
    input.preferredClimate === weather.climate ||
    (input.preferredClimate === "warm" && weather.climate === "hot")
      ? 8
      : 3;
  const intentionFit = input.planningGoal === "luxury"
    ? Math.min(7, destination.dailyBudgetUsd / 25)
    : ["make-possible", "fixed-budget"].includes(input.planningGoal)
      ? Math.min(7, 140 / Math.max(25, destination.dailyBudgetUsd))
      : 5;
  const gatewayFit = Math.min(7, Number(destination.businessScore || 0) * 1.3);
  return Math.min(
    100,
    Math.round(budgetFit + Math.min(17, 5 + matches * 3) + monthFit + purposeFit + petFit + climateFit + intentionFit + gatewayFit),
  );
}

function localActivityPreviews(destination, input) {
  const source = destination.activityPreviews?.length
    ? destination.activityPreviews
    : destination.attractions.map((attraction) => ({
        title: attraction,
        category: "Highlight",
        interests: destination.interests.slice(0, 2),
        costUsd: Math.max(8, Math.round(destination.dailyBudgetUsd * 0.18)),
        description: `Make time for ${attraction} with a pace that suits your trip.`,
      }));
  const preferred = new Set([
    ...input.interests,
    ...(purposeInterests[input.tripPurpose] || purposeInterests.leisure),
  ]);

  return source
    .map((activity, index) => ({
      activity,
      index,
      relevance:
        (activity.interests || []).filter((interest) => preferred.has(interest)).length * 4 +
        (activity.category?.toLowerCase() === input.tripPurpose ? 3 : 0),
    }))
    .sort((first, second) =>
      second.relevance - first.relevance || first.index - second.index,
    )
    .slice(0, 3)
    .map(({ activity }) => ({
      ...activity,
      estimatedCost:
        Math.round(((activity.costUsd || 0) / currencyRatesToUsd[input.currency]) * 100) /
        100,
      currency: input.currency,
    }));
}

async function buildLocalPlan(input) {
  if (!destinationCatalog.length) await loadDestinationCatalog();
  const days = getDays(input.startDate, input.endDate);
  const month = new Date(`${input.startDate}T00:00:00`).getMonth() + 1;
  const query = input.destination.trim().toLowerCase();
  const candidates = destinationCatalog.filter((destination) =>
    !query ||
    [destination.name, destination.country, destination.region]
      .some((value) => value.toLowerCase().includes(query)),
  );
  if (!candidates.length) {
    throw new Error("No supported destination matched that search. Try another city, country, or region.");
  }
  const ranked = candidates
    .map((destination) => {
      const weather = weatherForMonth(destination, month);
      return {
        ...destination,
        weather,
        climate: weather.climate,
        temperatures: { low: weather.low, high: weather.high },
        score: localScore(destination, input, days, month, weather),
      };
    })
    .sort((first, second) => second.score - first.score);
  const destination = ranked[0];
  const origin = resolveRouteLocation(input.origin);
  const routeDestination = resolveRouteLocation(destination.name);
  const routeBudget = minimumTripBudgetDetails(
    input.tripScope,
    origin,
    routeDestination,
    input.travelers,
    days,
  );
  const estimatedTransitCostUsd = routeBudget.transitCostPerPersonUsd;
  const style = {
    planningGoal: input.planningGoal || "best-value",
    accommodationStyle: input.accommodationStyle || "comfortable",
    foodStyle: input.foodStyle || "mixed",
    transportStyle: input.transportStyle || "mixed",
    activityStyle: input.activityStyle || "balanced",
    shoppingStyle: input.shoppingStyle || "light",
    mustHaveExperience: input.mustHaveExperience || "",
  };
  const budgetScenarios = tripBudgetScenarios({
    scope: input.tripScope, origin, destination: routeDestination,
    adults: input.adults, children: input.children, days,
    budgetUsd: input.budgetUsd, style,
  });
  const selectedEstimateUsd = input.planningGoal === "make-possible"
    ? budgetScenarios.viableUsd
    : input.planningGoal === "luxury"
      ? budgetScenarios.comfortUsd
      : budgetScenarios.recommendedUsd;
  const estimatedCostUsd = selectedEstimateUsd;
  const estimatedCost = estimatedCostUsd / currencyRatesToUsd[input.currency];
  const budgetDifference = Math.round(Math.abs(input.budget - estimatedCost) * 100) / 100;
  const withinBudget = estimatedCost <= input.budget;
  const budgetMessage = withinBudget
    ? `Your ${planningGoalLabels[input.planningGoal].toLowerCase()} plan stays within ${formatMoney(input.budget, input.currency)}, leaving about ${formatMoney(budgetDifference, input.currency)} for flexibility.`
    : ["make-possible", "fixed-budget"].includes(input.planningGoal)
      ? `${formatMoney(input.budget, input.currency)} remains accepted as your limit. PackSwift will protect essential experiences and suggest flexible dates, fewer nights, simpler stays, public transport, and free highlights.`
      : `The lifestyle-matched plan is about ${formatMoney(budgetDifference, input.currency)} above your current budget. Compare the minimum viable and comfort paths before changing the trip.`;
  const previewDays = Math.min(days, 4);
  const itinerary = Array.from({ length: previewDays }, (_, index) => {
    const first = destination.attractions[index % destination.attractions.length];
    const second = destination.attractions[(index + 1) % destination.attractions.length];
    return {
      day: index + 1,
      title: index === 0 ? "Arrive and orient" : `Explore ${first}`,
      morning: input.smartPace.lateRiser
        ? `10:30 start · ${index === 0 ? "Settle in and orient" : first}`
        : index === 0
          ? `08:30 start · ${["private", "premium"].includes(input.transportStyle) ? "Private airport transfer" : "Practical airport transfer"} and orientation`
          : `08:30 start · ${first}`,
      afternoon: index === 1 && input.mustHaveExperience
        ? `Protected priority · ${input.mustHaveExperience}`
        : input.smartPace.middayRest
        ? `14:00–16:00 rest · ${second} afterwards`
        : input.pace === "relaxed"
          ? `Unhurried time around ${second}`
          : `${second} and a nearby local lunch${input.smartPace.clusterNearby ? " in the same area" : ""}`,
    };
  });
  const normalizedInput = {
    ...input,
    budgetUsd: Math.round(input.budgetUsd * 100) / 100,
    route: {
      scope: input.tripScope,
      origin,
      destination: routeDestination,
      estimatedTransitCostUsd,
      distanceKm: routeBudget.distanceKm,
      transitCostPerPersonUsd: routeBudget.transitCostPerPersonUsd,
      totalTransitCostUsd: routeBudget.totalTransitCostUsd,
      dailyRatePerPersonUsd: routeBudget.dailyRatePerPersonUsd,
      dailyStayCostUsd: routeBudget.dailyStayCostUsd,
      travelers: routeBudget.travelers,
      days: routeBudget.days,
      minimumBudgetUsd: routeBudget.minimumBudgetUsd,
    },
  };

  return {
    id: globalThis.crypto?.randomUUID?.() || `trip-${Date.now()}`,
    createdAt: new Date().toISOString(),
    input: normalizedInput,
    days,
    travelMonth: monthNames[month - 1],
    destination,
    alternatives: ranked.slice(1, 4).map((alternative) => {
      const alternativeCost =
        (alternative.dailyBudgetUsd * days * input.travelers) /
        currencyRatesToUsd[input.currency];
      return {
        slug: alternative.slug,
        name: alternative.name,
        country: alternative.country,
        region: alternative.region,
        score: alternative.score,
        estimatedCost: Math.round(alternativeCost * 100) / 100,
        withinBudget: alternativeCost <= input.budget,
      };
    }),
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    estimatedCostUsd,
    budgetFit: {
      withinBudget,
      difference: budgetDifference,
      message: budgetMessage,
      planningGoal: input.planningGoal,
      fit: budgetScenarios.fit,
    },
    budgetScenarios: {
      ...budgetScenarios,
      viable: budgetScenarios.viableUsd / currencyRatesToUsd[input.currency],
      recommended: budgetScenarios.recommendedUsd / currencyRatesToUsd[input.currency],
      comfort: budgetScenarios.comfortUsd / currencyRatesToUsd[input.currency],
      currency: input.currency,
    },
    bestTimeToVisit: destination.bestMonths.map((value) => monthNames[value - 1]).join(", "),
    costNote: `This estimate includes return transit, ${input.accommodationStyle} accommodation, ${input.foodStyle} dining, ${input.transportStyle} transport, and ${input.activityStyle} activities. The budget paths are guidance—not a barrier to planning.`,
    summary: `${destination.name} is the strongest ${purposeLabels[input.tripPurpose] || titleCase(input.tripPurpose)} match for ${input.travelers} ${input.travelers === 1 ? "traveller" : "travellers"} in ${monthNames[month - 1]}. ${budgetMessage}`,
    weather: destination.weather,
    itinerary,
    activityPreviews: localActivityPreviews(destination, input),
    packingList: buildLocalPacking(input, destination.weather),
    culturalNotes: destination.culturalNotes,
  };
}

async function requestPlan(input) {
  try {
    const result = await window.PackSwift.api("/api/trips/analyze", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const plan = { ...result.plan, persistence: result.persistence };
    if (
      focusedDestination &&
      plan.destination?.slug?.toLowerCase() !== focusedDestination.slug.toLowerCase()
    ) {
      const focusedPlan = await buildLocalPlan({
        ...input,
        destination: focusedDestination.name,
      });
      return {
        ...focusedPlan,
        alternatives: [],
        persistence: { saved: false, reason: "focused_destination" },
      };
    }
    if (focusedDestination) plan.alternatives = [];
    return plan;
  } catch (error) {
    if (![404, 405, 503].includes(error.status)) throw error;
    const plan = await buildLocalPlan(input);
    return {
      ...plan,
      persistence: { saved: false, reason: "device_only" },
    };
  }
}

function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "code",
      maximumFractionDigits: currency === "JPY" || currency === "KRW" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

function activityTitleFor(destination, input) {
  return localActivityPreviews(destination, input)[0]?.title ||
    destination.attractions[0];
}

function setFeaturedState(destinationName) {
  for (const preset of featuredPresets) {
    preset.setAttribute(
      "aria-pressed",
      String(preset.dataset.featuredDestination === destinationName),
    );
  }
}

function renderPlan(plan) {
  document.querySelector("#result-score").textContent = `${plan.destination.score}%`;
  plan.destination.code ||= plan.destination.slug?.slice(0, 3).toUpperCase();
  emptyResult.hidden = true;
  planResult.hidden = false;
  renderDestinationRoute(plan);
}

function renderDestinationRoute(plan) {
  return window.PackSwiftRouteEditor.load(plan);
}

function handleLivePlannerEdit() {
  if (!planResult.hidden) {
    activePlan = null;
    planResult.hidden = true;
    emptyResult.hidden = false;
    assistReadyButton.hidden = true;
    saveTripFeedback.textContent = "";
  }
  updateLiveTripPreview();
}

function readLocalTrips() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function packingContextFromPlan(plan) {
  const destination = plan.destination || {};
  const displayName =
    destination.displayName ||
    [destination.name, destination.country].filter(Boolean).join(", ");
  return {
    version: 1,
    source: "trip-planner",
    planId: plan.id,
    tripId: plan.persistence?.saved
      ? plan.persistence.tripId || plan.id
      : null,
    destination: {
      slug: destination.slug || null,
      name: destination.name || displayName,
      countryName: destination.countryName || destination.country || "",
      displayName,
      primaryAirportCode:
        destination.primaryAirportCode || destination.code || null,
    },
    dates: {
      start: plan.input?.startDate || null,
      end: plan.input?.endDate || null,
      days: plan.days || 1,
    },
    weather: {
      climate:
        plan.weather?.climate ||
        destination.climate ||
        plan.input?.preferredClimate ||
        "mild",
      rain: plan.weather?.rain || destination.rain || "moderate",
      low: plan.weather?.low ?? null,
      high: plan.weather?.high ?? null,
      note: plan.weather?.note || "",
    },
    tripPurpose: plan.input?.tripPurpose || "leisure",
    pace: plan.input?.pace || "balanced",
    smartPace: plan.input?.smartPace || {
      lateRiser: false,
      middayRest: false,
      clusterNearby: false,
    },
    travelers: plan.input?.travelers || 1,
    travelerBreakdown: {
      adults: plan.input?.adults || plan.input?.travelers || 1,
      children: plan.input?.children || 0,
    },
    route: plan.input?.route || null,
    travelerDemographic:
      plan.input?.travelerDemographic || "adults",
    travelingWithPets:
      plan.input?.travelingWithPets === true,
    interests: plan.input?.interests || [],
    packingList: plan.packingList || null,
  };
}

function rememberPackingHandoff(plan) {
  const context = packingContextFromPlan(plan);
  localStorage.setItem(latestPlanKey, JSON.stringify(plan));
  try {
    sessionStorage.setItem(packingHandoffKey, JSON.stringify(context));
  } catch {
    // Local storage still provides a device-only fallback.
  }
  return context;
}

function savePlanLocally(plan) {
  const trips = readLocalTrips().filter((trip) => trip.id !== plan.id);
  trips.unshift(plan);
  localStorage.setItem(storageKey, JSON.stringify(trips.slice(0, 12)));
  rememberPackingHandoff(plan);
}

function readLatestPlan() {
  try {
    const plan = JSON.parse(localStorage.getItem(latestPlanKey) || "null");
    return plan?.destination && plan?.input ? plan : null;
  } catch {
    return null;
  }
}

function planAnalysisInput(plan) {
  const input = plan.input || {};
  return {
    tripScope: input.tripScope || input.route?.scope || "international",
    origin: input.origin || input.route?.origin?.name || "Yangon",
    budget: input.budget,
    currency: input.currency,
    travelers: input.travelers,
    adults: input.adults || input.travelers || 1,
    children: input.children || 0,
    startDate: input.startDate,
    endDate: input.endDate,
    destination:
      plan.destination?.name ||
      input.destination ||
      input.destinationQuery ||
      "",
    preferredClimate: input.preferredClimate || "any",
    pace: input.pace || "balanced",
    smartPace: input.smartPace || {
      lateRiser: false,
      middayRest: false,
      clusterNearby: false,
    },
    tripPurpose: input.tripPurpose || "leisure",
    travelerDemographic: input.travelerDemographic || "couples",
    travelingWithPets: input.travelingWithPets === true,
    interests: input.interests || [],
    notes: input.notes || "",
    planningGoal: input.planningGoal || "best-value",
    accommodationStyle: input.accommodationStyle || "comfortable",
    foodStyle: input.foodStyle || "mixed",
    transportStyle: input.transportStyle || "mixed",
    activityStyle: input.activityStyle || "balanced",
    shoppingStyle: input.shoppingStyle || "light",
    dateFlexible: input.dateFlexible === true,
    tripLengthFlexible: input.tripLengthFlexible === true,
    mustHaveExperience: input.mustHaveExperience || "",
    arrivalAt: input.arrivalAt || null,
    hotelName: input.hotelName || null,
    hotelAddress: input.hotelAddress || null,
  };
}

function restorePlannerFormFromPlan(plan) {
  const input = plan.input || {};
  originSearch.value =
    input.origin || input.route?.origin?.name || "Yangon";
  destinationSearch.value =
    input.destination ||
    input.destinationQuery ||
    plan.destination?.name ||
    "";
  const localCurrency = PackSwiftCurrency.resolve(plan.destination || destinationSearch.value).code;
  if (input.budget) {
    const oldRate = currencyRatesToUsd[input.currency] || currencyRatesToUsd[localCurrency];
    setBudgetValue(Math.round(input.budget * oldRate / currencyRatesToUsd[localCurrency]));
  }
  currencyInput.value = localCurrency;
  setTravellerCount("adults", input.adults || input.travelers || 1);
  setTravellerCount("children", input.children || 0);
  const scope = input.tripScope || input.route?.scope || "international";
  const scopeInput = plannerForm.querySelector(`input[name="tripScope"][value="${scope}"]`);
  if (scopeInput) scopeInput.checked = true;
  syncTripScopeState();
  if (input.startDate) {
    setPlannerDate("start", input.startDate);
  }
  if (input.endDate) {
    setPlannerDate("end", input.endDate);
  }
  if (input.tripPurpose) {
    const restoredPurpose = input.tripPurpose === "family" ? "leisure" : input.tripPurpose;
    if ([...document.querySelector("#trip-purpose").options]
      .some((option) => option.value === restoredPurpose)) {
      document.querySelector("#trip-purpose").value = restoredPurpose;
    }
  }
  if (input.travelerDemographic) {
    const restoredGroup = {
      adults: "couples",
      "young-adults": "friends-group",
    }[input.travelerDemographic] || input.travelerDemographic;
    document.querySelector("#traveler-demographic").value =
      restoredGroup;
  }

  for (const paceOption of plannerForm.querySelectorAll(
    'input[name="pace"]',
  )) {
    const restoredPace = input.pace === "active" ? "packed" : (input.pace || "balanced");
    paceOption.checked = paceOption.value === restoredPace;
  }
  for (const smartOption of ["lateRiser", "middayRest", "clusterNearby"]) {
    const inputElement = plannerForm.querySelector(`input[name="${smartOption}"]`);
    inputElement.checked = input.smartPace?.[smartOption] === true;
  }
  const petOption = plannerForm.querySelector(
    'input[name="travelingWithPets"]',
  );
  petOption.checked = input.travelingWithPets === true;
  tripNotesInput.value = input.notes || "";
  const lifestyleValues = {
    accommodationStyle: input.accommodationStyle || "comfortable",
    foodStyle: input.foodStyle || "mixed",
    transportStyle: input.transportStyle || "mixed",
    activityStyle: input.activityStyle || "balanced",
    shoppingStyle: input.shoppingStyle || "light",
  };
  for (const [name, value] of Object.entries(lifestyleValues)) {
    const control = plannerForm.elements.namedItem(name);
    if (control && [...control.options].some((option) => option.value === value)) {
      control.value = value;
    }
  }
  const restoredGoal = input.planningGoal || "best-value";
  for (const option of plannerForm.querySelectorAll('input[name="planningGoal"]')) {
    option.checked = option.value === restoredGoal;
  }
  for (const field of ["dateFlexible", "tripLengthFlexible"]) {
    const control = plannerForm.querySelector(`input[name="${field}"]`);
    control.checked = input[field] === true;
  }
  plannerForm.elements.namedItem("mustHaveExperience").value = input.mustHaveExperience || "";
  updateBudgetMinimum();
}

function storedTripPlannerPlan(trip) {
  return {
    input: {
      tripScope: trip.route?.scope || "international",
      origin: trip.route?.origin?.name || "Yangon",
      route: trip.route,
      destination: trip.destination?.displayName || trip.destination?.name || "",
      destinationQuery: trip.destination?.name || "",
      budget: trip.budget?.amount || 0,
      currency: trip.budget?.currency || "USD",
      travelers: trip.travelers || 1,
      adults: trip.travelerBreakdown?.adults || trip.travelers || 1,
      children: trip.travelerBreakdown?.children || 0,
      startDate: trip.dates?.start || "",
      endDate: trip.dates?.end || "",
      tripPurpose: trip.tripPurpose || "leisure",
      travelerDemographic: trip.preferences?.travelerDemographic || "couples",
      travelingWithPets: trip.preferences?.travelingWithPets === true,
      pace: trip.pace || "balanced",
      smartPace: trip.preferences?.smartPace || {
        lateRiser: false,
        middayRest: false,
        clusterNearby: true,
      },
      interests: trip.interests || [],
      planningGoal: trip.preferences?.planningGoal || "best-value",
      accommodationStyle: trip.preferences?.accommodationStyle || "comfortable",
      foodStyle: trip.preferences?.foodStyle || "mixed",
      transportStyle: trip.preferences?.transportStyle || "mixed",
      activityStyle: trip.preferences?.activityStyle || "balanced",
      shoppingStyle: trip.preferences?.shoppingStyle || "light",
      dateFlexible: trip.preferences?.dateFlexible === true,
      tripLengthFlexible: trip.preferences?.tripLengthFlexible === true,
      mustHaveExperience: trip.preferences?.mustHaveExperience || "",
    },
    destination: trip.destination,
    weather: trip.weather,
    summary: trip.summary,
    persistence: { saved: true, tripId: trip.tripId, databaseId: trip.id },
  };
}

function pendingRecommendationInput(recommendation) {
  const purposeMap = {
    "Adventure & Outdoor": "adventure",
    "Adventure & Leisure": "adventure",
    "Leisure & Relaxation": "leisure",
    "Culture & Heritage": "cultural",
    "Food & Nightlife": "food",
  };
  const groupMap = {
    Solo: "solo",
    Couples: "couples",
    Friends: "friends-group",
    Family: "family-with-children",
  };
  const paceMap = {
    "Slow & Relaxed": "relaxed",
    "Balanced & Steady": "balanced",
    "Packed & Fast": "packed",
  };
  const toIso = (value) => {
    const [day, month, year] = String(value || "").split("/");
    return /^\d{2}$/.test(day) && /^\d{2}$/.test(month) && /^\d{4}$/.test(year)
      ? `${year}-${month}-${day}` : "";
  };
  const currency = recommendation.currency || "USD";
  const tripPurpose = purposeMap[recommendation.travel_purpose] || "leisure";
  const adults = Math.max(1, Number(recommendation.adults_count || 1));
  const children = Math.max(0, Number(recommendation.children_count || 0));
  const budget = Math.max(1, Number(recommendation.total_budget || 1));
  const destinationQuery = String(recommendation.destination || "").split(",")[0].trim();
  return {
    tripScope: recommendation.scope === "Nationwide" ? "domestic" : "international",
    origin: recommendation.origin,
    destination: destinationQuery,
    destinationQuery,
    startDate: toIso(recommendation.start_date),
    endDate: toIso(recommendation.end_date),
    budget,
    budgetUsd: budget * (currencyRatesToUsd[currency] || 1),
    currency,
    adults,
    children,
    travelers: adults + children,
    travelingWithPets: recommendation.pet_included === true,
    tripPurpose,
    travelerDemographic: groupMap[recommendation.travel_group] || "solo",
    pace: paceMap[recommendation.travel_pace] || "balanced",
    smartPace: { lateRiser: false, middayRest: false, clusterNearby: true },
    preferredClimate: "any",
    interests: [...(purposeInterests[tripPurpose] || purposeInterests.leisure)],
    notes: recommendation.summary_pitch || "",
    planningGoal: recommendation.planning_goal || "best-value",
    accommodationStyle: recommendation.accommodation_style || "comfortable",
    foodStyle: recommendation.food_style || "mixed",
    transportStyle: recommendation.transport_style || "mixed",
    activityStyle: recommendation.activity_style || "balanced",
    shoppingStyle: recommendation.shopping_style || "light",
    dateFlexible: recommendation.date_flexible === true,
    tripLengthFlexible: recommendation.trip_length_flexible === true,
    mustHaveExperience: recommendation.must_have_experience || "",
  };
}

function applyCuratedGuideRoute(plan, recommendation) {
  const route = Array.isArray(recommendation?.curated_route)
    ? recommendation.curated_route.filter((item) => item && item.name)
    : [];
  if (!route.length || !plan?.destination) return plan;
  const days = [...new Set(route.map((item) => Number(item.day) || 1))].sort((a, b) => a - b);
  plan.destination.attractions = [...new Set(route.map((item) => item.name))];
  plan.itinerary = days.map((day) => {
    const stops = route.filter((item) => (Number(item.day) || 1) === day);
    return {
      day,
      title: `Pocket Guide Day ${day}`,
      morning: stops.slice(0, 1).map((item) => `${item.time} ${item.name}`).join(" · ") || "Flexible morning",
      afternoon: stops.slice(1, 2).map((item) => `${item.time} ${item.name}`).join(" · ") || "Local discovery",
      evening: stops.slice(2).map((item) => `${item.time} ${item.name}`).join(" · ") || "Easy evening",
      activities: stops,
    };
  });
  plan.activityPreviews = route.slice(0, 6).map((item, index) => ({
    title: item.name,
    category: item.tag || "Pocket Guide",
    description: [item.time, item.transit].filter(Boolean).join(" · "),
    estimatedCost: 12 + index * 4,
    currency: plan.input?.currency || recommendation.currency || "USD",
  }));
  plan.summary = `${plan.summary} This preview uses the exact curated Pocket Guide route.`;
  return plan;
}

async function hydratePendingAiTrip() {
  const params = new URLSearchParams(window.location.search);
  let pending = null;
  try {
    pending = JSON.parse(
      sessionStorage.getItem(pendingPackswiftTripKey) ||
      sessionStorage.getItem(legacyPendingAiTripKey) ||
      "null",
    );
  } catch {
    pending = null;
  }
  const hasPendingMarker = params.get("pending_ai_trip") === "1" ||
    params.get("pending_packswift_trip") === "1";
  if (!pending && !hasPendingMarker) return false;
  if (!pending || typeof pending !== "object") {
    plannerFeedback.textContent = "Your AI trip preview expired. Ask PackSwift Concierge to create it again.";
    return true;
  }

  const recommendation = pending.recommendation || (pending.input ? null : pending);
  const input = pending.input || pendingRecommendationInput(recommendation);
  restorePlannerFormFromPlan({ input });
  updateLiveTripPreview();
  const user = await window.PackSwift.authReady;
  if (!user) {
    plannerFeedback.textContent = "Log in or create an account to continue this saved trip.";
    showTripLoginRequired(input);
    return true;
  }
  try {
    if (recommendation) {
      const result = await window.PackSwift.api("/api/trips/create", {
        method: "POST",
        body: JSON.stringify({ recommendation }),
      });
      activePlan = result.plan;
      localStorage.setItem(latestPlanKey, JSON.stringify(activePlan));
      sessionStorage.setItem(conciergeGeneratedTripKey, JSON.stringify({
        tripId: result.trip_id,
        plan: activePlan,
      }));
      window.history.replaceState({}, "", result.redirect_url ||
        `/trip-planner?trip_id=${encodeURIComponent(result.trip_id)}`);
    } else {
      activePlan = await requestPlan(input);
      if (!activePlan.persistence?.saved) activePlan = await ensureAuthenticatedPlan(activePlan);
    }
    await syncSelectedActivitiesToPlan(activePlan);
    sessionStorage.removeItem(pendingPackswiftTripKey);
    sessionStorage.removeItem(legacyPendingAiTripKey);
    sessionStorage.removeItem(pendingAiTripModeKey);
    sessionStorage.removeItem(authRedirectTargetKey);
    localStorage.setItem(latestPlanKey, JSON.stringify(activePlan));
    activePlan = applyCuratedGuideRoute(activePlan, recommendation);
    restorePlannerFormFromPlan(activePlan);
    renderPlan(activePlan);
    updateLiveTripPreview();
    plannerFeedback.textContent = "Welcome back — your saved trip details were loaded automatically. 🎉";
    return true;
  } catch (error) {
    plannerFeedback.textContent = error.message || "The AI trip preview could not be loaded.";
    return true;
  }
}

async function hydrateConciergeTripFromQuery() {
  if (await hydratePendingAiTrip()) return;
  const tripId = new URLSearchParams(window.location.search).get("trip_id");
  if (!tripId) return;
  let generated = null;
  try {
    generated = JSON.parse(sessionStorage.getItem(conciergeGeneratedTripKey) || "null");
  } catch {
    generated = null;
  }
  if (generated?.tripId === tripId && generated.plan?.input) {
    activePlan = generated.plan;
    restorePlannerFormFromPlan(activePlan);
    renderPlan(activePlan);
    updateLiveTripPreview();
    plannerFeedback.textContent = "Trip plan generated successfully! 🎉 Your Concierge choices are ready to review.";
    return;
  }
  const user = await window.PackSwift.authReady;
  if (!user) {
    plannerFeedback.textContent = "Log in to load this saved Concierge trip.";
    return;
  }
  try {
    const { trip } = await window.PackSwift.api(`/api/trips/${encodeURIComponent(tripId)}`);
    restorePlannerFormFromPlan(storedTripPlannerPlan(trip));
    updateLiveTripPreview();
    plannerFeedback.textContent = "Your saved Concierge trip inputs are loaded and ready to adjust.";
  } catch (error) {
    plannerFeedback.textContent = error.message || "The Concierge trip could not be loaded.";
  }
}

async function loadSavedTravelPreferences() {
  if (activePlan) return;
  const params = new URLSearchParams(window.location.search);
  if (params.has("trip_id") || params.has("pending_ai_trip") || params.has("pending_packswift_trip")) return;
  if (sessionStorage.getItem(pendingPackswiftTripKey) || sessionStorage.getItem(legacyPendingAiTripKey)) return;
  const user = await window.PackSwift.authReady;
  if (!user) return;
  try {
    const { profile } = await window.PackSwift.api("/api/profile", { cache: "no-store" });
    const preferences = profile?.travelPreferences;
    if (!preferences) return;
    restorePlannerFormFromPlan({
      input: {
        ...collectInput(),
        planningGoal: preferences.planning_goal,
        accommodationStyle: preferences.accommodation_style,
        foodStyle: preferences.food_style,
        transportStyle: preferences.transport_style,
        activityStyle: preferences.activity_style,
        shoppingStyle: preferences.shopping_style,
        dateFlexible: Boolean(preferences.date_flexible),
        tripLengthFlexible: Boolean(preferences.trip_length_flexible),
        mustHaveExperience: preferences.must_have_experience || "",
      },
    });
    updateLiveTripPreview();
  } catch {
    // A first-time traveler simply keeps the balanced defaults.
  }
}

async function ensureAuthenticatedPlan(plan) {
  if (plan.persistence?.saved && plan.persistence.tripId) {
    return plan;
  }
  let result;
  try {
    result = await window.PackSwift.api("/api/trips/analyze", {
      method: "POST",
      body: JSON.stringify(planAnalysisInput(plan)),
    });
  } catch (error) {
    if (![404, 405, 503].includes(error.status)) throw error;
    result = await window.PackSwift.api("/api/trips/import", {
      method: "POST",
      body: JSON.stringify({ plan }),
    });
  }
  if (!result.persistence?.saved || !result.persistence.tripId) {
    throw new Error("PackSwift could not save this trip yet.");
  }
  const authenticatedPlan = {
    ...result.plan,
    persistence: result.persistence,
    ...(plan.visualDayTour ? { visualDayTour: structuredClone(plan.visualDayTour), itinerary: structuredClone(plan.itinerary) } : {}),
  };
  savePlanLocally(authenticatedPlan);
  return authenticatedPlan;
}

function tripPlannerReturnPath() {
  return `${window.location.pathname}${window.location.search}`;
}

function tripLoginDestination(path = "/login") {
  return `${path}?redirect=${encodeURIComponent("/trip-planner")}`;
}

function persistPendingPlannerTrip(input) {
  if (!input) return;
  const pendingTrip = {
    source: "trip-planner",
    input,
    notes: input.notes || activePlan?.summary || "",
  };
  sessionStorage.setItem(pendingPackswiftTripKey, JSON.stringify(pendingTrip));
  sessionStorage.setItem(authRedirectTargetKey, "/trip-planner");
  sessionStorage.setItem(pendingAiTripModeKey, "save_after_auth");
}

function showTripLoginRequired(input = activePlan?.input) {
  persistPendingPlannerTrip(input);
  tripLoginLink.href = tripLoginDestination("/login");
  tripSignupLink.href = tripLoginDestination("/signup");
  if (typeof tripLoginRequiredDialog.showModal === "function") {
    tripLoginRequiredDialog.showModal();
    return;
  }
  window.alert("Log in to save trip.");
  window.location.assign(tripLoginLink.href);
}

async function saveActiveTripToAccount() {
  if (!activePlan) return;
  saveTripButton.disabled = true;
  saveTripButton.textContent = "Saving…";
  saveTripFeedback.className = "packing-save-feedback";
  saveTripFeedback.textContent = "";
  savePlanLocally(activePlan);

  try {
    activePlan = await ensureAuthenticatedPlan(activePlan);
    await syncSelectedActivitiesToPlan(activePlan);
    rememberPackingHandoff(activePlan);
    restorePlannerFormFromPlan(activePlan);
    renderPlan(activePlan);
    await window.PackSwift.api("/api/saved-trips", {
      method: "POST",
      body: JSON.stringify({ plan: activePlan }),
    });
    saveTripFeedback.className =
      "packing-save-feedback is-success";
    saveTripFeedback.textContent =
      "Trip plan saved to My Trips and linked to your account ✓";
    saveTripButton.textContent = "Saved to My Trips ✓";
    assistReadyButton.href =
      `/assist-trip?trip=${encodeURIComponent(activePlan.persistence.tripId)}`;
    assistReadyButton.hidden = false;
  } catch (error) {
    saveTripFeedback.className = "packing-save-feedback is-error";
    saveTripFeedback.textContent = error.message;
    saveTripButton.textContent = "Try saving again";
  } finally {
    sessionStorage.removeItem(pendingTripSaveKey);
    saveTripButton.disabled = false;
  }
}

plannerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  plannerFeedback.textContent = "";
  if (!window.PackSwift.forms.validate(plannerForm)) return;
  const input = collectInput();
  const error = validateInput(input);
  if (error) {
    const control = plannerValidationControl(input);
    if (control) window.PackSwift.forms.showFieldError(control, error);
    else plannerFeedback.textContent = error;
    return;
  }

  const user = await window.PackSwift.authReady;
  if (!user) {
    showTripLoginRequired(input);
    return;
  }

  const button = plannerForm.querySelector('[type="submit"]');
  button.disabled = true;
  button.textContent = "Shaping your plan…";
  try {
    activePlan = await requestPlan(input);
    await syncSelectedActivitiesToPlan(activePlan);
    rememberPackingHandoff(activePlan);
    renderPlan(activePlan);
    saveTripButton.textContent = "Save to My Trips";
    assistReadyButton.hidden = true;
    saveTripFeedback.textContent = "";
    planResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (requestError) {
    plannerFeedback.textContent = requestError.message;
  } finally {
    button.disabled = false;
    button.innerHTML = 'Plan my trip <span aria-hidden="true">→</span>';
  }
});

createPackingListButton.addEventListener("click", (event) => {
  if (!activePlan) return;
  event.preventDefault();
  const context = rememberPackingHandoff(activePlan);
  const destination = new URL("/packing-list", window.location.origin);
  if (context.tripId) {
    destination.searchParams.set("trip", context.tripId);
  }
  window.location.assign(`${destination.pathname}${destination.search}`);
});

saveTripButton.addEventListener("click", async () => {
  if (!activePlan) return;
  savePlanLocally(activePlan);
  const user = await window.PackSwift.authReady;

  if (!user) {
    showTripLoginRequired();
    return;
  }
  await saveActiveTripToAccount();
});

for (const preset of featuredPresets) {
  preset.addEventListener("click", () => {
    const destination = preset.dataset.featuredDestination;
    if (isDomesticTrip()) {
      syncTripScopeState({ preserveInternationalDestination: false });
    } else {
      destinationSearch.value = destination;
      destinationSearch.dataset.internationalValue = destination;
      setFeaturedState(destination);
    }
    updateBudgetMinimum();
    handleLivePlannerEdit();
  });
}

destinationSearch.addEventListener("input", () => {
  destinationSearch.dataset.internationalValue = destinationSearch.value;
  setFeaturedState(destinationSearch.value.trim());
  updateBudgetMinimum();
});

originSearch.addEventListener("input", () => {
  if (isDomesticTrip()) syncTripScopeState({ preserveInternationalDestination: false });
});

for (const scopeInput of plannerForm.querySelectorAll('input[name="tripScope"]')) {
  scopeInput.addEventListener("change", () => syncTripScopeState());
}

budgetInput.addEventListener("input", () => {
  const amount = parseBudgetValue(budgetInput.value);
  budgetInput.value = amount ? formatBudgetValue(amount) : "";
});

// Use existing backend-supported values so saved plans remain compatible.
const intentionLifestylePresets = {
  "make-possible": ["hostel", "street", "public", "free", "none"],
  "fixed-budget": ["budget", "local", "mixed", "essential", "light"],
  "best-value": ["comfortable", "mixed", "mixed", "balanced", "light"],
  "comfort-first": ["boutique", "local", "private", "premium", "planned"],
  "luxury": ["luxury", "fine", "premium", "premium", "priority"],
  "once-in-lifetime": ["boutique", "local", "premium", "premium", "priority"],
};
const lifestyleSelectIds = ["accommodation-style", "food-style", "transport-style", "activity-style", "extras-style"];
const lifestylePresetLabels = {
  "make-possible": ["Hostel / Shared room", "Street food & local stalls", "Public transit only", "Free & low-cost self-guided", "None / Strict essentials"],
  "fixed-budget": ["Budget hotel / Private room", "Local eateries & casual dining", "Public transit + occasional ride-hailing", "Select must-dos only", "Small souvenir allowance"],
  "best-value": ["Comfortable hotel (3–4 star)", "Mixed casual dining", "Public + ride-hailing", "Balanced selection", "Small souvenir allowance"],
  "comfort-first": ["Comfortable / Boutique hotel", "Quality restaurants & cafes", "Ride-hailing / Private taxis", "Curated experiences with skip-the-line", "Comfort extras & treats"],
  "luxury": ["5-star / Luxury resort", "Fine dining & chef experiences", "Private chauffeur / Private transfer", "VIP & exclusive private tours", "Generous shopping & leisure"],
  "once-in-lifetime": ["Unique stays (scenic/boutique)", "Signature local specialties & iconic restaurants", "Fastest / Most scenic options", "Top bucket-list & signature experiences", "Flexible discretionary fund"],
};
const originalLifestyleLabels = new Map(lifestyleSelectIds.map(id => [id, [...document.getElementById(id).options].map(option => option.textContent)]));
let lifestyleHighlightTimer;
function applyIntentionLifestyle(intention) {
  const preset = intentionLifestylePresets[intention];
  if (!preset) return;
  clearTimeout(lifestyleHighlightTimer);
  lifestyleSelectIds.forEach((id, index) => {
    const select = document.getElementById(id);
    [...select.options].forEach((option, optionIndex) => { option.textContent = originalLifestyleLabels.get(id)[optionIndex]; });
    select.value = preset[index];
    select.selectedOptions[0].textContent = lifestylePresetLabels[intention][index];
    select.classList.remove("lifestyle-preset-highlight");
    void select.offsetWidth;
    select.classList.add("lifestyle-preset-highlight");
  });
  document.getElementById("lifestyle-preset-feedback").textContent = "Lifestyle suggestions updated. You can adjust any choice below.";
  lifestyleHighlightTimer = setTimeout(() => lifestyleSelectIds.forEach(id => document.getElementById(id).classList.remove("lifestyle-preset-highlight")), 1000);
  updateBudgetMinimum();
  handleLivePlannerEdit();
}
// Capture input before the form's preview listener. Radio input also supports
// keyboard selection; initial loading/restoration never overwrites saved tweaks.
plannerForm.addEventListener("input", event => {
  if (event.target.matches('input[name="planningGoal"]') && event.target.checked) applyIntentionLifestyle(event.target.value);
}, true);

for (const input of [
  budgetInput,
  currencyInput,
  originSearch,
  destinationSearch,
  ...plannerForm.querySelectorAll('input[name="tripScope"]'),
  startDateInput,
  endDateInput,
  document.querySelector("#trip-purpose"),
  document.querySelector("#traveler-demographic"),
  ...plannerForm.querySelectorAll('input[name="pace"]'),
  ...plannerForm.querySelectorAll('.smart-pace-toggle input'),
  ...plannerForm.querySelectorAll('input[name="planningGoal"]'),
  document.querySelector("#accommodation-style"),
  document.querySelector("#food-style"),
  document.querySelector("#transport-style"),
  document.querySelector("#activity-style"),
  document.querySelector("#extras-style"),
  ...plannerForm.querySelectorAll('input[name="dateFlexible"], input[name="tripLengthFlexible"]'),
]) {
  input.addEventListener("change", updateBudgetMinimum);
  if ([budgetInput, originSearch, destinationSearch].includes(input)) {
    input.addEventListener("input", updateBudgetMinimum);
  }
}

for (const button of plannerForm.querySelectorAll("[data-counter]")) {
  button.addEventListener("click", () => {
    const input = button.dataset.counter === "adults" ? adultInput : childInput;
    setTravellerCount(button.dataset.counter, Number(input.value) + Number(button.dataset.step));
    updateBudgetMinimum();
    handleLivePlannerEdit();
  });
}

plannerForm.addEventListener("input", handleLivePlannerEdit);
plannerForm.addEventListener("change", handleLivePlannerEdit);

setupFormattedDateControl("start");
setupFormattedDateControl("end");
setInitialDates();
applyPlannerQuery();
syncTripScopeState();
updateBudgetMinimum();
updateLiveTripPreview();
loadDestinationCatalog()
  .then(async () => {
    await hydrateConciergeTripFromQuery();
    await loadSavedTravelPreferences();
  })
  .catch(() => {});

async function resumePendingTripSave() {
  const user = await window.PackSwift.authReady;
  if (
    !user ||
    sessionStorage.getItem(pendingTripSaveKey) !== "true"
  ) {
    return;
  }
  const plan = readLatestPlan();
  if (!plan) {
    sessionStorage.removeItem(pendingTripSaveKey);
    plannerFeedback.textContent =
      "Your previous trip plan could not be restored. Please plan it again.";
    return;
  }
  activePlan = plan;
  restorePlannerFormFromPlan(activePlan);
  renderPlan(activePlan);
  await saveActiveTripToAccount();
  planResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

resumePendingTripSave();
