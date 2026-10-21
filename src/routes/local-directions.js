import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
export const localDirectionsRouter=Router();
localDirectionsRouter.use(rateLimit({windowMs:60000,limit:5,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Please wait a minute before comparing again.'}}));
localDirectionsRouter.post('/',async(req,res)=>{
 const {from,to,departure}=req.body||{};
 if([from,to].some(v=>typeof v!=='string'||v.trim().length<3||v.length>250)||from.trim()===to.trim())return res.status(422).json({error:'Enter two different full addresses or place names, including the city.'});
 if(departure&&(!Number.isFinite(Date.parse(departure))||Date.parse(departure)<Date.now()||Date.parse(departure)>Date.now()+100*86400000))return res.status(422).json({error:'Departure must be in the future and within 100 days for transit schedules.'});
 const key=process.env.GOOGLE_ROUTES_API_KEY;if(!key)return res.status(503).json({error:'Routes API is not configured. Use Google Maps directions below.'});
 res.set('Cache-Control','no-store');
 const results=await Promise.all(['TRANSIT','DRIVE','WALK'].map(async mode=>{
  try{
   const body={origin:{address:from.trim()},destination:{address:to.trim()},travelMode:mode,languageCode:'en',units:'METRIC'};
   if(mode==='TRANSIT'&&departure)body.departureTime=new Date(departure).toISOString();
   const response=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'routes.duration,routes.distanceMeters,routes.legs.steps.navigationInstruction,routes.legs.steps.travelMode,routes.legs.steps.distanceMeters,routes.legs.steps.transitDetails,routes.travelAdvisory.transitFare'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
   const data=await response.json();if(!response.ok)return {mode,error:response.status===403?'Google denied access. Check Routes API, billing and server IP restrictions.':response.status===429?'Route quota reached.':'Route provider is unavailable for this request.'};
   const r=data.routes?.[0];if(!r)return {mode,error:'No route available for this location or departure time.'};
   const steps=r.legs.flatMap(l=>l.steps||[]),rides=steps.filter(s=>s.travelMode==='TRANSIT');
   return {mode,duration:r.duration,distance:r.distanceMeters,fare:r.travelAdvisory?.transitFare?.currencyCode?r.travelAdvisory.transitFare:null,transitRides:rides.length,walking:steps.filter(s=>s.travelMode==='WALK').reduce((sum,s)=>sum+(s.distanceMeters||0),0),transfers:Math.max(0,rides.length-1),steps:steps.map(s=>({instruction:s.navigationInstruction?.instructions||s.travelMode,line:s.transitDetails?.transitLine?.nameShort||s.transitDetails?.transitLine?.name,from:s.transitDetails?.stopDetails?.departureStop?.name,to:s.transitDetails?.stopDetails?.arrivalStop?.name,headsign:s.transitDetails?.headsign}))};
  }catch{return {mode,error:'Directions timed out or are unavailable. Try again.'};}
 }));res.json({results});
});
