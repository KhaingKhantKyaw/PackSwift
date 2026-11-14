import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { generateItineraryPlan, hydrateItineraryPlan } from '../services/itinerary-plan.js';

export const itineraryPlanRouter = Router();
itineraryPlanRouter.use(rateLimit({ windowMs: 60000, limit: 6, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Please wait a minute before generating or refreshing another itinerary.' } }));
itineraryPlanRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || JSON.stringify(req.body).length > 120000) return res.status(422).json({ code: 'INVALID_ITINERARY', message: 'The itinerary request is invalid or too large.' });
  next();
});
const handle = work => async (req, res) => {
  try { res.json(await work(req.body)); }
  catch (error) {
    const invalid = error instanceof RangeError || error.status === 422;
    res.status(invalid ? 422 : 503).json({ code: invalid ? 'INVALID_ITINERARY' : 'ITINERARY_UNAVAILABLE', message: invalid ? error.message : 'Itinerary generation is temporarily unavailable. Your previous plan is unchanged; please try again.' });
  }
};
itineraryPlanRouter.post('/', handle(generateItineraryPlan));
itineraryPlanRouter.post('/hydrate', handle(({ plan, input }) => hydrateItineraryPlan(plan, input)));
