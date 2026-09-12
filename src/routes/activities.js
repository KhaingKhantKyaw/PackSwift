import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { body, param } from "express-validator";
import { optionalAuth } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";
import {
  findDestinationPlaceReferences,
  rememberDestinationPlaceReferences,
} from "../repositories/destination-place-cache-repository.js";
import { findPlannerActivities } from "../repositories/planner-activity-repository.js";
import { listSavedTripPlaceIds } from "../repositories/trip-plan-repository.js";
import {
  readPlannerActivitySeed,
  recommendPlannerActivities,
} from "../services/live-trip-recommendation.js";
import {
  fetchGooglePlacePhoto,
  fetchGooglePlacesByIds,
  buildGooglePlacesSearchStrategy,
  isGooglePlacesConfigured,
  searchGooglePlacesPage,
} from "../services/google-places-service.js";
import { destinationCatalog } from "../services/travel-planner.js";

export const activitiesRouter = Router();

const recommendationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many live searches. Please wait a moment and try again." },
});

const purposeAliases = new Map([
  ["leisure", "leisure"],
  ["leisure & relaxation", "leisure"],
  ["culture & heritage", "cultural"],
  ["cultural & historical", "cultural"],
  ["cultural", "cultural"],
  ["adventure & outdoor", "adventure"],
  ["adventure", "adventure"],
  ["food & culinary", "food"],
  ["food & nightlife", "food"],
  ["food", "food"],
  ["business / workation", "business"],
  ["business", "business"],
  ["special events & celebrations", "events"],
  ["events", "events"],
]);
const groupAliases = new Map([
  ["solo", "solo"],
  ["couples", "couples"],
  ["family", "family-with-children"],
  ["family-with-children", "family-with-children"],
  ["friends / group", "friends-group"],
  ["friends-group", "friends-group"],
  ["digital nomad / business duo", "business-duo"],
  ["business-duo", "business-duo"],
  ["senior travelers", "senior"],
  ["senior", "senior"],
]);
const paceAliases = new Map([
  ["slow", "relaxed"],
  ["slow & relaxed", "relaxed"],
  ["relaxed", "relaxed"],
  ["balanced", "balanced"],
  ["balanced & steady", "balanced"],
  ["packed", "packed"],
  ["packed & fast", "packed"],
  ["fast", "packed"],
  ["cultural deep dive", "cultural"],
  ["cultural", "cultural"],
  ["culinary & foodie", "culinary"],
  ["culinary", "culinary"],
]);

function canonicalValue(value, aliases) {
  return aliases.get(String(value || "").trim().toLowerCase()) || null;
}

function budgetUsdForRequest(value, days, travelers) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const perPersonDay = { budget: 50, mid: 120, luxury: 250 }[
    String(value || "").trim().toLowerCase()
  ];
  return perPersonDay ? perPersonDay * days * travelers : 0;
}

function destinationMatch(query) {
  const needle = query.trim().toLowerCase();
  return destinationCatalog.find((destination) =>
    destination.slug === needle || destination.name.toLowerCase() === needle,
  ) || destinationCatalog.find((destination) =>
    `${destination.name}, ${destination.country}`.toLowerCase() === needle,
  );
}

function bundledActivities(destination, input) {
  const images = ["/images/packswift1.jpg", "/images/packswift2.jpg", "/images/packswift3.jpg"];
  return (destination?.attractions || []).map((title, index) => ({
    cityId: destination?.code?.toLowerCase() || destination?.slug || "global",
    cityName: destination?.name || input.destination,
    slug: `${destination?.slug || "destination"}-${index + 1}`,
    title,
    category: "Destination Highlight",
    description: `A PackSwift destination highlight for ${input.destination}.`,
    costUsd: Math.max(8, Math.round((destination?.dailyBudgetUsd || 80) * 0.2)),
    imageUrl: images[index % images.length],
    imageAlt: `${title} in ${input.destination}`,
    imageCredit: "PackSwift travel collection",
    imageSourceUrl: "",
    suitableGroups: ["solo", "couples", "family-with-children", "friends-group", "business-duo", "senior"],
    purposeTags: [input.purpose, "leisure"],
    budgetTier: index === 0 ? "budget" : "mid",
    paceLevel: ["slow", "balanced", "fast"][index % 3],
    experienceTags: [input.purpose, input.group],
    sortOrder: index,
  }));
}

function activityWithPlaceIdentity(activity) {
  const provider = activity.provider === "google_places"
    ? "google_places"
    : "packswift_catalog";
  const placeId = activity.providerPlaceId || `catalog:${activity.slug}`;
  return { ...activity, provider, placeId };
}

async function fallbackActivities(destination, input) {
  const cityId = destination?.code?.toLowerCase() || destination?.slug || "";
  let activities = [];
  try {
    activities = await findPlannerActivities(cityId);
  } catch {
    // The bundled catalog remains available before local MySQL initialization.
  }
  if (!activities.length && cityId === "bkk") {
    const seed = await readPlannerActivitySeed();
    activities = seed.filter((activity) => activity.cityId === "bkk");
  }
  return activities.length ? activities : bundledActivities(destination, input);
}

activitiesRouter.post(
  "/recommend",
  recommendationLimiter,
  optionalAuth,
  [
    body("destination").trim().isLength({ min: 2, max: 100 }).withMessage("Choose a destination."),
    body("destination_country").optional({ checkFalsy: true }).trim().isLength({ min: 2, max: 100 }),
    body("destination_scope").optional({ checkFalsy: true }).isIn(["country", "city"]),
    body("travel_purpose").trim().isLength({ min: 2, max: 80 }).withMessage("Choose a travel purpose."),
    body("travel_group").trim().isLength({ min: 2, max: 80 }).withMessage("Choose a travel group."),
    body("travel_pace").trim().isLength({ min: 2, max: 80 }).withMessage("Choose a travel pace."),
    body("budget").custom((value) => {
      const tier = ["budget", "mid", "luxury"].includes(String(value).toLowerCase());
      return tier || (Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 250000);
    }).withMessage("Choose a valid activity budget."),
    body("days").optional().isInt({ min: 1, max: 30 }).withMessage("Choose valid travel dates."),
    body("travelers").optional().isInt({ min: 1, max: 20 }).withMessage("Choose a valid traveller count."),
    body("late_riser").optional().isBoolean(),
    body("midday_rest").optional().isBoolean(),
    body("cluster_nearby").optional().isBoolean(),
    body("planning_goal").optional().isIn(["make-possible", "fixed-budget", "best-value", "comfort-first", "luxury", "once-in-lifetime"]),
    body("activity_style").optional().isIn(["free", "essential", "balanced", "premium"]),
    body("shopping_style").optional().isIn(["none", "light", "planned", "priority"]),
    body("must_have_experience").optional({ checkFalsy: true }).trim().isLength({ min: 2, max: 180 }),
    body("trip_id").optional({ checkFalsy: true }).isUUID(4),
    body("saved_place_ids").optional().isArray({ max: 100 }),
    body("saved_place_ids.*").optional().isString().isLength({ min: 3, max: 255 }),
    body("excluded_place_ids").optional().isArray({ max: 100 }),
    body("excluded_place_ids.*").optional().isString().isLength({ min: 3, max: 255 }),
    body("page_token").optional({ checkFalsy: true }).isString().isLength({ min: 8, max: 2048 }),
    body("refresh_queue").optional().isBoolean(),
  ],
  validateRequest,
  async (request, response, next) => {
    try {
      const destinationName = String(request.body.destination).trim();
      const purpose = canonicalValue(request.body.travel_purpose, purposeAliases);
      const group = canonicalValue(request.body.travel_group, groupAliases);
      const pace = canonicalValue(request.body.travel_pace, paceAliases);
      if (!purpose || !group || !pace) {
        response.status(422).json({ error: "Choose supported travel preferences." });
        return;
      }
      const days = Math.max(1, Number(request.body.days) || 1);
      const travelers = Math.max(1, Number(request.body.travelers) || 1);
      const input = {
        destination: destinationName,
        cityId: destinationMatch(destinationName)?.code?.toLowerCase() ||
          destinationName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        purpose,
        group,
        pace,
        budgetUsd: budgetUsdForRequest(request.body.budget, days, travelers),
        days,
        travelers,
        lateRiser: request.body.late_riser === true,
        middayRest: request.body.midday_rest === true,
        clusterNearby: request.body.cluster_nearby === true,
        planningGoal: request.body.planning_goal || "best-value",
        activityStyle: request.body.activity_style || "balanced",
        shoppingStyle: request.body.shopping_style || "light",
        mustHaveExperience: String(request.body.must_have_experience || "").trim(),
      };

      let activities = [];
      let source = "packswift_catalog";
      let nextPageToken = null;
      const searchStrategy = buildGooglePlacesSearchStrategy({
        destination: destinationName,
        country: request.body.destination_country,
        destinationScope: request.body.destination_scope,
        purpose,
        group,
        pace,
        destinationCatalog,
      });
      input.cityId = searchStrategy.destinationKey;
      if (isGooglePlacesConfigured()) {
        try {
          const cachedReferences = request.body.page_token || request.body.refresh_queue === true
            ? []
            : await findDestinationPlaceReferences({
            destinationKey: searchStrategy.destinationKey,
            requestCategory: searchStrategy.requestCategory,
            limit: 20,
          }).catch(() => []);
          if (cachedReferences.length) {
            activities = await fetchGooglePlacesByIds(
              cachedReferences.map((place) => place.providerPlaceId),
              { destination: searchStrategy.label },
            );
            if (activities.length) source = "google_places_cache";
          }
          if (!activities.length) {
            const page = await searchGooglePlacesPage({
              destination: destinationName,
              country: searchStrategy.country,
              destinationScope: searchStrategy.scope,
              purpose,
              group,
              pace,
              limit: 20,
              searchQuery: searchStrategy.query,
              pageToken: request.body.page_token,
              destinationCatalog,
            });
            activities = page.activities;
            nextPageToken = page.nextPageToken;
          }
          if (activities.length) {
            if (source !== "google_places_cache") {
              source = "google_places";
              await rememberDestinationPlaceReferences({
                destinationKey: searchStrategy.destinationKey,
                destinationName: searchStrategy.name,
                destinationScope: searchStrategy.scope,
                countryName: searchStrategy.country,
                requestCategory: searchStrategy.requestCategory,
                searchQuery: searchStrategy.query,
                categoryTags: searchStrategy.categoryTags,
                places: activities,
              }).catch(() => {});
            }
          }
        } catch {
          // Provider failures fall back without interrupting live planning.
        }
      }
      if (activities.length < 12) {
        const supplementalActivities = await fallbackActivities(
          destinationMatch(destinationName),
          input,
        );
        const knownActivities = new Set(activities.map((activity) =>
          String(activity.title || "").trim().toLowerCase()));
        for (const activity of supplementalActivities) {
          const titleKey = String(activity.title || "").trim().toLowerCase();
          if (!titleKey || knownActivities.has(titleKey)) continue;
          activities.push(activity);
          knownActivities.add(titleKey);
        }
      }
      if (!activities.length) {
        response.status(404).json({ error: "No activities are available for this destination yet." });
        return;
      }
      const savedPlaceIds = new Set(
        (request.body.saved_place_ids || []).map((placeId) => String(placeId)),
      );
      if (request.auth?.userId && request.body.trip_id) {
        const storedPlaceIds = await listSavedTripPlaceIds(
          request.auth.userId,
          request.body.trip_id,
        ).catch(() => []);
        storedPlaceIds.forEach((placeId) => savedPlaceIds.add(placeId));
      }
      const excludedPlaceIds = new Set(
        (request.body.excluded_place_ids || []).map((placeId) => String(placeId)),
      );
      const identifiedActivities = activities.map(activityWithPlaceIdentity);
      const selectedPlaces = identifiedActivities
        .filter((activity) => savedPlaceIds.has(activity.placeId));
      const eligibleActivities = identifiedActivities
        .filter((activity) =>
          !savedPlaceIds.has(activity.placeId) && !excludedPlaceIds.has(activity.placeId));
      const recommendation = recommendPlannerActivities(eligibleActivities, input);
      const candidates = recommendation.candidateActivities || recommendation.activities || [];
      const primary = candidates.slice(0, 6);
      const backupQueue = candidates.slice(6, 20);
      delete recommendation.candidateActivities;
      response.json({
        ...recommendation,
        activities: primary,
        primary,
        backupQueue,
        savedPlaceIds: [...savedPlaceIds],
        selectedPlaces,
        nextPageToken,
        hasMore: Boolean(nextPageToken),
        source,
        search: {
          scope: searchStrategy.scope,
          destination: searchStrategy.name,
          country: searchStrategy.country,
          query: searchStrategy.query,
          cacheHit: source === "google_places_cache",
        },
        liveProviderConfigured: isGooglePlacesConfigured(),
      });
    } catch (error) {
      next(error);
    }
  },
);

activitiesRouter.get(
  "/photo/:placeId",
  recommendationLimiter,
  [param("placeId").matches(/^[A-Za-z0-9_-]{10,255}$/).withMessage("Choose a valid place photo.")],
  validateRequest,
  async (request, response, next) => {
    try {
      const photo = await fetchGooglePlacePhoto(request.params.placeId);
      if (!photo) {
        response.status(404).end();
        return;
      }
      const buffer = Buffer.from(await photo.arrayBuffer());
      if (buffer.byteLength > 8 * 1024 * 1024) {
        response.status(413).end();
        return;
      }
      response.set({
        "content-type": photo.headers.get("content-type") || "image/jpeg",
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      });
      response.send(buffer);
    } catch (error) {
      next(error);
    }
  },
);
