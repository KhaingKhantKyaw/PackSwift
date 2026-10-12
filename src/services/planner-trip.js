// Destination-first persistence adapter. Reuses review validation and canonical state;
// does not run the legacy destination/budget questionnaire generator.
import {randomUUID} from 'node:crypto';
import {destinationCatalog,currencyRatesToUsd,routeLocation} from './travel-planner.js';
import {buildLiveReview} from './live-review.js';
export function createPlannerTrip(raw){
 const destination=String(raw.destination||'').trim().slice(0,100),origin=String(raw.origin||'').trim().slice(0,100);
 if(!destination)throw new RangeError('Choose a destination to continue.');
 if(!currencyRatesToUsd[raw.currency])throw new RangeError('Choose a supported currency.');
 const budget=raw.budget==null||raw.budget===''?null:Number(raw.budget);if(budget!==null&&(!Number.isFinite(budget)||budget<0||budget*currencyRatesToUsd[raw.currency]>250000))throw new RangeError('Choose a valid budget or leave it blank.');
 const review=buildLiveReview({...raw,destination,origin});
 for(const key of ['arrivalAt','departureAt'])if(raw[key]&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw[key])||!Number.isFinite(Date.parse(raw[key]))||raw[key].slice(0,10)<raw.startDate||raw[key].slice(0,10)>raw.endDate))throw new RangeError('Choose travel times within your trip dates.');
 if(raw.arrivalAt&&raw.departureAt&&raw.departureAt<=raw.arrivalAt)throw new RangeError('Departure must be after arrival.');
 const found=destinationCatalog.find(c=>[c.name,c.slug].some(n=>n.toLowerCase()===destination.toLowerCase()));
 const context=globalThis.PackSwiftTripContext.routeContext({...raw,origin,destination});
 return {id:randomUUID(),createdAt:new Date().toISOString(),input:{...raw,...context,budget:budget??0,budgetTarget:budget,adults:Number(raw.adults),children:Number(raw.children),travelers:Number(raw.adults)+Number(raw.children),tripScope:context.routeType==='domestic'?'domestic':'international',tripPurpose:raw.tripPurpose==='culture'?'cultural':raw.tripPurpose||'leisure',pace:raw.pace||'balanced',interests:raw.interests||[],route:{scope:context.routeType,origin:origin?routeLocation(origin)||{name:origin}:null,destination:routeLocation(destination)||{name:destination}}},destination:{...found,name:destination,slug:found?.slug||destination.toLowerCase().replace(/[^a-z0-9]+/g,'-'),score:0},summary:'Your selected places and personal travel plan.',weather:null,itinerary:[],packingList:{Essentials:['Personal identification','Everyday clothing','Comfortable shoes','Phone charger','Personal essentials']},review};
}
