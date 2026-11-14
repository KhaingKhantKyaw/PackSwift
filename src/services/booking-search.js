import cities from './search-destinations.js';
import {bookingCurrency} from './destination-currency.js';
import {bookingExchangeRate} from './booking-exchange-rate.js';
const cache=new Map(),pending=new Map();
const fail=(message,status=422)=>Object.assign(new Error(message),{status});
const locationLabel=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s*,\s*/g,',').replace(/\s+/g,' ');
function airportCode(label){
 const value=locationLabel(label);
 return cities.find(city=>[city.code,city.name,city.name+','+city.country,city.code+','+city.country].some(entry=>locationLabel(entry)===value))?.code;
}
function providerError(status){
 if(status===401||status===403)return fail('The booking provider has not authorized this connection. Use the external search link for now.',503);
 if(status===429)return fail('The booking provider has reached its search limit. Use the external search link or try later.',429);
 if(status===400||status===422)return fail('The booking provider could not search this route or dates. Review the trip details or use the external search link.',422);
 return fail('The booking provider is temporarily unavailable. Try again or use the external search link.',502);
}
export function parameters(kind,input){
 if(!['flights','hotels'].includes(kind))throw fail('Unknown search type.');
 const {startDate,endDate}=input;
 const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 if(!valid(startDate)||!valid(endDate)||endDate<=startDate||startDate<new Date().toISOString().slice(0,10))throw fail('Choose valid future travel dates.');
 const adults=Number(input.adults),children=Number(input.children||0);
 if(!Number.isInteger(adults)||adults<1||adults>9||!Number.isInteger(children)||children<0||children>8)throw fail('Choose 1–9 adults and 0–8 children.');
 if(typeof input.destination!=='string'||!input.destination.trim()||input.destination.length>150)throw fail('Choose a destination.');
 if(typeof input.origin!=='string'||input.origin.length>150||!bookingCurrency(input.origin).known)throw fail('Choose a recognized origin city or country to set your search currency.');
 const currency=bookingCurrency(input.origin).providerCode;
 const p={engine:kind==='flights'?'google_flights':'google_hotels',hl:'en',currency,adults,children};
 if(kind==='flights'){
  const from=airportCode(input.origin),to=airportCode(input.destination);
  if(!from||!to||from===to)throw fail('Choose two different cities from the suggestions for flight search.');
  Object.assign(p,{departure_id:from,arrival_id:to,outbound_date:startDate,return_date:endDate,type:1});
  p.sort_by=/pocket|budget/i.test(input.travelStyle||'')?2:/comfort|luxury/i.test(input.travelStyle||'')?5:1;
 }else{
  Object.assign(p,{q:input.destination.trim()+' hotels',check_in_date:startDate,check_out_date:endDate});
  if(input.stayNear){if(typeof input.stayNear!=='string'||input.stayNear.length>250)throw fail('Enter a place of up to 250 characters.');p.q=`Hotels near ${input.stayNear.trim()} in ${input.destination.trim()}`;}
  if(/pocket|budget/i.test(input.travelStyle||''))p.sort_by=3;
  else if(/comfort|luxury|full/i.test(input.travelStyle||''))p.sort_by=8;
  // The provider represents children under one as age 1; retain actual ages in the draft.
  if(children){const ages=input.childAges;if(!Array.isArray(ages)||ages.length!==children||ages.some(a=>!Number.isInteger(a)||a<0||a>17))throw fail('Choose each child’s age in Travelers to search stays.');p.children_ages=ages.map(age=>Math.max(1,age)).join(',');}
 }
 return p;
}
export function safeLink(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.searchParams.has('api_key')?u.href:null;}catch{return null;}}
function money(amount,currency){return currency+' '+new Intl.NumberFormat('en',{minimumFractionDigits:0,maximumFractionDigits:2}).format(amount);}
function hotelPrice(rate,currency){
 if(!rate)return null;
 const raw=rate.lowest||rate.display_price||'',explicit=String(raw).match(/\b([A-Z]{3})\b/);
 if(explicit&&explicit[1]!==currency)return {amount:null,price:'Price unavailable — provider currency differs'};
 let amount=rate.extracted_lowest??rate.extracted_display_price;
 // Only parse the unambiguous ISO-prefixed fallback; never infer exchange rates from symbols.
 if(!Number.isFinite(amount)&&String(raw).startsWith(currency+' ')){
  const number=String(raw).slice(4).trim();if(/^\d+(?:,\d{3})*(?:\.\d+)?$/.test(number))amount=Number(number.replaceAll(',',''));
 }
 if(Number.isFinite(amount)&&amount>=0)return {amount,price:money(amount,currency)};
 // An unparsed symbol-only price cannot safely be converted or re-labelled.
 return raw?{amount:null,price:'Price unavailable'}:null;
}
export function normalize(kind,data,currency){
 if(data.search_parameters?.currency&&data.search_parameters.currency!==currency)throw fail('The provider returned a different currency. Please search again.',502);
 let link=safeLink(data.search_metadata?.google_flights_url)||safeLink(data.google_flights_url);
 if(link){const url=new URL(link);if(/(^|\.)google\.[a-z.]+$/.test(url.hostname)){url.searchParams.set('curr',currency);link=url.href;}}
 const items=kind==='flights'?[...(data.best_flights||[]),...(data.other_flights||[])].slice(0,6).map(o=>({title:(o.flights||[]).map(f=>f.airline).filter(Boolean).join(' / '),detail:(o.flights||[]).map(f=>`${f.departure_airport?.id||''} ${f.departure_airport?.time||''} → ${f.arrival_airport?.id||''} ${f.arrival_airport?.time||''}`).join(' · '),amount:Number.isFinite(o.price)&&o.price>=0?o.price:null,price:Number.isFinite(o.price)&&o.price>=0?money(o.price,currency):'Price unavailable',currency,priceLabel:'Reported round-trip fare · confirm passenger total and return flight',url:safeLink(o.booking_url)||link,linkLabel:safeLink(o.booking_url)?'View booking options ↗':'Compare this route on Google Flights ↗'})):(data.properties||[]).slice(0,6).map(o=>{
  const total=hotelPrice(o.total_rate,currency),quote=total||hotelPrice(o.rate_per_night,currency);
  return {title:o.name,detail:o.overall_rating?`Rating ${o.overall_rating}/5`:'',amount:quote?.amount??null,price:quote?.price||'Price unavailable',currency,priceLabel:total?'Reported stay total · verify taxes and room occupancy':'Per night · verify taxes and room occupancy',url:safeLink(o.link),linkLabel:'View stay & booking options ↗'};
 });
 return {items,currency,searchedAt:new Date().toISOString(),source:'Google Travel results via SerpApi'};
}
export async function searchBooking(kind,input,{fetcher=fetch,key=process.env.SERPAPI_API_KEY,rateProvider=bookingExchangeRate}={}){
 const p=parameters(kind,input);key=typeof key==='string'?key.trim():'';if(!key)throw fail('Live booking search is not configured on this site. Please use the external search links.',503);
 const originCurrency=bookingCurrency(input.origin);
 const id=JSON.stringify([p,originCurrency.code]),hit=cache.get(id);if(hit&&hit.expires>Date.now())return {...hit.value,cached:true};
 if(pending.has(id))return pending.get(id);
 const task=(async()=>{const url=new URL('https://serpapi.com/search.json');Object.entries({...p,api_key:key}).forEach(([k,v])=>url.searchParams.set(k,v));
  let r,data;
  const signal=AbortSignal.timeout(45000);
  try{r=await fetcher(url,{signal});}catch{throw fail(signal.aborted?'The provider took too long. Search again or use the external search link.':'Could not reach the booking provider. Try again or use the external search link.',signal.aborted?504:502);}
  if(!r.ok)throw providerError(r.status);
  try{data=await r.json();}catch{throw fail('The provider did not return booking results. Please try again.',502);}
  if(!data||typeof data!=='object'||Array.isArray(data))throw providerError(502);
  // Successful searches can include a top-level error describing empty results.
  // Queued/failed or unrecognized responses are not proof of no availability.
  const status=data.search_metadata?.status, groups=kind==='flights'?['best_flights','other_flights']:['properties'];
  if(status&&status!=='Success'||data.error&&status!=='Success'||!status&&!groups.some(name=>Array.isArray(data[name])))throw providerError(502);
  if(groups.some(name=>data[name]!=null&&!Array.isArray(data[name])))throw providerError(502);
  for(const name of groups)if(Array.isArray(data[name]))data[name]=data[name].filter(item=>item&&typeof item==='object'&&(kind!=='flights'||item.flights==null||Array.isArray(item.flights)));
  if(kind==='flights'&&[2,5].includes(p.sort_by)){const field=p.sort_by===2?'price':'total_duration';data.best_flights=[...(data.best_flights||[]),...(data.other_flights||[])].sort((a,b)=>(Number.isFinite(a[field])?a[field]:Infinity)-(Number.isFinite(b[field])?b[field]:Infinity));data.other_flights=[];}
  const value=normalize(kind,data,p.currency);value.originCurrency=originCurrency.code;
  if(originCurrency.needsConversion&&value.items.some(item=>item.amount!==null)){
   try{
    const conversion=await rateProvider(originCurrency.code);
    if(conversion.base!==p.currency||conversion.target!==originCurrency.code||!Number.isFinite(conversion.rate)||conversion.rate<=0||!Number.isFinite(Date.parse(conversion.updatedAt))||Date.now()-Date.parse(conversion.updatedAt)>172800000||Date.parse(conversion.updatedAt)>Date.now()+300000)throw Error('Unavailable rate');
    if(value.items.some(item=>item.amount!==null&&!Number.isFinite(item.amount*conversion.rate*100)))throw Error('Invalid converted amount');
    value.conversion={base:conversion.base,target:conversion.target,updatedAt:conversion.updatedAt,source:'ExchangeRate-API',sourceUrl:'https://www.exchangerate-api.com'};
    value.currency=originCurrency.code;
    value.items=value.items.map(item=>item.amount===null?item:{...item,originalPrice:item.price,originalCurrency:p.currency,price:'≈ '+money(item.amount*conversion.rate,originCurrency.code),amount:Math.round(item.amount*conversion.rate*100)/100,currency:originCurrency.code,estimated:true});
   }catch{value.currencyNotice=`${originCurrency.code} conversion is unavailable. Showing original ${p.currency} quotes.`;}
  }else if(originCurrency.needsConversion){value.currencyNotice=`${originCurrency.code} estimates need a numeric quote. Provider prices are in ${p.currency}.`;}
  if(cache.size>=100)cache.delete(cache.keys().next().value);const expires=Math.min(Date.now()+(value.currencyNotice?60000:600000),value.conversion?Date.parse(value.conversion.updatedAt)+172800000:Infinity);cache.set(id,{value,expires});return value;
 })();pending.set(id,task);try{return await task;}finally{pending.delete(id);}
}
