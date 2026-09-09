import { Router } from "express";
import { body, param, query } from "express-validator";
import { requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../middleware/database.js";
import { validateRequest } from "../middleware/validate.js";
import {
  addItineraryActivity,
  ensureWeatherReadinessItem,
  getVisaStatus,
  listInteractiveItinerary,
  replaceInteractiveItinerary,
} from "../repositories/ecosystem-repository.js";
import { updateReadinessItem } from "../repositories/readiness-repository.js";
import {
  getOwnedTrip,
  listTripTimeline,
  replaceTripTimeline,
} from "../repositories/trip-repository.js";
import { buildDetailedTimeline } from "../services/itinerary-timeline-service.js";
import { destinationCatalog } from "../services/travel-planner.js";
import { getCurrencyRates, getDestinationWeather } from "../services/trip-tools-service.js";

export const ecosystemRouter = Router();
ecosystemRouter.use(requireAuth, requireDatabase);

const tripIdBody = body("tripId").isUUID(4).withMessage("Choose a valid trip.");
const tripIdQuery = query("trip").isUUID(4).withMessage("Choose a valid trip.");
const tripIdParam = param("tripId").isUUID(4).withMessage("Choose a valid trip.");

function storedPlan(trip) {
  const destination = destinationCatalog.find((item) => item.slug === trip.destination.slug) || {
    slug: trip.destination.slug,
    code: trip.destination.primaryAirportCode,
    name: trip.destination.name,
    country: trip.destination.countryName,
    attractions: [`Central ${trip.destination.name}`, `${trip.destination.name} cultural district`],
  };
  const start = trip.dates.start ? new Date(`${trip.dates.start}T00:00:00Z`) : null;
  const end = trip.dates.end ? new Date(`${trip.dates.end}T00:00:00Z`) : null;
  const days = start && end ? Math.max(1, Math.round((end - start) / 86400000) + 1) : 1;
  return {
    days,
    destination,
    input: {
      tripPurpose: trip.tripPurpose,
      pace: trip.pace,
      smartPace: trip.preferences?.smartPace || {},
      arrivalAt: trip.arrival.arrivalAt,
    },
  };
}

async function generatedTimeline(userId, tripId) {
  const trip = await getOwnedTrip(userId, tripId);
  if (!trip) return null;
  let timeline = await listTripTimeline(userId, tripId);
  if (!timeline.length) {
    timeline = buildDetailedTimeline(storedPlan(trip), {
      slug: trip.destination.slug,
      name: trip.destination.name,
      countryName: trip.destination.countryName,
      primaryAirportCode: trip.destination.primaryAirportCode,
      arrivalAt: trip.arrival.arrivalAt,
      hotelName: trip.arrival.hotelName,
    });
    await replaceTripTimeline(userId, tripId, timeline);
  }
  const days = await replaceInteractiveItinerary(userId, tripId, timeline);
  return { trip, days };
}

ecosystemRouter.post(
  "/itinerary/generate",
  [tripIdBody],
  validateRequest,
  async (request, response, next) => {
    try {
      const result = await generatedTimeline(request.auth.userId, request.body.tripId);
      if (!result) return response.status(404).json({ error: "Trip not found." });
      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

ecosystemRouter.get(
  "/itinerary/:tripId",
  [tripIdParam],
  validateRequest,
  async (request, response, next) => {
    try {
      const trip = await getOwnedTrip(request.auth.userId, request.params.tripId);
      if (!trip) return response.status(404).json({ error: "Trip not found." });
      let days = await listInteractiveItinerary(request.auth.userId, request.params.tripId);
      if (!days.length) ({ days } = await generatedTimeline(request.auth.userId, request.params.tripId));
      response.json({ trip, days });
    } catch (error) {
      next(error);
    }
  },
);

ecosystemRouter.post(
  "/itinerary/:tripId/activities",
  [
    tripIdParam,
    body("day").isInt({ min: 1, max: 30 }),
    body("period").isIn(["morning", "afternoon", "evening", "nightlife"]),
    body("startTime").matches(/^([01]\d|2[0-3]):[0-5]\d$/),
    body("placeName").trim().isLength({ min: 2, max: 180 }),
    body("category").trim().isLength({ min: 2, max: 80 }),
    body("description").optional().trim().isLength({ max: 1000 }),
    body("durationMinutes").isInt({ min: 15, max: 720 }),
    body("estimatedCost").isFloat({ min: 0, max: 1000000 }),
    body("currency").matches(/^[A-Z]{3}$/),
    body("transitMode").optional({ values: "falsy" }).trim().isLength({ max: 50 }),
    body("transitMinutes").optional({ values: "falsy" }).isInt({ min: 1, max: 240 }),
    body("transitDistanceKm").optional({ values: "falsy" }).isFloat({ min: 0, max: 1000 }),
  ],
  validateRequest,
  async (request, response, next) => {
    try {
      const days = await addItineraryActivity(request.auth.userId, request.params.tripId, request.body);
      if (!days) return response.status(404).json({ error: "Trip not found." });
      response.status(201).json({ days });
    } catch (error) {
      next(error);
    }
  },
);

ecosystemRouter.patch(
  "/checklist/update",
  [
    tripIdBody,
    body("itemId").isInt({ min: 1 }),
    body("isPrepared").isBoolean({ strict: true }),
  ],
  validateRequest,
  async (request, response, next) => {
    try {
      const progress = await updateReadinessItem(
        request.auth.userId,
        request.body.tripId,
        Number(request.body.itemId),
        request.body.isPrepared,
      );
      if (!progress) return response.status(404).json({ error: "Checklist item not found." });
      response.json({ itemId: Number(request.body.itemId), isPrepared: request.body.isPrepared, progress });
    } catch (error) {
      next(error);
    }
  },
);

ecosystemRouter.get(
  "/visa/status",
  [tripIdQuery],
  validateRequest,
  async (request, response, next) => {
    try {
      const visa = await getVisaStatus(request.auth.userId, request.query.trip);
      if (!visa) return response.status(404).json({ error: "Trip not found." });
      response.json({ visa });
    } catch (error) {
      next(error);
    }
  },
);

ecosystemRouter.get(
  "/trip-tools",
  [tripIdQuery],
  validateRequest,
  async (request, response, next) => {
    try {
      const trip = await getOwnedTrip(request.auth.userId, request.query.trip);
      if (!trip) return response.status(404).json({ error: "Trip not found." });
      const [weather, currency] = await Promise.all([
        getDestinationWeather(trip.destination.cityName || trip.destination.name),
        getCurrencyRates(),
      ]);
      await ensureWeatherReadinessItem(request.auth.userId, request.query.trip, weather.alert);
      response.json({ weather, currency, preferredCurrency: trip.budget.currency });
    } catch (error) {
      next(error);
    }
  },
);
