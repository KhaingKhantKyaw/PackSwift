import { routeLocation } from './travel-planner.js';
const cache=new Map();
export function forecastForDates(payload,start,end){
 const daily=(payload.daily?.time||[]).map((date,index)=>({date,lowC:payload.daily.temperature_2m_min?.[index]??null,highC:payload.daily.temperature_2m_max?.[index]??null,rainProbability:payload.daily.precipitation_probability_max?.[index]??null})).filter(d=>d.date>=start&&d.date<=end);
 const totalDays=Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
 return {daily,totalDays,coveredDays:daily.length,status:daily.length===totalDays?'available':daily.length?'partial':'outside-horizon'};
}
export async function getTripForecast({destination,startDate,endDate},{fetcher=fetch,now=new Date(),key=process.env.OPEN_METEO_API_KEY,production=process.env.NODE_ENV==='production'}={}){
 const valid=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 if(!valid(startDate)||!valid(endDate)||endDate<startDate||Date.parse(endDate)-Date.parse(startDate)>90*86400000)throw Object.assign(new Error('Choose valid trip dates.'),{status:422});
 const place=routeLocation(destination),base={daily:[],coveredDays:0,totalDays:Math.round((Date.parse(endDate)-Date.parse(startDate))/86400000)+1,source:'Open-Meteo',sourceUrl:'https://open-meteo.com/',checkedAt:now.toISOString()};
 if(!place||![place.latitude,place.longitude].every(Number.isFinite))return {...base,status:'unavailable'};
 if(Date.parse(startDate)>now.getTime()+16*86400000||Date.parse(endDate)<now.getTime()-86400000)return {...base,status:'outside-horizon'};
 if(production&&!key)return {...base,status:'not-configured'};
 const id=JSON.stringify([place.slug,startDate,endDate,Boolean(key)]),hit=cache.get(id);if(hit&&hit.expires>now.getTime())return hit.value;
 try{
  const url=new URL(key?'https://customer-api.open-meteo.com/v1/forecast':'https://api.open-meteo.com/v1/forecast');
  for(const [name,value]of Object.entries({latitude:place.latitude,longitude:place.longitude,daily:'temperature_2m_min,temperature_2m_max,precipitation_probability_max',timezone:'auto',forecast_days:16,...(key?{apikey:key}:{})}))url.searchParams.set(name,String(value));
  const response=await fetcher(url,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error();const payload=await response.json();
  if(!Array.isArray(payload.daily?.time))throw Error();const value={...base,...forecastForDates(payload,startDate,endDate),location:[place.name,place.country].join(', ')};
  if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(id,{value,expires:now.getTime()+30*60000});return value;
 }catch{return {...base,status:'unavailable'};}
}
