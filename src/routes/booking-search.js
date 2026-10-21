import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import {searchBooking} from '../services/booking-search.js';
export const bookingSearchRouter=Router();
bookingSearchRouter.use(rateLimit({windowMs:60000,limit:6,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Please wait a minute before searching again.'}}));
bookingSearchRouter.post('/:kind',async(req,res)=>{
 res.set('Cache-Control','no-store');
 try{res.json(await searchBooking(req.params.kind,req.body||{}));}
 catch(e){res.status(e.status||500).json({error:e.status?e.message:'Search could not be completed.'});}
});
