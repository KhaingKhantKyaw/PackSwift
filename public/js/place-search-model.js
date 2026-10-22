/* Shared identity, persistence and location-aware planning. Provider content stays transient. */
globalThis.PackSwiftPlaceSearchModel=(()=>{
 const identity=p=>String(p.providerPlaceId||p.placeId||p.id||'');
 const persist=p=>p.source==='user_search'?{id:identity(p),placeId:identity(p),providerPlaceId:identity(p),provider:'google',source:'user_search',title:'Saved place',needsRefresh:true,sideTripConfirmed:Boolean(p.sideTripConfirmed)}:p;
 function distance(a,b){if(!a||!b||![a.latitude,a.longitude,b.latitude,b.longitude].every(Number.isFinite))return null;const rad=n=>n*Math.PI/180;return 12742*Math.asin(Math.min(1,Math.sqrt(Math.sin(rad(b.latitude-a.latitude)/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(b.longitude-a.longitude)/2)**2)));}
 function classify(base,p){const km=distance(base,p.coordinates);return {...p,distanceFromDestination:km===null?null:Math.round(km),tripType:km===null?'unknown':km<=25?'in_city':km<=60?'nearby':km<=250?'day_trip':'long_distance',travelContext:km===null?'Travel distance unavailable; verify transport before scheduling.':`Approx. ${Math.round(km)} km straight-line distance, not route distance. Travel time and fares need confirmation.`};}
 function schedule(selected,days,preferences={}){
  const result=Array.from({length:days},(_,i)=>({day:i+1,title:`Day ${i+1}`,activities:[],load:0})),unscheduled=[];
  const prefs=new Map((preferences.activityPreferences||[]).map(p=>[p.activityId,p]));
  const cap={'Pocket Friendly':3,'Balanced':3,'Comfort & Value':2,'Full Experience':4,'Ultimate Luxury':1}[preferences.travelStyle]||{relaxed:2,balanced:3,packed:4}[preferences.tripPace]||3;
  const arrival=/^\d{2}:\d{2}$/.test(preferences.arrivalTime||'')?Number(preferences.arrivalTime.slice(0,2))*60+Number(preferences.arrivalTime.slice(3)):null;
  if(arrival!==null)result[0].load=Math.max(0,1-Math.min(cap,Math.max(0,Math.floor((1200-arrival-210)/150)))/cap);
  const score=p=>{const f=prefs.get(identity(p))||{};return (f.preferredDay?10:0)+({must_visit:3,would_like:2,optional:1}[f.priority]||2);};
  const remaining=[...selected].sort((a,b)=>score(b)-score(a)),sorted=[];
  // Nearest-neighbour clustering is a geographic heuristic, not a travel-time estimate.
  while(remaining.length){let index=0;const last=sorted.at(-1);if(last&&!prefs.get(identity(remaining[0]))?.preferredDay){let best=Infinity;remaining.forEach((p,i)=>{if(score(p)!==score(remaining[0]))return;const km=distance(last.coordinates,p.coordinates);if(km!==null&&km<best){best=km;index=i;}});}sorted.push(remaining.splice(index,1)[0]);}
  for(const p of sorted){const f=prefs.get(identity(p))||{},long=['day_trip','overnight_option','long_distance'].includes(p.tripType),weight=long?1:1/cap;
   if(p.needsRefresh||p.tripType==='unknown'){unscheduled.push({...p,reason:'Refresh place details and verify travel before scheduling.'});continue;}
   if(p.tripType==='long_distance'){unscheduled.push({...p,reason:'Long-distance side trip: arrange transport and dates before fitting this into your main itinerary.'});continue;}
   const candidates=f.preferredDay?[result[f.preferredDay-1]].filter(Boolean):[...result.slice(days>2?1:0,days>2?-1:undefined),...result.filter(d=>d.day===1||d.day===days)];
   const nearby=d=>d.activities.every(a=>{const km=distance(a.coordinates,p.coordinates);return km===null||km<=15;});
   const available=candidates.filter(d=>d.load+weight<=1.001&&(f.preferredDay||nearby(d)));
   if(!f.preferredDay)available.sort((a,b)=>{const cost=d=>d.activities.length?Math.min(...d.activities.map(x=>distance(x.coordinates,p.coordinates)??100)):20;return cost(a)-cost(b);});
   const day=available[0];if(!day){unscheduled.push({...p,reason:f.preferredDay?'Preferred day has insufficient room. Change the day or remove another activity.':'No suitable nearby day has room. Keep this place for another day or extend the trip.'});continue;}
   const period=f.preferredTimePeriod==='specific'?f.specificTime:f.preferredTimePeriod!=='any'?f.preferredTimePeriod:p.activityType==='dining'?'Meal stop · lunch or dinner':'Flexible time';
   day.activities.push({...p,preferredDay:f.preferredDay||null,priority:f.priority||'would_like',planningTime:period||'Flexible time',planningBlocks:long?['Outbound transfer · confirm route and duration',p.title||p.name,'Meal / rest break','Return transfer · confirm last departure']:[]});day.load+=weight;
   if(long)day.title='Day trip · '+(p.title||p.name);
  }
  return {days:result,unscheduled,unpricedTransfers:selected.filter(p=>['nearby','day_trip','overnight_option','long_distance','unknown'].includes(p.tripType)).length};
 }
 return {identity,persist,distance,classify,schedule};
})();
