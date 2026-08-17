import { Router } from "express";
import { body } from "express-validator";
import { requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../middleware/database.js";
import { validateRequest } from "../middleware/validate.js";
import { addPlaceToTrip } from "../repositories/trip-plan-repository.js";

export const tripPlanRouter = Router();

tripPlanRouter.use(requireAuth, requireDatabase);

tripPlanRouter.post(
  "/add",
  [
    body("trip_id").isUUID(4).withMessage("Choose a valid saved trip."),
    body("place_id")
      .isString()
      .trim()
      .isLength({ min: 3, max: 255 })
      .matches(/^[A-Za-z0-9:_-]+$/)
      .withMessage("Choose a valid activity."),
    body("provider")
      .optional()
      .isIn(["google_places", "packswift_catalog"])
      .withMessage("Choose a supported activity provider."),
  ],
  validateRequest,
  async (request, response, next) => {
    try {
      const saved = await addPlaceToTrip(request.auth.userId, {
        tripId: request.body.trip_id,
        placeId: request.body.place_id,
        provider: request.body.provider || "packswift_catalog",
      });
      if (!saved) {
        response.status(404).json({ error: "Trip not found." });
        return;
      }
      response.status(saved.alreadySaved ? 200 : 201).json({
        message: saved.alreadySaved ? "Already in your plan." : "Added to your plan!",
        item: {
          id: saved.id,
          tripId: request.body.trip_id,
          placeId: request.body.place_id,
          provider: request.body.provider || "packswift_catalog",
          position: saved.position,
        },
        alreadySaved: saved.alreadySaved,
      });
    } catch (error) {
      next(error);
    }
  },
);
