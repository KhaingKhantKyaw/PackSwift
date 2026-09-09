import { Router } from "express";
import { randomUUID } from "node:crypto";
import { body, param } from "express-validator";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../middleware/database.js";
import { validateRequest } from "../middleware/validate.js";
import {
  getOwnedTrip,
  getPackingContext,
  listPackingItems,
  listTripTimeline,
  replacePackingItems,
  replaceTripTimeline,
  saveTrip,
  updatePackingItem,
} from "../repositories/trip-repository.js";
import {
  cancelReadyTrip,
  ensureReadinessItems,
  listReadinessItems,
  markTripReady,
  updateReadinessItem,
} from "../repositories/readiness-repository.js";
import {
  buildPackingList,
  currencyRatesToUsd,
  createTravelPlan,
  destinationCatalog,
  minimumTripBudgetDetails,
  routeLocation,
} from "../services/travel-planner.js";
import { buildDetailedTimeline } from "../services/itinerary-timeline-service.js";
import { cleanTripEntity, normalizeTripRecommendation } from "../services/ai-concierge-service.js";

export const tripsRouter = Router();

function validateTripId() {
  return param("tripId")
    .isUUID(4)
    .withMessage("Choose a valid trip.");
}

function planFromStoredTrip(trip) {
  const catalogDestination =
    destinationCatalog.find(
      (destination) => destination.slug === trip.destination.slug,
    ) || {
      slug: trip.destination.slug,
      code: trip.destination.primaryAirportCode,
      name: trip.destination.name,
      country: trip.destination.countryName,
      attractions: [
        `Central ${trip.destination.name}`,
        `${trip.destination.name} cultural district`,
      ],
    };
  const start = trip.dates.start
    ? new Date(`${trip.dates.start}T00:00:00Z`)
    : null;
  const end = trip.dates.end
    ? new Date(`${trip.dates.end}T00:00:00Z`)
    : null;
  const days =
    start &&
    end &&
    !Number.isNaN(start.valueOf()) &&
    !Number.isNaN(end.valueOf())
      ? Math.max(1, Math.round((end - start) / 86400000) + 1)
      : 1;

  return {
    days,
    destination: catalogDestination,
    input: {
      tripPurpose: trip.tripPurpose,
      pace: trip.pace,
      smartPace: trip.preferences?.smartPace || {
        lateRiser: false,
        middayRest: false,
        clusterNearby: false,
      },
      arrivalAt: trip.arrival.arrivalAt,
    },
  };
}

tripsRouter.post("/analyze", optionalAuth, async (request, response, next) => {
  try {
    const plan = createTravelPlan(request.body);
    const persistence = await saveTrip(
      plan,
      request.auth?.userId ?? null,
    );
    response.status(201).json({ plan, persistence });
  } catch (error) {
    next(error);
  }
});

function estimateDate(value) {
  const text = String(value || "").trim();
  const displayMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const parts = displayMatch
    ? [Number(displayMatch[3]), Number(displayMatch[2]), Number(displayMatch[1])]
    : isoMatch
      ? [Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])]
      : null;
  if (!parts) return null;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day ? date : null;
}

tripsRouter.post(
  "/estimate-budget",
  [
    body("origin").isString().trim().isLength({ min: 2, max: 100 }),
    body("destination").isString().trim().isLength({ min: 2, max: 160 }),
    body("start_date").isString().isLength({ min: 10, max: 10 }),
    body("end_date").isString().isLength({ min: 10, max: 10 }),
    body("adults_count").isInt({ min: 1, max: 12 }).toInt(),
    body("children_count").optional().isInt({ min: 0, max: 8 }).toInt(),
    body("currency").isIn(["THB", "USD", "MMK"]),
    body("budget").optional().isFloat({ min: 1, max: 10000000 }).toFloat(),
  ],
  validateRequest,
  (request, response, next) => {
    try {
      const originName = cleanTripEntity(request.body.origin, 100);
      const destinationName = cleanTripEntity(request.body.destination, 160);
      const origin = routeLocation(originName);
      const destination = routeLocation(destinationName);
      const start = estimateDate(request.body.start_date);
      const end = estimateDate(request.body.end_date);
      if (!origin || !destination) throw new RangeError("Choose a supported origin and destination.");
      if (!start || !end || end < start) throw new RangeError("Choose valid travel dates.");
      const days = Math.round((end - start) / 86400000) + 1;
      if (days < 1 || days > 30) throw new RangeError("Trips must be between 1 and 30 days.");
      const travelers = request.body.adults_count + (request.body.children_count || 0);
      const scope = origin.country === destination.country ? "domestic" : "international";
      const details = minimumTripBudgetDetails(scope, origin, destination, { travelers, days });
      const rateToUsd = currencyRatesToUsd[request.body.currency];
      const minimumAmount = Math.round((details.minimumBudgetUsd / rateToUsd) * 100) / 100;
      const transitAmount = Math.round((details.transitCostPerPersonUsd / rateToUsd) * 100) / 100;
      const submitted = Number(request.body.budget);
      response.json({
        route: { origin: origin.name, destination: destination.name, scope },
        travelers,
        days,
        transit: {
          round_trip_per_person_usd: details.transitCostPerPersonUsd,
          round_trip_per_person: transitAmount,
          currency: request.body.currency,
        },
        minimum_budget: {
          amount: minimumAmount,
          currency: request.body.currency,
          usd: details.minimumBudgetUsd,
        },
        ...(Number.isFinite(submitted)
          ? {
              submitted_budget: {
                amount: submitted,
                currency: request.body.currency,
                is_valid: submitted > 0,
                meets_recommended_budget: submitted >= minimumAmount,
              },
            }
          : {}),
      });
    } catch (error) {
      next(error);
    }
  },
);

tripsRouter.use(requireAuth, requireDatabase);

const recommendationPurposeMap = Object.freeze({
  "Adventure & Outdoor": "adventure",
  "Adventure & Leisure": "adventure",
  "Leisure & Relaxation": "leisure",
  "Culture & Heritage": "cultural",
  "Food & Nightlife": "food",
});
const recommendationGroupMap = Object.freeze({
  Solo: "solo",
  Couples: "couples",
  Friends: "friends-group",
  Family: "family-with-children",
});
const recommendationPaceMap = Object.freeze({
  "Slow & Relaxed": "relaxed",
  "Balanced & Steady": "balanced",
  "Packed & Fast": "packed",
});

function recommendationDateToIso(value) {
  const [day, month, year] = String(value).split("/");
  return `${year}-${month}-${day}`;
}

function recommendationPlannerInput(recommendation) {
  return {
    tripScope: recommendation.scope === "Nationwide" ? "domestic" : "international",
    origin: recommendation.origin,
    destination: recommendation.destination,
    startDate: recommendationDateToIso(recommendation.start_date),
    endDate: recommendationDateToIso(recommendation.end_date),
    budget: recommendation.total_budget,
    currency: recommendation.currency,
    adults: recommendation.adults_count,
    children: recommendation.children_count,
    travelers: recommendation.adults_count + recommendation.children_count,
    travelingWithPets: recommendation.pet_included,
    tripPurpose: recommendationPurposeMap[recommendation.travel_purpose],
    travelerDemographic: recommendationGroupMap[recommendation.travel_group],
    pace: recommendationPaceMap[recommendation.travel_pace],
    smartPace: { lateRiser: false, middayRest: false, clusterNearby: true },
  };
}

function genericRecommendationPlan(recommendation) {
  const input = recommendationPlannerInput(recommendation);
  const start = new Date(`${input.startDate}T00:00:00Z`);
  const end = new Date(`${input.endDate}T00:00:00Z`);
  const days = Math.max(1, Math.min(30, Math.round((end - start) / 86400000) + 1));
  const parts = recommendation.destination.split(",").map((part) => part.trim()).filter(Boolean);
  const name = parts[0];
  const country = parts.slice(1).join(", ") || name;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  input.interests = input.tripPurpose === "adventure"
    ? ["adventure", "nature", "outdoor"]
    : input.tripPurpose === "cultural"
      ? ["culture", "history", "museum"]
      : input.tripPurpose === "food"
        ? ["food", "market", "nightlife"]
        : ["wellness", "culture", "food"];
  input.route = {
    scope: input.tripScope,
    origin: { name: input.origin, country: "", code: null },
    destination: { name, country, code: null },
    estimatedTransitCostUsd: null,
  };
  input.preferredClimate = "any";
  const itinerary = Array.from({ length: Math.min(days, 7) }, (_, index) => ({
    day: index + 1,
    title: index === 0 ? `Arrive and settle into ${name}` : `${name} day ${index + 1}`,
    morning: index === 0 ? "Airport arrival and hotel transfer" : "Signature local highlight",
    afternoon: "Curated neighbourhood experience",
    evening: input.tripPurpose === "food" ? "Local dining and nightlife" : "Flexible local dinner",
  }));
  return {
    id: randomUUID(), createdAt: new Date().toISOString(), input, days,
    destination: {
      slug, name, country, region: recommendation.scope, code: name.slice(0, 3).toUpperCase(),
      score: 90,
      attractions: [`${name} cultural highlights`, `${name} local neighbourhoods`, `${name} signature experiences`],
    },
    itinerary,
    packingList: {
      Essentials: ["Passport and travel documents", "Entry requirement notes", "Phone charger and universal adapter"],
      Clothing: ["Comfortable walking shoes", "Weather-appropriate outfits", "Sleepwear"],
      Comfort: ["Small day bag", "Basic first-aid items"],
      ...(recommendation.pet_included
        ? { "Pet care": ["Pet travel documents", "Secure carrier", "Food and medication"] }
        : {}),
    },
    weather: { low: 22, high: 31, climate: "warm", rain: "moderate", note: "Live weather guidance will update closer to departure." },
    activityPreviews: [], alternatives: [], estimatedCost: recommendation.total_budget,
    estimatedCostUsd: recommendation.currency === "USD" ? recommendation.total_budget : 0,
    budgetFit: { withinBudget: true, difference: 0, message: "Concierge shaped this plan to stay within the selected total budget." },
    bestTimeToVisit: "Matched to your selected travel dates",
    costNote: "Use live PackSwift flight, stay, and activity tools to refine prices before purchase.",
    culturalNotes: ["Respect local customs and dress guidance.", "Verify current entry and safety requirements before departure."],
    summary: recommendation.summary_pitch,
    conciergeRecommendation: recommendation,
  };
}

tripsRouter.post(
  "/create",
  [
    body("recommendation")
      .custom((value) => Boolean(normalizeTripRecommendation(value)))
      .withMessage("Choose a complete and valid Concierge trip recommendation."),
  ],
  validateRequest,
  async (request, response, next) => {
    try {
      const recommendation = normalizeTripRecommendation(request.body.recommendation);
      let plan;
      try {
        plan = createTravelPlan(recommendationPlannerInput(recommendation));
      } catch (error) {
        if (!(error instanceof RangeError) || !/supported (?:origin|destination)/i.test(error.message)) throw error;
        plan = genericRecommendationPlan(recommendation);
      }
      plan.summary = recommendation.summary_pitch;
      plan.conciergeRecommendation = recommendation;
      const persistence = await saveTrip(plan, request.auth.userId);
      response.status(201).json({
        trip_id: plan.id,
        redirect_url: `/trip-planner?trip_id=${encodeURIComponent(plan.id)}`,
        plan: { ...plan, persistence },
      });
    } catch (error) {
      if (error instanceof RangeError) {
        response.status(422).json({ error: error.message });
        return;
      }
      next(error);
    }
  },
);

tripsRouter.post(
  "/import",
  [
    body("plan").isObject().withMessage("A complete trip plan is required."),
    body("plan.id").isUUID(4).withMessage("The trip identifier is invalid."),
    body("plan.destination.name")
      .isString()
      .trim()
      .isLength({ min: 2, max: 160 })
      .withMessage("The destination is invalid."),
  ],
  validateRequest,
  async (request, response, next) => {
    try {
      const serialized = JSON.stringify(request.body.plan);
      if (serialized.length > 100000) {
        response.status(413).json({ error: "The trip plan is too large to save." });
        return;
      }
      const persistence = await saveTrip(
        request.body.plan,
        request.auth.userId,
      );
      response.status(201).json({
        plan: request.body.plan,
        persistence,
      });
    } catch (error) {
      next(error);
    }
  },
);

tripsRouter.get(
  "/:tripId",
  [validateTripId()],
  validateRequest,
  async (request, response, next) => {
    try {
      const trip = await getOwnedTrip(
        request.auth.userId,
        request.params.tripId,
      );
      if (!trip) {
        response.status(404).json({ error: "Trip not found." });
        return;
      }
      const timeline = await listTripTimeline(
        request.auth.userId,
        request.params.tripId,
      );
      response.json({ trip: { ...trip, timeline } });
    } catch (error) {
      next(error);
    }
  },
);

tripsRouter.post(
  "/:tripId/timeline",
  [validateTripId()],
  validateRequest,
  async (request, response, next) => {
    try {
      const trip = await getOwnedTrip(
        request.auth.userId,
        request.params.tripId,
      );
      if (!trip) {
        response.status(404).json({ error: "Trip not found." });
        return;
      }
      const timeline = buildDetailedTimeline(planFromStoredTrip(trip), {
        slug: trip.destination.slug,
        name: trip.destination.name,
        countryName: trip.destination.countryName,
        primaryAirportCode:
          trip.destination.primaryAirportCode,
        arrivalAt: trip.arrival.arrivalAt,
        hotelName: trip.arrival.hotelName,
      });
      await replaceTripTimeline(
        request.auth.userId,
        request.params.tripId,
        timeline,
      );
      response.json({ timeline });
    } catch (error) {
      next(error);
    }
  },
);

tripsRouter.get(
  "/:tripId/packing-context",
  [validateTripId()],
  validateRequest,
  async (request, response, next) => {
    try {
      const context = await getPackingContext(
        request.auth.userId,
        request.params.tripId,
      );
      if (!context) {
        response.status(404).json({ error: "Trip not found." });
        return;
      }
      response.json({ context });
    } catch (error) {
      next(error);
    }
  },
);

tripsRouter.get(
  "/:tripId/packing-list",
  [validateTripId()],
  validateRequest,
  async (request, response, next) => {
    try {
      const context = await getPackingContext(
        request.auth.userId,
        request.params.tripId,
      );
      if (!context) {
        response.status(404).json({ error: "Trip not found." });
        return;
      }
      const items = await listPackingItems(
        request.auth.userId,
        request.params.tripId,
      );
      response.json({ context, items });
    } catch (error) {
      next(error);
    }
  },
);

tripsRouter.post(
  "/:tripId/packing-list",
  [validateTripId()],
  validateRequest,
  async (request, response, next) => {
    try {
      const context = await getPackingContext(
        request.auth.userId,
        request.params.tripId,
      );
      if (!context) {
        response.status(404).json({ error: "Trip not found." });
        return;
      }
      const packingList = buildPackingList({
        climate: context.weather.climate,
        rain: context.weather.rain,
        days: context.dates.days,
        tripPurpose: context.tripPurpose,
        travelerDemographic: context.travelerDemographic,
        travelingWithPets: context.travelingWithPets,
      });
      await replacePackingItems(
        request.auth.userId,
        request.params.tripId,
        packingList,
      );
      const items = await listPackingItems(
        request.auth.userId,
        request.params.tripId,
      );
      response.status(201).json({ context, items });
    } catch (error) {
      next(error);
    }
  },
);

tripsRouter.patch(
  "/:tripId/packing-list/:itemId",
  [
    validateTripId(),
    param("itemId")
      .isInt({ min: 1 })
      .withMessage("Choose a valid packing item."),
    body("completed")
      .isBoolean({ strict: true })
      .withMessage("Packing completion must be true or false."),
  ],
  validateRequest,
  async (request, response, next) => {
    try {
      const updated = await updatePackingItem(
        request.auth.userId,
        request.params.tripId,
        Number(request.params.itemId),
        request.body.completed,
      );
      if (!updated) {
        response.status(404).json({ error: "Packing item not found." });
        return;
      }
      response.json({
        itemId: Number(request.params.itemId),
        completed: request.body.completed,
      });
    } catch (error) {
      next(error);
    }
  },
);

tripsRouter.post(
  "/:tripId/readiness/complete",
  [validateTripId()],
  validateRequest,
  async (request, response, next) => {
    try {
      const progress = await markTripReady(
        request.auth.userId,
        request.params.tripId,
      );
      if (!progress) {
        response.status(404).json({ error: "Trip not found." });
        return;
      }
      if (!progress.ready) {
        response.status(409).json({
          error: "Complete every checklist item before marking this trip ready.",
          progress,
        });
        return;
      }
      response.json({ status: "ready", progress });
    } catch (error) {
      next(error);
    }
  },
);

tripsRouter.post(
  "/:tripId/readiness/cancel",
  [validateTripId()],
  validateRequest,
  async (request, response, next) => {
    try {
      const cancelled = await cancelReadyTrip(
        request.auth.userId,
        request.params.tripId,
      );
      if (!cancelled) {
        response.status(404).json({ error: "Trip not found." });
        return;
      }
      response.json({ status: "planned" });
    } catch (error) {
      next(error);
    }
  },
);

tripsRouter.get(
  "/:tripId/readiness",
  [validateTripId()],
  validateRequest,
  async (request, response, next) => {
    try {
      const trip = await getOwnedTrip(
        request.auth.userId,
        request.params.tripId,
      );
      if (!trip) {
        response.status(404).json({ error: "Trip not found." });
        return;
      }
      await ensureReadinessItems(
        request.auth.userId,
        request.params.tripId,
        trip,
      );
      const items = await listReadinessItems(
        request.auth.userId,
        request.params.tripId,
      );
      const completed = items.filter((item) => item.completed).length;
      response.json({
        trip,
        items,
        progress: {
          total: items.length,
          completed,
          ready: items.length > 0 && completed === items.length,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

tripsRouter.patch(
  "/:tripId/readiness/:itemId",
  [
    validateTripId(),
    param("itemId")
      .isInt({ min: 1 })
      .withMessage("Choose a valid readiness item."),
    body("completed")
      .isBoolean({ strict: true })
      .withMessage("Readiness completion must be true or false."),
  ],
  validateRequest,
  async (request, response, next) => {
    try {
      const progress = await updateReadinessItem(
        request.auth.userId,
        request.params.tripId,
        Number(request.params.itemId),
        request.body.completed,
      );
      if (!progress) {
        response.status(404).json({ error: "Readiness item not found." });
        return;
      }
      response.json({
        itemId: Number(request.params.itemId),
        completed: request.body.completed,
        progress,
      });
    } catch (error) {
      next(error);
    }
  },
);
