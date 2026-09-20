import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { calculateTripEstimate } from "../services/costEngine.js";
export const costEstimateRouter = Router();
costEstimateRouter.post("/cost-estimate", rateLimit({ windowMs: 60000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false }), (req, res) => {
  try {
    const { destination, startDate, endDate, travellers, style } = req.body;
    if (typeof destination !== "string" || destination.length > 150) throw new RangeError("Choose a destination.");
    res.set("Cache-Control", "no-store").json(calculateTripEstimate(destination, startDate, endDate, travellers, style));
  } catch (error) { res.status(422).json({ error: error.message }); }
});
