import { Router } from "express";
import { costEstimateRouter } from "./cost-estimate.js";
import { budgetBaselineRouter } from "./budget-baseline.js";
import { generateItineraryRouter } from "./generate-itinerary.js";
import {
  buildPackingList,
} from "../services/travel-planner.js";
import {
  isDatabaseConfigured,
  verifyDatabaseConnection,
} from "../config/database.js";
import { authRouter } from "./auth.js";
import { activitiesRouter } from "./activities.js";
import { aiRouter } from "./ai.js";
import { contactRouter } from "./contact.js";
import { destinationsRouter } from "./destinations.js";
import { ecosystemRouter } from "./ecosystem.js";
import { profileRouter } from "./profile.js";
import { plannerRouter } from "./planner.js";
import { savedTripsRouter } from "./saved-trips.js";
import { tripsRouter } from "./trips.js";
import { tripPlanRouter } from "./trip-plan.js";

export const apiRouter = Router();
apiRouter.use(costEstimateRouter);
apiRouter.use(budgetBaselineRouter);
apiRouter.use(generateItineraryRouter);

apiRouter.use("/auth", authRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/activities", activitiesRouter);
apiRouter.use("/contact", contactRouter);
apiRouter.use("/destinations", destinationsRouter);
apiRouter.use("/profile", profileRouter);
apiRouter.use("/planner", plannerRouter);
apiRouter.use("/saved-trips", savedTripsRouter);
apiRouter.use("/trips", tripsRouter);
apiRouter.use("/trip/plan", tripPlanRouter);

apiRouter.get("/health", async (request, response) => {
  let database = "not-configured";
  if (isDatabaseConfigured()) {
    try {
      await verifyDatabaseConnection();
      database = "connected";
    } catch {
      database = "unavailable";
    }
  }
  response.json({ status: "ok", service: "packswift", database });
});

apiRouter.post("/packing-list", (request, response, next) => {
  try {
    response.json({ packingList: buildPackingList(request.body) });
  } catch (error) {
    next(error);
  }
});

apiRouter.use(ecosystemRouter);
