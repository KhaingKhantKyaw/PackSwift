import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import {getTravelAdvisory} from '../services/travel-advisory.js';
export const travelAdvisoryRouter=Router();
travelAdvisoryRouter.get('/travel-advisory',rateLimit({windowMs:60000,limit:40,standardHeaders:'draft-8',legacyHeaders:false}),async(req,res)=>{
  if(typeof req.query.destination!=='string'||req.query.destination.trim().length<2||req.query.destination.length>150)return res.status(400).json({message:'Choose a destination.'});
  res.set('Cache-Control','no-store').json(await getTravelAdvisory(req.query.destination));
});
