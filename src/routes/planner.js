import { Router } from "express";
import { query } from "express-validator";
import { validateRequest } from "../middleware/validate.js";
import { findPlannerActivities } from "../repositories/planner-activity-repository.js";
import {
  readPlannerActivitySeed,
  recommendPlannerActivities,
} from "../services/live-trip-recommendation.js";

export const plannerRouter = Router();

plannerRouter.get(
  "/activities",
  [
    query("cityId").matches(/^[a-z0-9-]{2,32}$/).withMessage("Choose a valid city."),
    query("group")
      .isIn(["solo", "couples", "family-with-children", "friends-group", "business-duo", "senior"])
      .withMessage("Choose a valid travel group."),
    query("purpose")
      .isIn(["leisure", "cultural", "adventure", "food", "business", "events"])
      .withMessage("Choose a valid travel purpose."),
    query("pace")
      .isIn(["relaxed", "balanced", "packed", "cultural", "culinary"])
      .withMessage("Choose a valid pace."),
    query("lateRiser").optional().isBoolean().toBoolean(),
    query("middayRest").optional().isBoolean().toBoolean(),
    query("clusterNearby").optional().isBoolean().toBoolean(),
    query("budgetUsd").isFloat({ min: 1, max: 250000 }).withMessage("Choose a valid budget."),
    query("days").isInt({ min: 1, max: 30 }).withMessage("Choose valid travel dates."),
    query("travelers").isInt({ min: 1, max: 20 }).withMessage("Choose a valid traveller count."),
  ],
  validateRequest,
  async (request, response, next) => {
    try {
      let activities = [];
      try {
        activities = await findPlannerActivities(request.query.cityId);
      } catch {
        // The bundled seed keeps previews available before local MySQL initialization.
      }
      if (!activities.length) {
        const seed = await readPlannerActivitySeed();
        activities = seed.filter((activity) => activity.cityId === request.query.cityId);
      }
      if (!activities.length) {
        response.status(404).json({ error: "No live activities are available for this city yet." });
        return;
      }
      response.json(recommendPlannerActivities(activities, {
        cityId: request.query.cityId,
        group: request.query.group,
        purpose: request.query.purpose,
        pace: request.query.pace,
        budgetUsd: Number(request.query.budgetUsd),
        days: Number(request.query.days),
        travelers: Number(request.query.travelers),
        lateRiser: request.query.lateRiser === true || request.query.lateRiser === "true",
        middayRest: request.query.middayRest === true || request.query.middayRest === "true",
        clusterNearby:
          request.query.clusterNearby === true || request.query.clusterNearby === "true",
      }));
    } catch (error) {
      next(error);
    }
  },
);
