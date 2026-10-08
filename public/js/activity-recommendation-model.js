/* Pure shared discovery logic. No fares or attractions are generated here. */
globalThis.PackSwiftActivities=(()=>{
 const vocabulary={beach:['beach','beaches','sea','coast','coastal','seaside','island'],hiking:['hiking','hike','trekking'],mountain:['mountain','mountains'],nature:['nature','park','waterfall','waterfalls','garden','gardens'],theme_park:['theme park','theme parks','rides','amusement','amusement park','water park','water parks'],market:['market','markets','night market','night markets','street market'],nightlife:['nightlife','night market','night markets'],food:['food','local food','street food','night market','night markets','restaurant'],cafe:['cafe','cafes','coffee'],culture:['culture','temple','temples','heritage','museum','museums','historic','history'],shopping:['shopping','mall','malls'],photography:['photography','viewpoint','scenic']};
 const normalize=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_-]/g,' ');
 function categories(text){const s=normalize(text);return Object.keys(vocabulary).filter(k=>vocabulary[k].some(w=>new RegExp('(?:^|\\W)'+w+'(?:$|\\W)').test(s)));}
 function parseInterests(text){return String(text||'').split(/[,;\n]|\band\b/i).map(s=>s.trim()).filter(Boolean).map(original=>({original,categories:categories(original)})).filter(x=>x.categories.length);}
 function calculateActivityDemand({startDate,endDate,pace='balanced',arrivalDepartureAllowance}){
  const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(Date.parse(s+'T00:00:00Z'));
  if(!valid(startDate)||!valid(endDate))throw new RangeError('Choose valid travel dates.');
  const tripDays=Math.round((Date.parse(endDate+'T00:00:00Z')-Date.parse(startDate+'T00:00:00Z'))/86400000)+1;
  if(tripDays<1||tripDays>91)throw new RangeError('Choose a trip of up to 90 nights.');
  const allowance=Number.isFinite(arrivalDepartureAllowance)?Math.max(0,Math.min(tripDays-1,arrivalDepartureAllowance)):tripDays>4?2:tripDays>1?1:0;
  const usableDays=Math.max(1,tripDays-allowance),targetPerDay={relaxed:2,balanced:3,packed:4}[pace]||3,requiredSlots=usableDays*targetPerDay;
  return {tripDays,usableDays,targetPerDay,requiredSlots,recommendationTarget:Math.ceil(requiredSlots*1.25)};
 }
 const identity=p=>String(p.providerPlaceId||p.placeId||p.id||normalize(p.title||p.name));
 function tags(p){return [...new Set([...(p.categories||[]),...(p.tags||[]),...categories([p.title||p.name,p.category,...(p.types||[])].join(' '))])];}
 const headings={beach:'Beach & Coastal Escapes',theme_park:'Theme Parks & Entertainment',market:'Markets & Local Life',hiking:'Nature & Hiking',mountain:'Mountains & Nature',nature:'Nature & Gardens',culture:'Culture & Heritage',shopping:'Shopping Experiences',food:'Food & Local Life',cafe:'Cafes',nightlife:'Evening Experiences',photography:'Scenic & Photography'};
 function similarity(a,b){const shared=tags(a).filter(t=>tags(b).includes(t)).length;return shared*10+(a.vibes||[]).filter(t=>(b.vibes||[]).includes(t)).length*6+(a.tripType===b.tripType?2:0)+(a.priceLevel&&a.priceLevel===b.priceLevel?1:0)+(Math.abs((a.suggestedStayMin||0)-(b.suggestedStayMin||0))<60?1:0);}
 function groupActivities(places){const groups=new Map();for(const p of places){const category=p.matchedCategories?.[0]||['theme_park','beach','market','hiking','mountain','culture','shopping','cafe','food','nature','photography'].find(t=>tags(p).includes(t))||'highlights';const key=(p.matchedInterests?.length?'matched:':'')+category;if(!groups.has(key))groups.set(key,{id:key,title:headings[category]||'Destination Highlights',matched:Boolean(p.matchedInterests?.length),places:[]});groups.get(key).places.push(p);}
  return [...groups.values()].sort((a,b)=>Number(b.matched)-Number(a.matched)).map(g=>{const pool=[...g.places],paired=[];while(pool.length){const a=pool.shift();paired.push(a);if(pool.length){pool.sort((b,c)=>similarity(a,c)-similarity(a,b));paired.push(pool.shift());}}return {...g,places:paired};});
 }
 return {parseInterests,categories,tags,identity,calculateActivityDemand,groupActivities,similarity};
})();
