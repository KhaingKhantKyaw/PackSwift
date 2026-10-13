/* Shared identity, persistence and location-aware planning. Provider content stays transient. */
globalThis.PackSwiftPlaceSearchModel=(()=>{
 const identity=p=>String(p.providerPlaceId||p.placeId||p.id||'');
 const persist=p=>p.source==='user_search'?{id:identity(p),placeId:identity(p),providerPlaceId:identity(p),provider:'google',source:'user_search',title:'Saved place',needsRefresh:true,sideTripConfirmed:Boolean(p.sideTripConfirmed)}:p;
 function distance(a,b){if(!a||!b||![a.latitude,a.longitude,b.latitude,b.longitude].every(Number.isFinite))return null;const rad=n=>n*Math.PI/180;return 12742*Math.asin(Math.min(1,Math.sqrt(Math.sin(rad(b.latitude-a.latitude)/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(b.longitude-a.longitude)/2)**2)));}
 function classify(base,p){const km=distance(base,p.coordinates);return {...p,distanceFromDestination:km===null?null:Math.round(km),tripType:km===null?'unknown':km<=25?'in_city':km<=60?'nearby':km<=250?'day_trip':'long_distance',travelContext:km===null?'Travel distance unavailable; verify transport before scheduling.':`Approx. ${Math.round(km)} km straight-line distance, not route distance. Travel time and fares need confirmation.`};}
 function schedule(selected,days,preferences={}){
  const result=Array.from({length:days},(_,i)=>({day:i+1,title:`Day ${i+1}`,activities:[],load:0})),unscheduled=[];
  const prefs=new Map((preferences.activityPreferences||[]).map(p=>[p.activityId,p]));
  const cap={relaxed:2,balanced:3,packed:4}[preferences.tripPace]||3;
  const sorted=[...selected].sort((a,b)=>{const score=p=>{const f=prefs.get(identity(p))||{};return (f.preferredDay?10:0)+({must_visit:3,would_like:2,optional:1}[f.priority]||2);};return score(b)-score(a);});
  for(const p of sorted){const f=prefs.get(identity(p))||{},long=['day_trip','overnight_option','long_distance'].includes(p.tripType),weight=long?1:1/cap;
   if(p.needsRefresh||p.tripType==='unknown'){unscheduled.push({...p,reason:'Refresh place details and verify travel before scheduling.'});continue;}
   if(p.tripType==='long_distance'){unscheduled.push({...p,reason:'Long-distance side trip: arrange transport and dates before fitting this into your main itinerary.'});continue;}
   const candidates=f.preferredDay?[result[f.preferredDay-1]].filter(Boolean):[...result.slice(days>2?1:0,days>2?-1:undefined),...result.filter(d=>d.day===1||d.day===days)];
   const day=candidates.find(d=>d.load+weight<=1.001);if(!day){unscheduled.push({...p,reason:f.preferredDay?'Preferred day has insufficient room. Change the day or remove another activity.':'No available activity slots.'});continue;}
   const period=f.preferredTimePeriod==='specific'?f.specificTime:f.preferredTimePeriod!=='any'?f.preferredTimePeriod:p.activityType==='dining'?'Meal stop · lunch or dinner':'Flexible time';
   day.activities.push({...p,preferredDay:f.preferredDay||null,priority:f.priority||'would_like',planningTime:period||'Flexible time',planningBlocks:long?['Outbound transfer · confirm route and duration',p.title||p.name,'Meal / rest break','Return transfer · confirm last departure']:[]});day.load+=weight;
   if(long)day.title='Day trip · '+(p.title||p.name);
  }
  return {days:result,unscheduled,unpricedTransfers:selected.filter(p=>['nearby','day_trip','overnight_option','long_distance','unknown'].includes(p.tripType)).length};
 }
 return {identity,persist,distance,classify,schedule};
})();
