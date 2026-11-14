import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import {getTripForecast} from '../services/trip-forecast.js';
export const tripForecastRouter=Router();
tripForecastRouter.use(rateLimit({windowMs:60000,limit:20,standardHeaders:'draft-8',legacyHeaders:false}));
tripForecastRouter.get('/',async(req,res)=>{try{res.set('Cache-Control','no-store');res.json(await getTripForecast(req.query));}catch(error){res.status(error.status||503).json({message:error.status?error.message:'Forecast unavailable.'});}});
