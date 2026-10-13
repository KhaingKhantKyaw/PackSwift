import {readFileSync} from 'node:fs';
import '../../public/js/activity-recommendation-model.js';
import '../../public/js/tripEngine.js';
import {isGooglePlacesConfigured,searchGooglePlacesPage} from './google-places-service.js';
const model=globalThis.PackSwiftActivities;
const catalog=JSON.parse(readFileSync(new URL('../../public/data/destinations.json',import.meta.url),'utf8'));
function distance(a,b){if(!a||!b||![a.latitude,a.longitude,b.latitude,b.longitude].every(Number.isFinite))return null;const rad=n=>n*Math.PI/180;return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(rad(b.latitude-a.latitude)/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(b.longitude-a.longitude)/2)**2)));}
export async function recommendActivities(input,dependencies={}){
 const demand=model.calculateActivityDemand(input),customInterests=model.parseInterests(input.notes),explicit=[...new Set(customInterests.flatMap(x=>x.categories))];
 const style=model.categories(input.tripPurpose==='leisure'?'beach nature':input.tripPurpose==='adventure'?'hiking nature':input.tripPurpose||'culture');
 const city=catalog.find(c=>[c.name,c.slug,c.code].some(s=>s?.toLowerCase()===input.destination.toLowerCase().split(',')[0].trim()));
 const anchor=city?{latitude:Number(city.latitude),longitude:Number(city.longitude)}:null;
 const search=dependencies.search||searchGooglePlacesPage,configured=dependencies.configured??isGooglePlacesConfigured();
 const pool=new Map(),notices=[],seenNames=new Set();
 function add(p,tier=0,curated=false){if(p.isSample||!(p.title||p.name))return;const km=distance(anchor,p.coordinates);if(!curated&&(km===null||km>400))return;
  const name=(p.title||p.name).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');if(seenNames.has(name))return;
  let categories=model.tags(p);
  // A beach-themed bar, hotel or company is not a coastal activity.
  if(!curated&&(!(p.types||[]).includes('beach')||/\b(hotel|resort|company|hall|office|club)\b|รีสอร์ท|โรงแรม/i.test(p.title||p.name||'')))categories=categories.filter(c=>c!=='beach');
  if(!curated&&!(p.types||[]).some(t=>['tourist_attraction','beach','museum','park','national_park','state_park','amusement_park','water_park','shopping_mall','market','restaurant','cafe','bar','historical_landmark','place_of_worship','buddhist_temple','hindu_temple','zoo','aquarium','hiking_area','scenic_spot','natural_feature','observation_deck'].includes(t)))return;
  const matches=customInterests.filter(x=>x.categories.some(t=>categories.includes(t)));
  const tripType=curated?(p.zone==='city'?'in_city':'overnight_option'):km<=25?'in_city':km<=60?'nearby':km<=180?'day_trip':'overnight_option';
  const normalized={...p,id:model.identity(p),placeId:p.placeId||p.providerPlaceId||p.id,title:p.title||p.name,categories,tripType,location:p.formattedAddress||p.address||p.cityName||input.destination,distanceFromDestination:km===null?null:Math.round(km),matchedInterests:matches.map(x=>x.original),matchedCategories:explicit.filter(t=>categories.includes(t)),source:curated?'Existing destination knowledge base':'Google Places',travelContext:tripType==='in_city'?'In destination area':km!==null?`Outside ${input.destination} · approx. ${Math.round(km)} km straight-line distance. Verify travel time and transport.`:`Regional option outside the city centre. Verify travel time; an overnight stay may be needed.`,suggestedStayMin:p.suggestedStayMin||(tripType==='day_trip'||tripType==='overnight_option'?480:null),dayWeight:tripType==='day_trip'||tripType==='overnight_option'?1:p.dayWeight,imageUrl:curated?'':p.hasPhoto===false?'':p.imageUrl||p.image||'',score:matches.length*100+categories.filter(t=>style.includes(t)).length*20+(Number(p.rating)||0)*2-tier*3-(km||0)/100};
  pool.set(model.identity(normalized),normalized);seenNames.add(name);
 }
 for(const p of globalThis.PackSwiftTripEngine.knowledge(input.destination))add(p,0,true);
 let requests=0,providerFailed=false;
 // Each request is one provider page, not a cap on recommendation inventory.
 async function fetchCategory(category,tier,pages=1){let pageToken;const tokens=new Set();for(let page=0;page<pages&&requests<32;page++){requests++;try{const result=await search({destination:input.destination,pace:input.pace,limit:20,itineraryDetails:true,pageToken,searchQuery:`${category.replaceAll('_',' ')} ${tier===0?'in':tier===1?'near':'day trips near'} ${input.destination}`});for(const p of result.activities||[])add(p,tier);pageToken=result.nextPageToken;if(!pageToken||tokens.has(pageToken))break;tokens.add(pageToken);}catch{providerFailed=true;break;}}}
 if(configured){
  // Explicit categories are searched before broad highlights, then checked for coverage.
  for(const category of explicit){await fetchCategory(category,0,2);for(let tier=1;tier<=2&&[...pool.values()].filter(p=>p.categories.includes(category)).length<3;tier++)await fetchCategory(category,tier,2);}
  const queries=[...new Set([...style,'culture','nature','market','shopping','food','theme_park','photography'])];
  for(const category of queries){if([...pool.values()].filter(p=>!p.matchedInterests.length).length+Math.min([...pool.values()].filter(p=>p.matchedInterests.length).length,Math.ceil(demand.recommendationTarget*.3))>=demand.recommendationTarget&&queries.indexOf(category)>=style.length+2)break;await fetchCategory(category,0,Math.max(1,Math.ceil(demand.recommendationTarget/queries.length/20)));}
 }
 const ranked=[...pool.values()].sort((a,b)=>b.score-a.score),reserved=[];
 // Reserve representation per explicit category before general ranking truncation.
 for(const c of explicit)for(const p of ranked.filter(p=>p.categories.includes(c)).slice(0,6))if(!reserved.includes(p))reserved.push(p);
 const customLimit=Math.max(reserved.length,Math.ceil(demand.recommendationTarget*.3));
 const otherMatches=ranked.filter(p=>!reserved.includes(p)&&p.matchedInterests.length).slice(0,Math.max(0,customLimit-reserved.length));
 const ordered=[...reserved,...otherMatches,...ranked.filter(p=>!p.matchedInterests.length)];
 const activities=ordered.slice(0,Math.max(demand.recommendationTarget,reserved.length));
 const coverage=customInterests.map(x=>({...x,count:activities.filter(p=>x.categories.some(t=>p.categories.includes(t))).length}));
 if(!configured)notices.push('Live place search is unavailable. Showing existing destination knowledge only.');
 if(providerFailed)notices.push('Some provider searches failed. Retry to expand the results.');
 if(!anchor)notices.push('Destination coordinates are unavailable; unverified geographic results were not included.');
 if(activities.length<demand.recommendationTarget)notices.push(`Found ${activities.length} supported options toward a target of ${demand.recommendationTarget}. We have not invented places to fill the gap.`);
 for(const c of coverage)if(c.count<3)notices.push(`${c.original}: ${c.count} supported options found after available city and regional coverage checks.`);
 return {activities,demand,customInterests,coverage,notices,partial:activities.length<demand.recommendationTarget,requests};
}
