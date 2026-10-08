import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { body } from "express-validator";
import { validateRequest } from "../middleware/validate.js";
import { generateVisualItinerary, itineraryStyles } from "../services/visual-itinerary-service.js";
import {recommendActivities} from '../services/activity-recommendations.js';

export const generateItineraryRouter = Router();
generateItineraryRouter.post('/activity-recommendations',rateLimit({windowMs:60000,limit:10,standardHeaders:'draft-8',legacyHeaders:false}),[
 body('destination').isString().trim().isLength({min:2,max:150}),
 body('startDate').isISO8601({strict:true}),body('endDate').isISO8601({strict:true}),
 body('notes').optional().isString().isLength({max:600}),
 body('tripPurpose').optional().isString().isLength({max:100}),
 body('pace').isIn(['relaxed','balanced','packed'])
],validateRequest,async(req,res,next)=>{try{res.set('Cache-Control','no-store').json(await recommendActivities(req.body));}catch(error){if(error instanceof RangeError)return res.status(400).json({message:error.message});next(error);}});
generateItineraryRouter.post("/generate-itinerary", rateLimit({ windowMs: 60000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false }), [
  body("destination").isString().trim().isLength({ min: 2, max: 150 }),
  body("userType").isIn(Object.keys(itineraryStyles)),
  body("duration").isInt({ min: 1, max: 14 }).toInt(),
  body("budgetCategory").isIn(["budget", "mid", "luxury"]),
  body("pace").optional().isIn(["relaxed", "balanced", "packed", "cultural", "culinary"]),
], validateRequest, async (req, res, next) => {
  try { res.set("Cache-Control", "no-store").json(await generateVisualItinerary(req.body)); }
  catch (error) { next(error); }
});
