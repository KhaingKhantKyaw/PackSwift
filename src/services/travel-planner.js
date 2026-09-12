import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

export const destinationCatalog = JSON.parse(
  readFileSync(
    new URL("../../public/data/destinations.json", import.meta.url),
    "utf8",
  ),
);

export const currencyRatesToUsd = Object.freeze({
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  THB: 1 / 35,
  SGD: 1 / 1.35,
  MYR: 0.226,
  JPY: 0.0067,
  KRW: 0.00072,
  AUD: 0.66,
  CAD: 0.73,
  CNY: 1 / 7.2,
  INR: 0.012,
  MMK: 1 / 2100,
});

export const minimumDailyBudgetUsd = 40;

const regionalRoundTripTransitUsd = new Map([
  ["bangkok::yangon", 100],
  ["bangkok::kuala-lumpur", 105],
  ["bangkok::singapore", 125],
  ["kuala-lumpur::singapore", 80],
  ["singapore::yangon", 170],
]);

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const basePackingItems = {
  Essentials: [
    "Passport and travel documents",
    "Phone charger and universal adapter",
    "Reusable water bottle",
    "Daily medication",
  ],
  Clothing: ["Comfortable walking shoes", "Flexible day outfit", "Sleepwear"],
  Comfort: ["Small day bag", "Sunglasses", "Basic first-aid items"],
};

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
  family: "family",
};

export const planningGoalLabels = Object.freeze({
  "make-possible": "Make the trip possible",
  "fixed-budget": "Stay within my exact budget",
  "best-value": "Best value",
  "comfort-first": "Comfort first",
  luxury: "Luxury experience",
  "once-in-lifetime": "Once-in-a-lifetime trip",
});

const travelStyleOptions = Object.freeze({
  accommodationStyle: new Set(["hostel", "budget", "comfortable", "boutique", "luxury"]),
  foodStyle: new Set(["street", "local", "mixed", "fine"]),
  transportStyle: new Set(["public", "mixed", "private", "premium"]),
  activityStyle: new Set(["free", "essential", "balanced", "premium"]),
  shoppingStyle: new Set(["none", "light", "planned", "priority"]),
});
const styleDefaults = Object.freeze({
  planningGoal: "best-value",
  accommodationStyle: "comfortable",
  foodStyle: "mixed",
  transportStyle: "mixed",
  activityStyle: "balanced",
  shoppingStyle: "light",
});
const lifestyleDailyRatesUsd = Object.freeze({
  accommodationStyle: { hostel: 13, budget: 25, comfortable: 45, boutique: 75, luxury: 170 },
  foodStyle: { street: 9, local: 17, mixed: 30, fine: 85 },
  transportStyle: { public: 5, mixed: 14, private: 42, premium: 85 },
  activityStyle: { free: 3, essential: 16, balanced: 32, premium: 95 },
  shoppingStyle: { none: 0, light: 5, planned: 15, priority: 40 },
});
const planningGoalSettings = Object.freeze({
  "make-possible": { dailyMultiplier: 0.72, activityReserveUsd: 0 },
  "fixed-budget": { dailyMultiplier: 0.9, activityReserveUsd: 0 },
  "best-value": { dailyMultiplier: 1, activityReserveUsd: 0 },
  "comfort-first": { dailyMultiplier: 1.22, activityReserveUsd: 0 },
  luxury: { dailyMultiplier: 1.85, activityReserveUsd: 0 },
  "once-in-lifetime": { dailyMultiplier: 1.05, activityReserveUsd: 90 },
});

export function normalizeTravelStyle(input = {}) {
  const planningGoal = Object.hasOwn(planningGoalLabels, input.planningGoal)
    ? input.planningGoal : styleDefaults.planningGoal;
  const normalized = { planningGoal };
  for (const [field, options] of Object.entries(travelStyleOptions)) {
    const value = String(input[field] || styleDefaults[field]).toLowerCase();
    normalized[field] = options.has(value) ? value : styleDefaults[field];
  }
  return {
    ...normalized,
    dateFlexible: input.dateFlexible === true || input.dateFlexible === "true" || input.dateFlexible === "on",
    tripLengthFlexible: input.tripLengthFlexible === true || input.tripLengthFlexible === "true" || input.tripLengthFlexible === "on",
    mustHaveExperience: String(input.mustHaveExperience || "").trim().slice(0, 180),
  };
}

export function lifestyleDailyRateUsd(style = {}) {
  const normalized = normalizeTravelStyle(style);
  const base = Object.entries(lifestyleDailyRatesUsd).reduce(
    (total, [field, rates]) => total + rates[normalized[field]],
    0,
  );
  return Math.max(22, Math.round(base * planningGoalSettings[normalized.planningGoal].dailyMultiplier));
}

export function buildTripBudgetScenarios({
  scope = "international", origin = null, destination = null,
  adults = 1, children = 0, days = 1, budgetUsd = 0, ...styleInput
} = {}) {
  const style = normalizeTravelStyle(styleInput);
  const adultCount = Math.max(1, Math.min(12, Math.round(Number(adults) || 1)));
  const childCount = Math.max(0, Math.min(8, Math.round(Number(children) || 0)));
  const travelers = adultCount + childCount;
  const travelerUnits = adultCount + childCount * 0.65;
  const normalizedDays = Math.max(1, Math.min(30, Math.round(Number(days) || 1)));
  const transitPerPersonUsd = estimateTransitCostUsd(origin, destination);
  const transitTotalUsd = transitPerPersonUsd * travelers;
  const lifestyleRate = lifestyleDailyRateUsd(style);
  const mustHaveReserve = style.mustHaveExperience
    ? (planningGoalSettings[style.planningGoal].activityReserveUsd || 55) * travelers
    : 0;
  const viableUsd = transitTotalUsd + 24 * travelerUnits * normalizedDays;
  const recommendedUsd = transitTotalUsd + lifestyleRate * travelerUnits * normalizedDays + mustHaveReserve;
  const comfortUsd = transitTotalUsd + Math.max(105, lifestyleRate * 1.35) * travelerUnits * normalizedDays + mustHaveReserve;
  const available = Math.max(0, Number(budgetUsd) || 0);
  const fit = available >= comfortUsd ? "comfort"
    : available >= recommendedUsd ? "recommended"
      : available >= viableUsd ? "viable" : "stretch";
  return {
    scope,
    travelers,
    days: normalizedDays,
    transitPerPersonUsd,
    transitTotalUsd: Math.round(transitTotalUsd),
    lifestyleDailyRateUsd: lifestyleRate,
    viableUsd: Math.round(viableUsd),
    recommendedUsd: Math.round(recommendedUsd),
    comfortUsd: Math.round(comfortUsd),
    fit,
  };
}

function normalizeInterests(value) {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.toLowerCase()).slice(0, 8);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8);
  }

  return [];
}

export function routeLocation(value) {
  const query = String(value || "").trim().toLowerCase();
  if (!query) return null;
  const match = destinationCatalog.find((destination) =>
    destination.slug.toLowerCase() === query ||
    destination.name.toLowerCase() === query ||
    `${destination.name}, ${destination.country}`.toLowerCase() === query,
  ) || destinationCatalog.find((destination) =>
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

export function routeDistanceKm(origin, destination) {
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

export function estimateTransitCostUsd(origin, destination) {
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

export function minimumTripBudgetDetails(
  scope,
  origin,
  destination,
  { travelers = 1, days = 7, dailyRateUsd = minimumDailyBudgetUsd } = {},
) {
  const normalizedTravelers = Math.max(1, Math.min(20, Math.round(Number(travelers) || 1)));
  const normalizedDays = Math.max(1, Math.min(30, Math.round(Number(days) || 1)));
  const normalizedDailyRate = Math.max(1, Number(dailyRateUsd) || minimumDailyBudgetUsd);
  const distanceKm = routeDistanceKm(origin, destination);
  const transitCostPerPersonUsd = estimateTransitCostUsd(origin, destination);
  const totalTransitCostUsd = transitCostPerPersonUsd * normalizedTravelers;
  const dailyStayCostUsd = normalizedDailyRate * normalizedTravelers * normalizedDays;
  return {
    scope,
    distanceKm,
    travelers: normalizedTravelers,
    days: normalizedDays,
    dailyRatePerPersonUsd: normalizedDailyRate,
    transitCostPerPersonUsd,
    totalTransitCostUsd,
    dailyStayCostUsd,
    minimumBudgetUsd: Math.round((totalTransitCostUsd + dailyStayCostUsd) * 100) / 100,
  };
}

export function minimumTripBudgetUsd(scope, origin, destination, options = {}) {
  return minimumTripBudgetDetails(scope, origin, destination, options).minimumBudgetUsd;
}

function parseInput(input = {}) {
  const budget = Number(input.budget);
  const hasBreakdown = input.adults !== undefined || input.children !== undefined;
  const adults = hasBreakdown ? Number(input.adults ?? 1) : Number(input.travelers ?? 1);
  const children = hasBreakdown ? Number(input.children ?? 0) : 0;
  const travelers = adults + children;
  const currency = String(input.currency || "USD").slice(0, 3).toUpperCase();
  const travelStyle = normalizeTravelStyle(input);

  if (!currencyRatesToUsd[currency]) {
    throw new RangeError("Choose a supported currency.");
  }

  if (!Number.isInteger(adults) || adults < 1 || adults > 12 ||
      !Number.isInteger(children) || children < 0 || children > 8 || travelers > 20) {
    throw new RangeError("Travelers must be between 1 and 20.");
  }

  const tripScope = String(input.tripScope || "international").toLowerCase();
  if (!["domestic", "international"].includes(tripScope)) {
    throw new RangeError("Choose a valid trip scope.");
  }
  const originQuery = String(input.origin || "Yangon").trim().slice(0, 100);
  const destinationQuery = String(input.destination || "").trim().slice(0, 100);
  const explicitRoute = input.tripScope !== undefined || input.origin !== undefined || hasBreakdown;
  const origin = routeLocation(originQuery);
  const destination = routeLocation(destinationQuery);
  if (!origin) throw new RangeError("Choose a supported origin city or country.");
  if (explicitRoute && !destination) {
    throw new RangeError("Choose a supported destination city or country.");
  }
  if (explicitRoute && tripScope !== "domestic" && destination && origin.slug === destination.slug) {
    throw new RangeError("Choose a destination different from your origin.");
  }
  if (destination && tripScope === "domestic" && origin.country !== destination.country) {
    throw new RangeError(
      "Nationwide trips require the origin and destination to be in the same country.",
    );
  }

  const startDate = String(input.startDate || "");
  const endDate = String(input.endDate || "");
  const days = tripDays(startDate, endDate);
  const budgetUsd = budget * currencyRatesToUsd[currency];
  const budgetDetails = minimumTripBudgetDetails(tripScope, origin, destination, {
    travelers,
    days,
  });
  const minimumBudgetUsd = explicitRoute
    ? budgetDetails.minimumBudgetUsd
    : 100;
  if (!Number.isFinite(budget) || budget <= 0 || budgetUsd > 250000) {
    throw new RangeError(
      "Budget must be greater than zero and no more than the equivalent of USD 250,000.",
    );
  }

  const purpose = String(input.tripPurpose || "leisure").toLowerCase();
  if (!Object.hasOwn(purposeInterests, purpose)) {
    throw new RangeError("Choose a valid trip purpose.");
  }
  const interests = normalizeInterests(input.interests);

  const arrivalAt = String(input.arrivalAt || "").trim();
  if (
    arrivalAt &&
    Number.isNaN(new Date(arrivalAt).valueOf())
  ) {
    throw new RangeError("Choose a valid arrival date and time.");
  }

  return {
    budget,
    budgetUsd: Math.round(budgetUsd * 100) / 100,
    currency,
    travelers,
    adults,
    children,
    tripScope,
    origin: originQuery,
    route: {
      scope: tripScope,
      origin,
      destination,
      estimatedTransitCostUsd: destination ? budgetDetails.transitCostPerPersonUsd : null,
      distanceKm: destination ? budgetDetails.distanceKm : null,
      transitCostPerPersonUsd: destination ? budgetDetails.transitCostPerPersonUsd : null,
      totalTransitCostUsd: destination ? budgetDetails.totalTransitCostUsd : null,
      dailyRatePerPersonUsd: budgetDetails.dailyRatePerPersonUsd,
      dailyStayCostUsd: budgetDetails.dailyStayCostUsd,
      travelers: budgetDetails.travelers,
      days: budgetDetails.days,
      minimumBudgetUsd,
    },
    startDate,
    endDate,
    destinationQuery,
    preferredClimate: String(input.preferredClimate || "any").toLowerCase(),
    pace: String(input.pace || "balanced").toLowerCase(),
    smartPace: {
      lateRiser: input.smartPace?.lateRiser === true,
      middayRest: input.smartPace?.middayRest === true,
      clusterNearby: input.smartPace?.clusterNearby === true,
    },
    tripPurpose: purpose,
    travelerDemographic: String(input.travelerDemographic || "couples").toLowerCase(),
    travelingWithPets:
      input.travelingWithPets === true ||
      input.travelingWithPets === "true" ||
      input.travelingWithPets === "on",
    interests: interests.length ? interests : [...purposeInterests[purpose]],
    arrivalAt: arrivalAt || null,
    hotelName: String(input.hotelName || "").trim().slice(0, 180) || null,
    hotelAddress:
      String(input.hotelAddress || "").trim().slice(0, 255) || null,
    notes: String(input.notes || "").trim().slice(0, 600),
    ...travelStyle,
  };
}

function tripDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end < start) {
    return 5;
  }

  return Math.max(1, Math.min(30, Math.round((end - start) / 86400000) + 1));
}

function travelMonth(startDate) {
  const date = new Date(`${startDate}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? new Date().getUTCMonth() + 1 : date.getUTCMonth() + 1;
}

function weatherForMonth(destination, month) {
  const northernWinter = [12, 1, 2].includes(month);
  const northernSummer = [6, 7, 8].includes(month);
  const southernSummer = [12, 1, 2].includes(month);
  const southernWinter = [6, 7, 8].includes(month);

  const profiles = {
    "northern-seasonal": northernWinter
      ? { low: -1, high: 8, climate: "cool" }
      : northernSummer
        ? { low: 18, high: 29, climate: "warm" }
        : { low: 9, high: 21, climate: "mild" },
    "southern-seasonal": southernSummer
      ? { low: 18, high: 29, climate: "warm" }
      : southernWinter
        ? { low: 8, high: 18, climate: "cool" }
        : { low: 13, high: 24, climate: "mild" },
    mediterranean: northernSummer
      ? { low: 21, high: 32, climate: "warm" }
      : northernWinter
        ? { low: 7, high: 16, climate: "mild" }
        : { low: 14, high: 25, climate: "mild" },
    tropical: { low: 23, high: 32, climate: "warm" },
    equatorial: { low: 25, high: 32, climate: "warm" },
    monsoon: { low: 22, high: 32, climate: "warm" },
    desert: northernSummer
      ? { low: 28, high: 42, climate: "hot" }
      : { low: 14, high: 28, climate: "warm" },
    highland: { low: 11, high: 24, climate: "mild" },
    "coastal-temperate": northernSummer
      ? { low: 14, high: 23, climate: "mild" }
      : { low: 6, high: 15, climate: "cool" },
  };

  const profile = profiles[destination.climateProfile] || profiles["northern-seasonal"];
  let rain = destination.rain;
  if (destination.climateProfile === "monsoon" && [5, 6, 7, 8, 9, 10].includes(month)) {
    rain = "high";
  }
  if (destination.climateProfile === "tropical" && [6, 7, 8, 9, 10].includes(month)) {
    rain = destination.rain === "low" ? "moderate" : "high";
  }

  return {
    ...profile,
    rain,
    note: `${monthNames[month - 1]} typically brings ${profile.climate} conditions around ${profile.low}–${profile.high}°C with ${rain} rainfall likelihood.`,
  };
}

function destinationMatches(destination, query) {
  if (!query) return true;
  const needle = query.toLowerCase();
  return [destination.name, destination.country, destination.region]
    .some((value) => value.toLowerCase().includes(needle));
}

function purposeFit(destination, purpose) {
  if (purpose === "business") return destination.businessScore * 3;
  if (purpose === "family") return destination.familyScore * 3;
  const matches = purposeInterests[purpose]
    .filter((interest) => destination.interests.includes(interest)).length;
  return Math.min(15, 7 + matches * 3);
}

function demographicFit(destination, demographic) {
  if (demographic === "family-with-children") return destination.familyScore;
  if (demographic === "senior") {
    return destination.interests.includes("adventure") && destination.familyScore < 4 ? 2 : 4;
  }
  if (demographic === "young-adults") {
    return destination.interests.some((interest) =>
      ["adventure", "design", "food", "coast"].includes(interest),
    ) ? 5 : 3;
  }
  if (demographic === "business-duo") return Math.max(3, destination.businessScore);
  if (demographic === "friends-group") {
    return destination.interests.some((interest) =>
      ["adventure", "food", "coast", "design"].includes(interest),
    ) ? 5 : 3;
  }
  if (demographic === "couples") {
    return destination.interests.some((interest) =>
      ["coast", "food", "wellness", "culture"].includes(interest),
    ) ? 5 : 4;
  }
  return 4;
}

function plannedDestinationDailyRateUsd(destination, input) {
  const destinationRate = Math.max(20, Number(destination.dailyBudgetUsd) || 55);
  const lifestyleRate = lifestyleDailyRateUsd(input);
  const availableDaily = Math.max(
    18,
    (input.budgetUsd - (input.route?.totalTransitCostUsd || 0)) / Math.max(1, input.travelers * (input.route?.days || 1)),
  );
  if (input.planningGoal === "make-possible") return Math.max(22, Math.min(lifestyleRate, destinationRate * 0.58));
  if (input.planningGoal === "fixed-budget") {
    return Math.max(20, Math.min(lifestyleRate, destinationRate, availableDaily));
  }
  if (input.planningGoal === "comfort-first") return Math.max(lifestyleRate, destinationRate * 1.15);
  if (input.planningGoal === "luxury") return Math.max(lifestyleRate, destinationRate * 1.8);
  if (input.planningGoal === "once-in-lifetime") return Math.max(lifestyleRate, destinationRate);
  return Math.max(22, Math.min(Math.max(lifestyleRate, destinationRate * 0.85), availableDaily));
}

function scoreDestination(destination, input, days, month, weather) {
  const perPersonBudgetUsd = input.budgetUsd / input.travelers;
  const estimatedPerPerson = plannedDestinationDailyRateUsd(destination, input) * days;
  const budgetFit =
    estimatedPerPerson <= perPersonBudgetUsd
      ? 35 +
        (1 - estimatedPerPerson / perPersonBudgetUsd <= 0.05
          ? 4
          : 1 - estimatedPerPerson / perPersonBudgetUsd <= 0.1
            ? 2
            : 0)
      : Math.max(0, 35 * (perPersonBudgetUsd / estimatedPerPerson));
  const interestMatches = destination.interests
    .filter((interest) => input.interests.includes(interest)).length;
  const interestFit = Math.min(20, 6 + interestMatches * 4);
  const monthFit = destination.bestMonths.includes(month) ? 12 : 6;
  const climateFit =
    input.preferredClimate === "any" ||
    input.preferredClimate === weather.climate ||
    (input.preferredClimate === "warm" && weather.climate === "hot")
      ? 8
      : 3;
  const petFit = input.travelingWithPets ? destination.petScore : 5;

  const intentionFit = input.planningGoal === "luxury"
    ? Math.min(7, destination.dailyBudgetUsd / 25)
    : input.planningGoal === "make-possible" || input.planningGoal === "fixed-budget"
      ? Math.min(7, 140 / Math.max(25, destination.dailyBudgetUsd))
      : 5;
  const gatewayFit = Math.min(7, Number(destination.businessScore || 0) * 1.3);
  return Math.round(
    Math.min(
      100,
      budgetFit +
        interestFit +
        purposeFit(destination, input.tripPurpose) +
        monthFit +
        climateFit +
        demographicFit(destination, input.travelerDemographic) +
        petFit + intentionFit + gatewayFit,
    ),
  );
}

function buildItinerary(destination, days, input) {
  const dayCount = Math.min(days, 5);
  const itinerary = [];

  for (let index = 0; index < dayCount; index += 1) {
    const first = destination.attractions[index % destination.attractions.length];
    const second =
      destination.attractions[(index + 1) % destination.attractions.length];
    itinerary.push({
      day: index + 1,
      title: index === 0 ? "Arrive and orient" : `Explore ${first}`,
      morning:
        index === 0
          ? `${input.smartPace.lateRiser ? "10:30" : "08:30"} · Arrival, ${["private", "premium"].includes(input.transportStyle) ? "pre-arranged private transfer" : "practical airport transfer"}, check-in, and orientation`
          : input.tripPurpose === "business" && index === 1
            ? "Protected work or meeting block"
            : `${input.smartPace.lateRiser ? "10:30" : "08:30"} · ${first}`,
      afternoon:
        index === 1 && input.mustHaveExperience
          ? `Protected priority · ${input.mustHaveExperience}`
          : input.smartPace.middayRest
          ? `14:00–16:00 protected rest, then ${second}`
          : input.pace === "relaxed"
            ? `Unhurried visit to ${second}`
            : `${second} and a nearby local lunch${input.smartPace.clusterNearby ? " in the same area" : ""}`,
      evening:
        index === dayCount - 1
          ? "Favourite-place revisit and trip reflection"
          : input.foodStyle === "fine" || input.planningGoal === "luxury"
            ? "Reserved signature dinner with an easy return transfer"
            : input.tripPurpose === "family"
            ? "Early local dinner and a restful evening"
            : "Local dinner and an optional evening walk",
    });
  }

  return itinerary;
}

function buildActivityPreviews(destination, input) {
  const source = destination.activityPreviews?.length
    ? destination.activityPreviews
    : destination.attractions.map((attraction) => ({
        title: attraction,
        category: "Highlight",
        interests: destination.interests.slice(0, 2),
        costUsd: Math.max(8, Math.round(destination.dailyBudgetUsd * 0.18)),
        description: `Make time for ${attraction} with a pace that suits your trip.`,
      }));
  const preferredInterests = new Set([
    ...input.interests,
    ...purposeInterests[input.tripPurpose],
  ]);

  return source
    .map((activity, index) => {
      const interestMatches = (activity.interests || [])
        .filter((interest) => preferredInterests.has(interest)).length;
      const purposeMatch =
        activity.category?.toLowerCase() === input.tripPurpose ? 3 : 0;
      return { activity, index, relevance: interestMatches * 4 + purposeMatch };
    })
    .sort((first, second) =>
      second.relevance - first.relevance || first.index - second.index,
    )
    .slice(0, 3)
    .map(({ activity }) => ({
      ...activity,
      estimatedCost: Math.round(
        convertCurrency(activity.costUsd || 0, "USD", input.currency) * 100,
      ) / 100,
      currency: input.currency,
    }));
}

function formatBudgetAmount(amount, currency) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: ["JPY", "KRW", "MMK"].includes(currency) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("en")}`;
  }
}

export function convertCurrency(amount, fromCurrency, toCurrency) {
  const from = currencyRatesToUsd[String(fromCurrency).toUpperCase()];
  const to = currencyRatesToUsd[String(toCurrency).toUpperCase()];
  if (!from || !to) throw new RangeError("Unsupported currency.");
  return (Number(amount) * from) / to;
}

export function buildPackingList(input = {}) {
  const climate = String(input.climate || "mild").toLowerCase();
  const rain = String(input.rain || "moderate").toLowerCase();
  const purpose = String(input.tripPurpose || "leisure").toLowerCase();
  const demographic = String(input.travelerDemographic || "adults").toLowerCase();
  const withPets = Boolean(input.travelingWithPets);
  const days = Math.max(1, Math.min(30, Number(input.days) || 5));
  const list = structuredClone(basePackingItems);

  list.Clothing.push(`${Math.min(days, 7)} versatile tops`);
  list.Clothing.push(`${Math.max(2, Math.ceil(days / 3))} comfortable bottoms`);

  if (["warm", "hot"].includes(climate)) {
    list.Clothing.push("Sun hat", "Lightweight evening layer");
    list.Comfort.push("High-SPF sunscreen");
  } else if (climate === "cool") {
    list.Clothing.push("Warm mid-layer", "Packable insulated outer layer");
  } else {
    list.Clothing.push("Light knit layer");
  }

  if (rain !== "low") list.Comfort.push("Compact umbrella", "Packable rain shell");
  if (purpose === "business") list.Essentials.push("Meeting documents", "Laptop and presentation adapter");
  if (purpose === "adventure") list.Comfort.push("Activity-ready footwear", "Compact torch");
  if (input.accommodationStyle === "hostel") {
    list.Comfort.push("Compact travel towel", "Small luggage lock", "Sleep mask and earplugs");
  }
  if (input.foodStyle === "fine" || input.planningGoal === "luxury") {
    list.Clothing.push("Smart evening outfit");
  }
  if (input.transportStyle === "public") {
    list.Comfort.push("Compact transit daypack", "Offline transit map");
  }
  if (purpose === "family" || demographic === "family-with-children") {
    list.Essentials.push("Family document folder", "Child comfort and activity items");
  }
  if (demographic === "senior") list.Comfort.push("Comfort medication kit", "Written emergency contacts");
  if (withPets) {
    list["Pet care"] = [
      "Pet travel documents and vaccination records",
      "Secure carrier, lead, and identification tag",
      "Familiar food, collapsible bowls, and waste supplies",
      "Pet medication and local veterinary contact",
    ];
  }

  return list;
}

export function createTravelPlan(rawInput) {
  const input = parseInput(rawInput);
  const days = tripDays(input.startDate, input.endDate);
  const month = travelMonth(input.startDate);
  const candidates = destinationCatalog.filter((destination) =>
    destinationMatches(destination, input.destinationQuery),
  );

  if (candidates.length === 0) {
    throw new RangeError(
      "No supported destination matched that search. Try a city, country, or region from the worldwide catalog.",
    );
  }

  const ranked = candidates
    .map((destination) => {
      const weather = weatherForMonth(destination, month);
      return {
        ...destination,
        temperatures: { low: weather.low, high: weather.high },
        climate: weather.climate,
        weather,
        score: scoreDestination(destination, input, days, month, weather),
      };
    })
    .sort((a, b) => b.score - a.score);
  const destination = ranked[0];
  const selectedRouteDestination = routeLocation(destination.name);
  input.route.destination = selectedRouteDestination;
  const routeBudget = minimumTripBudgetDetails(
    input.tripScope,
    input.route.origin,
    selectedRouteDestination,
    { travelers: input.travelers, days },
  );
  Object.assign(input.route, {
    estimatedTransitCostUsd: routeBudget.transitCostPerPersonUsd,
    distanceKm: routeBudget.distanceKm,
    transitCostPerPersonUsd: routeBudget.transitCostPerPersonUsd,
    totalTransitCostUsd: routeBudget.totalTransitCostUsd,
    dailyRatePerPersonUsd: routeBudget.dailyRatePerPersonUsd,
    dailyStayCostUsd: routeBudget.dailyStayCostUsd,
    travelers: routeBudget.travelers,
    days: routeBudget.days,
    minimumBudgetUsd: routeBudget.minimumBudgetUsd,
  });
  const budgetScenarios = buildTripBudgetScenarios({
    scope: input.tripScope,
    origin: input.route.origin,
    destination: selectedRouteDestination,
    adults: input.adults,
    children: input.children,
    days,
    budgetUsd: input.budgetUsd,
    planningGoal: input.planningGoal,
    accommodationStyle: input.accommodationStyle,
    foodStyle: input.foodStyle,
    transportStyle: input.transportStyle,
    activityStyle: input.activityStyle,
    shoppingStyle: input.shoppingStyle,
    dateFlexible: input.dateFlexible,
    tripLengthFlexible: input.tripLengthFlexible,
    mustHaveExperience: input.mustHaveExperience,
  });
  const plannedDailyRateUsd = plannedDestinationDailyRateUsd(destination, input);
  const mustHaveReserveUsd = input.mustHaveExperience
    ? (planningGoalSettings[input.planningGoal].activityReserveUsd || 55) * input.travelers
    : 0;
  const estimatedCostUsd = input.route.totalTransitCostUsd +
    plannedDailyRateUsd * days * (input.adults + input.children * 0.65) +
    mustHaveReserveUsd;
  const estimatedCost = convertCurrency(estimatedCostUsd, "USD", input.currency);
  const bestTimeToVisit = destination.bestMonths
    .map((bestMonth) => monthNames[bestMonth - 1])
    .join(", ");
  const budgetDifference = Math.round(
    Math.abs(input.budget - estimatedCost) * 100,
  ) / 100;
  const withinBudget = estimatedCost <= input.budget;
  const budgetMessage = withinBudget
    ? `Your ${planningGoalLabels[input.planningGoal].toLowerCase()} plan stays within ${formatBudgetAmount(input.budget, input.currency)}, leaving about ${formatBudgetAmount(budgetDifference, input.currency)} for flexibility.`
    : ["make-possible", "fixed-budget"].includes(input.planningGoal)
      ? `${formatBudgetAmount(input.budget, input.currency)} remains accepted as your limit. PackSwift will protect essential experiences and suggest flexible dates, fewer nights, simpler stays, public transport, and free highlights to close the ${formatBudgetAmount(budgetDifference, input.currency)} gap.`
      : `The lifestyle-matched version is about ${formatBudgetAmount(budgetDifference, input.currency)} above your current budget. The minimum viable and comfort alternatives show where to adjust without abandoning the trip.`;

  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    input,
    days,
    travelMonth: monthNames[month - 1],
    destination,
    alternatives: ranked.slice(1, 4).map(
      ({ slug, name, country, region, score, dailyBudgetUsd }) => {
        const alternativeCost = convertCurrency(
          input.route.totalTransitCostUsd + dailyBudgetUsd * days * input.travelers,
          "USD",
          input.currency,
        );
        return {
          slug,
          name,
          country,
          region,
          score,
          estimatedCost: Math.round(alternativeCost * 100) / 100,
          withinBudget: alternativeCost <= input.budget,
        };
      },
    ),
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    estimatedCostUsd: Math.round(estimatedCostUsd * 100) / 100,
    budgetFit: {
      withinBudget,
      difference: budgetDifference,
      message: budgetMessage,
      planningGoal: input.planningGoal,
      fit: budgetScenarios.fit,
    },
    budgetScenarios: {
      ...budgetScenarios,
      viable: convertCurrency(budgetScenarios.viableUsd, "USD", input.currency),
      recommended: convertCurrency(budgetScenarios.recommendedUsd, "USD", input.currency),
      comfort: convertCurrency(budgetScenarios.comfortUsd, "USD", input.currency),
      currency: input.currency,
    },
    bestTimeToVisit,
    summary: `${destination.name} is the strongest ${purposeLabels[input.tripPurpose] || input.tripPurpose} match for ${input.travelers} ${input.travelers === 1 ? "traveller" : "travellers"} in ${monthNames[month - 1]}. ${budgetMessage}`,
    costNote: `This estimate includes return transit, ${input.accommodationStyle} accommodation, ${input.foodStyle} dining, ${input.transportStyle} transport, ${input.activityStyle} activities, and a ${input.shoppingStyle} shopping allowance. The three budget paths are guidance—not a barrier to planning.`,
    weather: destination.weather,
    itinerary: buildItinerary(destination, days, input),
    activityPreviews: buildActivityPreviews(destination, input),
    packingList: buildPackingList({
      climate: destination.weather.climate,
      rain: destination.weather.rain,
      days,
      tripPurpose: input.tripPurpose,
      travelerDemographic: input.travelerDemographic,
      travelingWithPets: input.travelingWithPets,
      planningGoal: input.planningGoal,
      accommodationStyle: input.accommodationStyle,
      foodStyle: input.foodStyle,
      transportStyle: input.transportStyle,
    }),
    culturalNotes: destination.culturalNotes,
  };
}
