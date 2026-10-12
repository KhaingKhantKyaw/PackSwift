/* Shared identity, persistence and location-aware planning. Provider content stays transient. */
globalThis.PackSwiftPlaceSearchModel=(()=>{
 const identity=p=>String(p.providerPlaceId||p.placeId||p.id||'');
 const persist=p=>p.source==='user_search'?{id:identity(p),placeId:identity(p),providerPlaceId:identity(p),provider:'google',source:'user_search',title:'Saved place',needsRefresh:true,sideTripConfirmed:Boolean(p.sideTripConfirmed)}:p;
 function distance(a,b){if(!a||!b||![a.latitude,a.longitude,b.latitude,b.longitude].every(Number.isFinite))return null;const rad=n=>n*Math.PI/180;return 12742*Math.asin(Math.min(1,Math.sqrt(Math.sin(rad(b.latitude-a.latitude)/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(b.longitude-a.longitude)/2)**2)));}
 function classify(base,p){const km=distance(base,p.coordinates);return {...p,distanceFromDestination:km===null?null:Math.round(km),tripType:km===null?'unknown':km<=25?'in_city':km<=60?'nearby':km<=250?'day_trip':'long_distance',travelContext:km===null?'Travel distance unavailable; verify transport before scheduling.':`Approx. ${Math.round(km)} km straight-line distance, not route distance. Travel time and fares need confirmation.`};}
 function schedule(selected,days,preferences={}){
  // Compatibility projection only: assignment belongs exclusively to the canonical model.
  const plan=globalThis.PackSwiftCanonical.reconcile(selected,null,days,preferences),byId=new Map(plan.selectedPlaces.map(p=>[identity(p),p]));
  const result=Array.from({length:days},(_,i)=>({day:i+1,title:`Day ${i+1}`,activities:[]})),unscheduled=[];
  for(const item of plan.items){const p=byId.get(item.selectedPlaceId);if(item.day===null){unscheduled.push({...p,reason:'Assign a day after checking time and transport.'});continue;}
   result[item.day-1].activities.push({...p,planningTime:item.startTime||'Flexible time',planningBlocks:['day_trip','overnight_option'].includes(p.tripType)?['Outbound transfer · confirm route and duration',p.title||p.name,'Meal / rest break','Return transfer · confirm last departure']:[]});
  }
  return {days:result,unscheduled,unpricedTransfers:selected.filter(p=>['nearby','day_trip','overnight_option','long_distance','unknown'].includes(p.tripType)).length};
 }
 return {identity,persist,distance,classify,schedule};
})();
