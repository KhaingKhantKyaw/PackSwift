import { Router } from "express";
import { param, query } from "express-validator";
import { requireDatabase } from "../middleware/database.js";
import { validateRequest } from "../middleware/validate.js";
import { searchDestinations } from "../repositories/destination-repository.js";
import { getDestinationInsight } from "../services/destination-insight-service.js";
import { cleanText } from "../utils/sanitize.js";

export const destinationsRouter = Router();

destinationsRouter.use(requireDatabase);

destinationsRouter.get(
  "/",
  [
    query("search")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Destination search is too long."),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50."),
  ],
  validateRequest,
  async (request, response, next) => {
    try {
      const destinations = await searchDestinations({
        search: cleanText(request.query.search, 100),
        limit: Number(request.query.limit) || 20,
      });
      response.json({ destinations });
    } catch (error) {
      next(error);
    }
  },
);

destinationsRouter.get(
  "/:slug/insights",
  [
    param("slug")
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .isLength({ min: 2, max: 160 })
      .withMessage("Choose a valid destination."),
  ],
  validateRequest,
  async (request, response, next) => {
    try {
      const result = await getDestinationInsight(request.params.slug);
      if (!result) {
        response.status(404).json({ error: "Destination not found." });
        return;
      }
      response.json(result);
    } catch (error) {
      next(error);
    }
  },
);
