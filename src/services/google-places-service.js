const placesSearchEndpoint = "https://places.googleapis.com/v1/places:searchText";
const placesDetailsEndpoint = "https://places.googleapis.com/v1/places";
const searchFieldMask = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.primaryType",
  "places.types",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.editorialSummary",
  "places.googleMapsUri",
  "places.photos",
  "nextPageToken",
].join(",");
const detailsFieldMask = searchFieldMask
  .split(",")
  .filter((field) => field.startsWith("places."))
  .map((field) => field.replace(/^places\./, ""))
  .join(",");

const isoCountryCodes = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(" ");
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const countryAliases = new Map([
  ["usa", "United States"], ["u.s.a", "United States"], ["us", "United States"],
  ["united states of america", "United States"], ["uk", "United Kingdom"],
  ["u.k", "United Kingdom"], ["uae", "United Arab Emirates"],
  ["burma", "Myanmar"], ["myanmar", "Myanmar"],
  ["south korea", "South Korea"], ["north korea", "North Korea"],
]);
const canonicalCountryNames = new Map(
  isoCountryCodes.map((code) => {
    const name = regionNames.of(code);
    return [String(name).toLowerCase(), name];
  }),
);
for (const [alias, country] of countryAliases) canonicalCountryNames.set(alias, country);

const allTravelGroups = [
  "solo",
  "couples",
  "family-with-children",
  "friends-group",
  "business-duo",
  "senior",
];

const purposeQueries = {
  leisure: "top tourist attractions, shopping, parks and local highlights",
  cultural: "museums, historical landmarks, temples and cultural heritage attractions",
  adventure: "outdoor adventures, parks, boat tours and amusement attractions",
  food: "top restaurants, food markets, rooftop dining and culinary attractions",
  business: "popular attractions, restaurants and work-friendly districts",
  events: "event venues, nightlife, markets and memorable attractions",
};

const countryPurposeQueries = {
  leisure: "top relaxing destinations, scenic sights, resorts and local highlights",
  cultural: "famous historical landmarks, ancient temples, museums and cultural heritage sites",
  adventure: "top outdoor adventures, national parks, coastal activities and nature attractions",
  food: "best culinary destinations, food markets, local restaurants and regional food experiences",
  business: "top workation destinations, business districts and convenient local attractions",
  events: "top celebration destinations, event venues, nightlife and memorable attractions",
};

const cityPurposeQueries = {
  leisure: "top tourist attractions, famous sights, shopping and relaxing local highlights",
  cultural: "famous historical landmarks, museums, temples and cultural heritage attractions",
  adventure: "top outdoor adventures, parks, boat tours and active attractions",
  food: "top restaurants, food markets, cafes and culinary attractions",
  business: "popular attractions, work-friendly districts and convenient restaurants",
  events: "event venues, nightlife, markets and memorable attractions",
};

function normalizeLocationName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function comparableLocation(value) {
  return normalizeLocationName(value)
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/\bcity\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function recognizedCountry(value) {
  const normalized = normalizeLocationName(value).toLowerCase().replace(/[.]$/g, "");
  return canonicalCountryNames.get(normalized) || null;
}

export function resolveDestinationSearchContext(
  { destination, country, destinationScope } = {},
  destinationCatalog = [],
) {
  const destinationName = normalizeLocationName(destination);
  const explicitCountry = normalizeLocationName(country);
  const explicitScope = String(destinationScope || "").trim().toLowerCase();
  const parts = destinationName.split(",").map((part) => part.trim()).filter(Boolean);
  const destinationComparable = comparableLocation(parts[0] || destinationName);
  const catalogCity = destinationCatalog.find(
    (item) => comparableLocation(item.name) === destinationComparable,
  );
  const countryFromDestination = recognizedCountry(destinationName);
  const countryFromSuffix = parts.length > 1 ? recognizedCountry(parts.at(-1)) : null;
  const resolvedCountry = recognizedCountry(explicitCountry) ||
    countryFromSuffix || catalogCity?.country || explicitCountry || null;
  const scope = explicitScope === "country" || explicitScope === "city"
    ? explicitScope
    : countryFromDestination && parts.length === 1
      ? "country"
      : "city";
  const name = scope === "country"
    ? countryFromDestination || recognizedCountry(explicitCountry) || destinationName
    : parts[0] || destinationName;
  const countryName = scope === "country" ? name : resolvedCountry;
  const label = scope === "city" && countryName && comparableLocation(name) !== comparableLocation(countryName)
    ? `${name}, ${countryName}`
    : name;
  return {
    scope,
    name,
    country: countryName,
    label,
    destinationKey: `${scope}:${label}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 160),
  };
}

export function buildGooglePlacesSearchStrategy({
  destination,
  country,
  destinationScope,
  purpose = "leisure",
  group = "solo",
  pace = "balanced",
  destinationCatalog = [],
} = {}) {
  const context = resolveDestinationSearchContext(
    { destination, country, destinationScope },
    destinationCatalog,
  );
  const base = context.scope === "country"
    ? countryPurposeQueries[purpose] || countryPurposeQueries.leisure
    : cityPurposeQueries[purpose] || cityPurposeQueries.leisure;
  const modifiers = [];
  if (group === "friends-group") {
    modifiers.push("group-friendly attractions, vibrant markets and coastal boat tours");
  } else if (group === "family-with-children") {
    modifiers.push("family-friendly attractions and easy transport options");
  } else if (group === "couples") {
    modifiers.push("scenic couple-friendly experiences and sunset spots");
  }
  if (pace === "relaxed") {
    modifiers.push("peaceful nature spots and relaxed experiences");
  } else if (pace === "packed") {
    modifiers.push("must-see highlights suitable for a fast-paced itinerary");
  } else if (pace === "cultural") {
    modifiers.push("museums, history and deep cultural experiences");
  } else if (pace === "culinary") {
    modifiers.push("markets, cafes and authentic food experiences");
  }
  const query = `${base}${modifiers.length ? `, including ${modifiers.join(" and ")}` : ""} in ${context.label}`;
  return {
    ...context,
    query,
    categoryTags: [...new Set([context.scope, purpose, group, pace])],
    requestCategory: `${context.scope}:${purpose}:${group}:${pace}`.slice(0, 80),
  };
}

const cultureTypes = new Set([
  "museum",
  "place_of_worship",
  "hindu_temple",
  "historical_landmark",
  "cultural_landmark",
]);
const foodTypes = new Set(["restaurant", "night_club", "bar", "market"]);
const shoppingTypes = new Set(["shopping_mall", "department_store"]);
const outdoorTypes = new Set(["park", "amusement_park", "tourist_attraction"]);

const priceConfiguration = {
  PRICE_LEVEL_FREE: { costUsd: 0, budgetTier: "budget", label: "Free" },
  PRICE_LEVEL_INEXPENSIVE: { costUsd: 12, budgetTier: "budget", label: "$" },
  PRICE_LEVEL_MODERATE: { costUsd: 30, budgetTier: "mid", label: "$$" },
  PRICE_LEVEL_EXPENSIVE: { costUsd: 65, budgetTier: "luxury", label: "$$$" },
  PRICE_LEVEL_VERY_EXPENSIVE: { costUsd: 120, budgetTier: "luxury", label: "$$$$" },
};

export function isGooglePlacesConfigured(apiKey = process.env.GOOGLE_PLACES_API_KEY) {
  return typeof apiKey === "string" && apiKey.trim().length >= 20;
}

function firstMatchingType(types, candidates) {
  return types.find((type) => candidates.has(type));
}

function placeCategory(types) {
  if (firstMatchingType(types, cultureTypes)) return "Culture & Heritage";
  if (firstMatchingType(types, foodTypes)) return "Food & Nightlife";
  if (firstMatchingType(types, shoppingTypes)) return "Shopping";
  if (firstMatchingType(types, outdoorTypes)) return "Outdoor & Attractions";
  return "Destination Highlight";
}

function purposeTagsForTypes(types) {
  const tags = new Set(["leisure"]);
  if (firstMatchingType(types, cultureTypes)) tags.add("cultural");
  if (firstMatchingType(types, foodTypes)) tags.add("food");
  if (firstMatchingType(types, outdoorTypes)) tags.add("adventure");
  if (types.some((type) => ["night_club", "bar", "market"].includes(type))) tags.add("events");
  return [...tags];
}

function experienceTagsForPlace(place, types) {
  const title = place.displayName?.text?.toLowerCase() || "";
  const tags = new Set(types);
  if (/boat|yacht|cruise|river/.test(title)) {
    ["boat", "yacht", "group", "social", "romantic"].forEach((tag) => tags.add(tag));
  }
  if (/market|bazaar/.test(title) || types.includes("market")) {
    ["market", "shopping", "social", "food"].forEach((tag) => tags.add(tag));
  }
  if (/rooftop|night|club|bar/.test(title) || types.some((type) => ["night_club", "bar"].includes(type))) {
    ["nightlife", "rooftop", "social", "group"].forEach((tag) => tags.add(tag));
  }
  if (types.some((type) => cultureTypes.has(type))) {
    ["culture", "history", "heritage", "temple"].forEach((tag) => tags.add(tag));
  }
  if (types.some((type) => outdoorTypes.has(type))) {
    ["outdoor", "nature", "family"].forEach((tag) => tags.add(tag));
  }
  if (types.includes("amusement_park")) ["kids", "family"].forEach((tag) => tags.add(tag));
  return [...tags];
}

function suitableGroupsForTypes(types) {
  if (types.some((type) => ["night_club", "bar"].includes(type))) {
    return allTravelGroups.filter((group) => !["family-with-children", "senior"].includes(group));
  }
  return [...allTravelGroups];
}

function paceLevelForTypes(types) {
  if (types.some((type) => cultureTypes.has(type))) return "slow";
  if (types.some((type) => ["amusement_park", "tourist_attraction"].includes(type))) return "fast";
  return "balanced";
}

function photoCredit(photo) {
  const names = (photo?.authorAttributions || [])
    .map((author) => author.displayName)
    .filter(Boolean)
    .slice(0, 2);
  return names.length ? `Photo: ${names.join(", ")} · Google Maps` : "Google Maps";
}

export function normalizeGooglePlace(place, { destination, index = 0 } = {}) {
  const types = Array.isArray(place.types) ? place.types : [];
  const price = priceConfiguration[place.priceLevel] || {
    costUsd: 20,
    budgetTier: "mid",
    label: "Estimated",
  };
  const category = placeCategory(types);
  const title = place.displayName?.text || "Destination attraction";
  const photo = place.photos?.[0];
  return {
    providerPlaceId: place.id,
    provider: "google_places",
    cityId: String(destination || "destination").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    cityName: destination,
    slug: `google-${place.id}`,
    title,
    category,
    description:
      place.editorialSummary?.text ||
      `${category} in ${destination}${place.formattedAddress ? ` · ${place.formattedAddress}` : ""}.`,
    costUsd: price.costUsd,
    priceRange: price.label,
    rating: Number(place.rating || 0),
    reviewCount: Number(place.userRatingCount || 0),
    imageUrl: photo
      ? `/api/activities/photo/${encodeURIComponent(place.id)}`
      : `/images/packswift${(index % 3) + 1}.jpg`,
    imageAlt: `${title} in ${destination}`,
    imageCredit: photo ? photoCredit(photo) : "PackSwift travel collection",
    imageSourceUrl: photo ? place.googleMapsUri || "" : "",
    suitableGroups: suitableGroupsForTypes(types),
    purposeTags: purposeTagsForTypes(types),
    budgetTier: price.budgetTier,
    paceLevel: paceLevelForTypes(types),
    experienceTags: experienceTagsForPlace(place, types),
    sortOrder: index,
  };
}

function googleError(status) {
  const error = new Error("Live attraction data is temporarily unavailable.");
  error.status = status === 429 ? 429 : 502;
  return error;
}

export async function searchGooglePlaces(
  {
    destination,
    country,
    destinationScope,
    purpose = "leisure",
    group = "solo",
    pace = "balanced",
    limit = 12,
    searchQuery,
    destinationCatalog = [],
  },
  { fetchImpl = globalThis.fetch, apiKey = process.env.GOOGLE_PLACES_API_KEY } = {},
) {
  const page = await searchGooglePlacesPage(
    {
      destination,
      country,
      destinationScope,
      purpose,
      group,
      pace,
      limit,
      searchQuery,
      destinationCatalog,
    },
    { fetchImpl, apiKey },
  );
  return page.activities;
}

export async function searchGooglePlacesPage(
  {
    destination,
    country,
    destinationScope,
    purpose = "leisure",
    group = "solo",
    pace = "balanced",
    limit = 20,
    searchQuery,
    pageToken,
    destinationCatalog = [],
  },
  { fetchImpl = globalThis.fetch, apiKey = process.env.GOOGLE_PLACES_API_KEY } = {},
) {
  if (!isGooglePlacesConfigured(apiKey)) return { activities: [], nextPageToken: null };
  const strategy = buildGooglePlacesSearchStrategy({
    destination,
    country,
    destinationScope,
    purpose,
    group,
    pace,
    destinationCatalog,
  });
  const response = await fetchImpl(placesSearchEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
      "x-goog-fieldmask": searchFieldMask,
    },
    body: JSON.stringify({
      textQuery: searchQuery || strategy.query || `${purposeQueries[purpose] || purposeQueries.leisure} in ${destination}`,
      pageSize: Math.max(4, Math.min(20, Number(limit) || 12)),
      ...(pageToken ? { pageToken } : {}),
      languageCode: "en",
      rankPreference: "RELEVANCE",
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw googleError(response.status);
  const payload = await response.json();
  const activities = (payload.places || [])
    .map((place, index) => normalizeGooglePlace(place, { destination: strategy.label, index }))
    .sort((first, second) =>
      second.rating - first.rating || second.reviewCount - first.reviewCount,
    );
  return {
    activities,
    nextPageToken: typeof payload.nextPageToken === "string" ? payload.nextPageToken : null,
  };
}

export async function fetchGooglePlacesByIds(
  placeIds,
  { destination, fetchImpl = globalThis.fetch, apiKey = process.env.GOOGLE_PLACES_API_KEY } = {},
) {
  if (!isGooglePlacesConfigured(apiKey) || !Array.isArray(placeIds)) return [];
  const ids = [...new Set(placeIds)].filter(Boolean).slice(0, 20);
  const results = await Promise.allSettled(ids.map(async (placeId) => {
    const response = await fetchImpl(`${placesDetailsEndpoint}/${encodeURIComponent(placeId)}`, {
      headers: {
        "x-goog-api-key": apiKey,
        "x-goog-fieldmask": detailsFieldMask,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw googleError(response.status);
    return response.json();
  }));
  return results
    .filter((result) => result.status === "fulfilled")
    .map((result, index) => normalizeGooglePlace(result.value, { destination, index }))
    .sort((first, second) =>
      second.rating - first.rating || second.reviewCount - first.reviewCount,
    );
}

export async function fetchGooglePlacePhoto(
  placeId,
  { fetchImpl = globalThis.fetch, apiKey = process.env.GOOGLE_PLACES_API_KEY } = {},
) {
  if (!isGooglePlacesConfigured(apiKey)) return null;
  const details = await fetchImpl(`${placesDetailsEndpoint}/${encodeURIComponent(placeId)}`, {
    headers: {
      "x-goog-api-key": apiKey,
      "x-goog-fieldmask": "photos",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!details.ok) throw googleError(details.status);
  const place = await details.json();
  const photoName = place.photos?.[0]?.name;
  if (!photoName) return null;
  const photo = await fetchImpl(
    `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&maxHeightPx=800`,
    {
      headers: { "x-goog-api-key": apiKey },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!photo.ok) throw googleError(photo.status);
  return photo;
}
