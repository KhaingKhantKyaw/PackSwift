import {readFileSync} from 'node:fs';
const cities=JSON.parse(readFileSync(new URL('../../public/data/destinations.json',import.meta.url)));
const cache=new Map(),pending=new Map();
const fail=(message,status=422)=>Object.assign(new Error(message),{status});
export function parameters(kind,input){
 if(!['flights','hotels'].includes(kind))throw fail('Unknown search type.');
 const {startDate,endDate}=input;
 const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 if(!valid(startDate)||!valid(endDate)||endDate<=startDate||startDate<new Date().toISOString().slice(0,10))throw fail('Choose valid future travel dates.');
 const adults=Number(input.adults),children=Number(input.children||0);
 if(!Number.isInteger(adults)||adults<1||adults>9||!Number.isInteger(children)||children<0||children>8)throw fail('Choose 1–9 adults and 0–8 children.');
 if(typeof input.destination!=='string'||!input.destination.trim()||input.destination.length>150)throw fail('Choose a destination.');
 const currency=String(input.currency||'USD');if(!/^[A-Z]{3}$/.test(currency))throw fail('Choose a valid currency.');
 const p={engine:kind==='flights'?'google_flights':'google_hotels',hl:'en',currency,adults,children};
 if(kind==='flights'){
  const code=name=>{const value=String(name||'').trim().toLowerCase();return cities.find(c=>[c.name,`${c.name}, ${c.country}`,c.code].some(v=>v.toLowerCase()===value))?.code;};
  const from=code(input.origin),to=code(input.destination);
  if(!from||!to||from===to)throw fail('Choose two different cities from the suggestions for flight search.');
  Object.assign(p,{departure_id:from,arrival_id:to,outbound_date:startDate,return_date:endDate,type:1});
  p.sort_by=/pocket|budget/i.test(input.travelStyle||'')?2:/comfort|luxury/i.test(input.travelStyle||'')?5:1;
 }else{
  Object.assign(p,{q:input.destination.trim()+' hotels',check_in_date:startDate,check_out_date:endDate});
  if(input.stayNear){if(typeof input.stayNear!=='string'||input.stayNear.length>250)throw fail('Enter a place of up to 250 characters.');p.q=`Hotels near ${input.stayNear.trim()} in ${input.destination.trim()}`;}
  if(/pocket|budget/i.test(input.travelStyle||''))p.sort_by=3;
  else if(/comfort|luxury|full/i.test(input.travelStyle||''))p.sort_by=8;
  if(children){const ages=input.childAges;if(!Array.isArray(ages)||ages.length!==children||ages.some(a=>!Number.isInteger(a)||a<1||a>17))throw fail('Enter each child’s age (use 1 for under one year) to search stays.');p.children_ages=ages.join(',');}
 }
 return p;
}
export function safeLink(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.searchParams.has('api_key')?u.href:null;}catch{return null;}}
export function normalize(kind,data,currency){
 const link=safeLink(data.search_metadata?.google_flights_url);
 const items=kind==='flights'?[...(data.best_flights||[]),...(data.other_flights||[])].slice(0,6).map(o=>({title:(o.flights||[]).map(f=>f.airline).filter(Boolean).join(' / '),detail:(o.flights||[]).map(f=>`${f.departure_airport?.id||''} ${f.departure_airport?.time||''} → ${f.arrival_airport?.id||''} ${f.arrival_airport?.time||''}`).join(' · '),price:Number.isFinite(o.price)?`${currency} ${o.price}`:'Price unavailable',priceLabel:'Reported round-trip fare · confirm passenger total and return flight',url:link})): (data.properties||[]).slice(0,6).map(o=>({title:o.name,detail:o.overall_rating?`Rating ${o.overall_rating}/5`:'',price:o.total_rate?.lowest||o.rate_per_night?.lowest||'Price unavailable',priceLabel:o.total_rate?.lowest?'Reported stay total · verify taxes and room occupancy':'Per night · verify taxes and room occupancy',url:safeLink(o.link)}));
 return {items,searchedAt:new Date().toISOString(),source:'Google Travel results via SerpApi'};
}
export async function searchBooking(kind,input,{fetcher=fetch,key=process.env.SERPAPI_API_KEY}={}){
 const p=parameters(kind,input);if(!key)throw fail('Search is not configured yet. Please use the external search links.',503);
 const id=JSON.stringify(p),hit=cache.get(id);if(hit&&hit.expires>Date.now())return {...hit.value,cached:true};
 if(pending.has(id))return pending.get(id);
 const task=(async()=>{const url=new URL('https://serpapi.com/search.json');Object.entries({...p,api_key:key}).forEach(([k,v])=>url.searchParams.set(k,v));
  let r,data;try{r=await fetcher(url,{signal:AbortSignal.timeout(25000)});data=await r.json();}catch{throw fail('Search timed out or is unavailable. Please try again.',502);}
  if(!r.ok||data.error)throw fail(r.status===429?'Search quota reached. Please use the external links.':'Provider search is unavailable. Please check configuration or try again later.',r.status===429?429:502);
  if(kind==='flights'&&[2,5].includes(p.sort_by)){const field=p.sort_by===2?'price':'total_duration';data.best_flights=[...(data.best_flights||[]),...(data.other_flights||[])].sort((a,b)=>(Number.isFinite(a[field])?a[field]:Infinity)-(Number.isFinite(b[field])?b[field]:Infinity));data.other_flights=[];}
  const value=normalize(kind,data,p.currency);if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(id,{value,expires:Date.now()+600000});return value;
 })();pending.set(id,task);try{return await task;}finally{pending.delete(id);}
}
