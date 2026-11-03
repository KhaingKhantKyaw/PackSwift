import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import {query,param} from 'express-validator';
import {validateRequest} from '../middleware/validate.js';
import {PlaceSearchService,placeSearchFailure} from '../services/place-search-service.js';
import {activityTopics,activityStyles} from '../services/activity-discovery-plan.js';
export const placeSearchRouter=Router();
placeSearchRouter.use(rateLimit({windowMs:60000,limit:45,standardHeaders:'draft-8',legacyHeaders:false,message:{code:'RATE_LIMITED',message:'Too many place searches. Please wait a minute and try again.'}}));
const context=[query('destination').optional().isString().isLength({max:150}),query('sessionToken').optional().isUUID()];
const handle=method=>async(req,res)=>{
 res.set('Cache-Control','no-store');
 try{const service=new PlaceSearchService();res.json(await service[method]({query:req.query.q,destination:req.query.destination,sessionToken:req.query.sessionToken,id:req.params.id,purpose:req.query.purpose,style:req.query.style,variant:req.query.variant,pageToken:req.query.pageToken}));}
 catch(e){
  const development=process.env.NODE_ENV!=='production';
  if(development&&e.diagnostic)console.error('Place search failed:',{operation:method,...e.diagnostic});
  const {status,...failure}=placeSearchFailure(e);
  res.status(status).json(failure);
 }
};
placeSearchRouter.get('/autocomplete',[query('q').isString().trim().isLength({min:2,max:200}),...context],validateRequest,handle('autocomplete'));
placeSearchRouter.get('/transport-autocomplete',[query('q').isString().trim().isLength({min:2,max:200}),...context],validateRequest,handle('transportAutocomplete'));
placeSearchRouter.get('/search',[query('q').isString().trim().isLength({min:2,max:200}),...context],validateRequest,handle('textSearch'));
placeSearchRouter.get('/popular-activities',[
 query('destination').isString().trim().isLength({min:2,max:150}),
 query('purpose').isIn(Object.keys(activityTopics)),query('style').isIn(Object.keys(activityStyles)),
 query('variant').optional().isInt({min:0,max:2}),query('pageToken').optional().isString().isLength({min:1,max:8192})
],validateRequest,handle('popularActivities'));
placeSearchRouter.get('/:id',[param('id').matches(/^[A-Za-z0-9_-]{10,255}$/),...context],validateRequest,handle('details'));
