import { Router } from "express";
import { body, param } from "express-validator";
import { requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../middleware/database.js";
import { validateRequest } from "../middleware/validate.js";
import {
  createSavedTrip,
  deleteSavedTrip,
  listSavedTrips,
  updateSavedTrip,
} from "../repositories/saved-trip-repository.js";
import { cleanText } from "../utils/sanitize.js";

export const savedTripsRouter = Router();

savedTripsRouter.use(requireAuth, requireDatabase);

savedTripsRouter.get("/", async (request, response, next) => {
  try {
    response.set("Cache-Control", "no-store, max-age=0");
    response.json({ savedTrips: await listSavedTrips(request.auth.userId) });
  } catch (error) {
    next(error);
  }
});

const savedTripPlanValidation = [
  body("plan").isObject().withMessage("A complete trip plan is required."),
  body("plan.id").isUUID(4).withMessage("The trip plan identifier is invalid."),
  body("plan.destination.name")
    .isString()
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage("The destination is invalid."),
  body("plan.travelMonth")
    .isString()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("The travel month is invalid."),
  body("plan.input.budgetUsd")
    .isFloat({ gt: 0, max: 250000 })
    .withMessage("The normalized trip budget is invalid."),
];

function sanitizeSavedPlan(input) {
  const plan = structuredClone(input);
  plan.destination.name = cleanText(plan.destination.name, 255);
  plan.destination.country = cleanText(plan.destination.country || "", 120);
  plan.travelMonth = cleanText(plan.travelMonth, 50);
  return plan;
}

savedTripsRouter.post(
  "/",
  savedTripPlanValidation,
  validateRequest,
  async (request, response, next) => {
    try {
      const serialized = JSON.stringify(request.body.plan);
      if (serialized.length > 100000) {
        response.status(413).json({ error: "The trip plan is too large to save." });
        return;
      }
      const plan = sanitizeSavedPlan(request.body.plan);
      const id = await createSavedTrip(request.auth.userId, plan);
      response.status(201).json({ id, message: "Trip saved to your dashboard." });
    } catch (error) {
      next(error);
    }
  },
);

savedTripsRouter.patch(
  "/:savedTripId",
  [param("savedTripId").isInt({ min: 1 }), ...savedTripPlanValidation],
  validateRequest,
  async (request, response, next) => {
    try {
      const serialized = JSON.stringify(request.body.plan);
      if (serialized.length > 100000) {
        response.status(413).json({ error: "The trip plan is too large to update." });
        return;
      }
      const plan = sanitizeSavedPlan(request.body.plan);
      const updated = await updateSavedTrip(
        request.auth.userId,
        Number(request.params.savedTripId),
        plan,
      );
      if (!updated) {
        response.status(404).json({ error: "Saved trip not found." });
        return;
      }
      response.json({ id: Number(request.params.savedTripId), message: "Saved trip updated." });
    } catch (error) {
      next(error);
    }
  },
);

savedTripsRouter.delete(
  "/:savedTripId",
  [param("savedTripId").isInt({ min: 1 })],
  validateRequest,
  async (request, response, next) => {
    try {
      const deleted = await deleteSavedTrip(
        request.auth.userId,
        Number(request.params.savedTripId),
      );
      if (!deleted) {
        response.status(404).json({ error: "Saved trip not found." });
        return;
      }
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);
