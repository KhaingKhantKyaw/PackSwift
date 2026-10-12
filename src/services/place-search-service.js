import {readFileSync} from 'node:fs';
import '../../public/js/canonical-itinerary.js';
import '../../public/js/place-search-model.js';
const model=globalThis.PackSwiftPlaceSearchModel;
const catalog=JSON.parse(readFileSync(new URL('../../public/data/destinations.json',import.meta.url),'utf8'));
export const placeReference=model.persist;
export function destinationBase(destination){const city=catalog.find(c=>[c.name,c.slug,c.code].some(s=>s?.toLowerCase()===String(destination||'').split(',')[0].trim().toLowerCase()));return city?{latitude:Number(city.latitude),longitude:Number(city.longitude)}:null;}
const endpoint='https://places.googleapis.com/v1';
const fields='id,displayName,formattedAddress,addressComponents,location,types,rating,userRatingCount,priceLevel,regularOpeningHours,photos,websiteUri,googleMapsUri,businessStatus';
const lodging=types=>types.some(t=>['lodging','hotel','motel','resort_hotel','extended_stay_hotel'].includes(t));
// Public, actionable messages only. Never return provider diagnostics or credentials.
export function placeSearchFailure(error){
 const d=error.diagnostic||{},message=String(d.message||'').toLowerCase();
 if(error.status===422)return {status:422,code:'UNSUPPORTED_PLACE',message:error.message};
 if(d.providerStatus===429)return {status:429,code:'QUOTA_EXCEEDED',message:'Place search has reached its request limit. Please try again shortly.'};
 if(d.code==='TIMEOUT')return {status:504,code:'TIMEOUT',message:'Place search took too long. Please try again.'};
 if(d.code==='NETWORK_ERROR')return {status:503,code:'NETWORK_ERROR',message:'Unable to reach the place search provider. Please try again.'};
 if(d.code==='MISSING_API_KEY')return {status:503,code:'MISSING_API_KEY',message:'Place search is not configured yet. Please contact support.'};
 if(/billing/.test(message))return {status:503,code:'BILLING_REQUIRED',message:'Place search requires a provider billing update. Please contact support.'};
 if(/has not been used|disabled|not enabled|service_disabled/.test(message))return {status:503,code:'API_DISABLED',message:'The place search service is not enabled. Please contact support.'};
 if(d.providerStatus===401||/api key not valid|invalid api key/.test(message))return {status:503,code:'INVALID_KEY',message:'Place search configuration needs attention. Please contact support.'};
 if(d.providerStatus===403)return {status:503,code:'ACCESS_DENIED',message:'The place search provider denied access. Please contact support.'};
 if(d.providerStatus===400)return {status:502,code:'PROVIDER_REQUEST_ERROR',message:'The place search provider could not process this request. Try another search.'};
 return {status:503,code:'PROVIDER_UNAVAILABLE',message:'Place search is temporarily unavailable. Please try again.'};
}
export class PlaceSearchService{
 constructor({fetchImpl=globalThis.fetch,apiKey=process.env.GOOGLE_PLACES_API_KEY}={}){this.fetch=fetchImpl;this.apiKey=apiKey;}
 async request(path,{body,mask,sessionToken}={}){
  const failure=(providerStatus,code,message)=>{
   const sanitize=value=>String(value||'').replaceAll(this.apiKey||'__missing_key__','[REDACTED]').replace(/AIza[\w-]+/g,'[REDACTED]').replace(/[\r\n]/g,' ').slice(0,700);
   return Object.assign(new Error('Place search is temporarily unavailable.'),{status:503,diagnostic:{providerStatus,code:sanitize(code),message:sanitize(message)}});
  };
  if(!this.apiKey)throw failure(null,'MISSING_API_KEY','GOOGLE_PLACES_API_KEY is not configured.');
  const url=endpoint+path+(sessionToken?'?sessionToken='+encodeURIComponent(sessionToken):'');
  let r;
  try{r=await this.fetch(url,{method:body?'POST':'GET',headers:{'content-type':'application/json','X-Goog-Api-Key':this.apiKey,...(mask?{'X-Goog-FieldMask':mask}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)});}
  catch(e){throw failure(null,['TimeoutError','AbortError'].includes(e.name)?'TIMEOUT':'NETWORK_ERROR','Could not reach Google Places.');}
  let result;
  try{result=await r.json();}catch{throw failure(r.status,'INVALID_RESPONSE','Google Places returned a non-JSON response.');}
  if(!r.ok)throw failure(r.status,result.error?.status||'PROVIDER_ERROR',result.error?.message||'Google Places rejected the request.');
  return result;
 }
 async autocomplete({query,destination,sessionToken}){const base=destinationBase(destination);const result=await this.request('/places:autocomplete',{body:{input:query,sessionToken,includeQueryPredictions:false,...(base?{locationBias:{circle:{center:base,radius:50000}}}:{})},mask:'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types'});return (result.suggestions||[]).map(s=>s.placePrediction).filter(p=>p&&!lodging(p.types||[])).map(p=>({id:p.placeId,name:p.structuredFormat?.mainText?.text||'Place',address:p.structuredFormat?.secondaryText?.text||'',categories:p.types||[]}));}
 async textSearch({query,destination}){const base=destinationBase(destination);const r=await this.request('/places:searchText',{body:{textQuery:query,pageSize:8,...(base?{locationBias:{circle:{center:base,radius:50000}}}:{})},mask:'places.id,places.displayName,places.formattedAddress,places.types'});return (r.places||[]).filter(p=>!lodging(p.types||[])).map(p=>({id:p.id,name:p.displayName?.text||'Place',address:p.formattedAddress||'',categories:p.types||[]}));}
 async details({id,destination,sessionToken}){const p=await this.request('/places/'+encodeURIComponent(id),{mask:fields,sessionToken});if(lodging(p.types||[]))throw Object.assign(new Error('Accommodation belongs in stay planning, not Activities.'),{status:422});
  const component=type=>p.addressComponents?.find(c=>c.types?.includes(type));const types=p.types||[],dining=types.some(t=>['restaurant','cafe','bakery','meal_takeaway'].includes(t));
  const place={id:p.id,placeId:p.id,providerPlaceId:p.id,provider:'google',source:'user_search',title:p.displayName?.text||'Place',name:p.displayName?.text||'Place',address:p.formattedAddress||'',location:p.formattedAddress||'',coordinates:p.location||null,city:component('locality')?.longText||'',region:component('administrative_area_level_1')?.longText||'',country:component('country')?.longText||'',countryCode:component('country')?.shortText||'',categories:types,types,rating:p.rating??null,ratingCount:p.userRatingCount??null,priceLevel:p.priceLevel??null,openingHours:p.regularOpeningHours?.weekdayDescriptions?.join(' · ')||null,website:p.websiteUri||null,googleMapsUri:p.googleMapsUri||null,imageUrl:p.photos?.length?'/api/activities/photo/'+encodeURIComponent(p.id):'',imageCredit:p.photos?.[0]?.authorAttributions?.map(a=>a.displayName).join(', ')||'',activityType:dining?'dining':'attraction',suggestedStayMin:dining?60:90,estimatedCost:null,costStatus:'No verified ticket or meal quote',businessStatus:p.businessStatus||null};
  return model.classify(destinationBase(destination),place);
 }
}
export async function hydrateSelected(selected,destination,service=new PlaceSearchService()){
 const result=[];for(const p of selected||[]){if(p.source!=='user_search'){result.push(p);continue;}try{result.push({...await service.details({id:p.providerPlaceId||p.placeId,destination}),sideTripConfirmed:Boolean(p.sideTripConfirmed)});}catch{result.push({...placeReference(p),tripType:'unknown',refreshError:true});}}return result;
}
