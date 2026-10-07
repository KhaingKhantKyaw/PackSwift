import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { buildLiveReview } from '../services/live-review.js';
export const liveReviewRouter = Router();
liveReviewRouter.post('/v1/trips/live-review', rateLimit({windowMs:60000,limit:60,standardHeaders:'draft-8',legacyHeaders:false}), (req,res,next) => {
  try { res.set('Cache-Control','no-store').json(buildLiveReview(req.body || {})); }
  catch(error) { if(error instanceof RangeError)res.status(400).json({message:error.message});else next(error); }
});
