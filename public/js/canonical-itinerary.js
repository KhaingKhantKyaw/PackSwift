/* One versioned itinerary contract shared by the browser and server. */
globalThis.PackSwiftCanonical=(()=>{
 const paceCaps=Object.freeze({relaxed:2,balanced:3,packed:4});
 const identity=p=>String(p.providerPlaceId||p.placeId||p.place_id||p.id||'');
 function places(input=[]){
  if(!Array.isArray(input)||input.length>500)throw new RangeError('Invalid selected places.');
  const unique=new Map();
  for(const p of input){if(!p||typeof p!=='object')throw new RangeError('Invalid place.');const id=identity(p);if(!id||id.length>300)throw new RangeError('Every selected place needs an ID.');
   if(!unique.has(id))unique.set(id,{...p,id,source:['custom','user_search'].includes(p.source)?p.source:'recommendation'});
  }return [...unique.values()];
 }
 const minutes=value=>/^\d{2}:\d{2}$/.test(value||'')?Number(value.slice(0,2))*60+Number(value.slice(3)):null;
 function proposedTime(place,items,day,preferences,choice,startDate){
  const duration=Number(place.suggestedStayMin)>0?Math.min(720,Number(place.suggestedStayMin)):90;
  let start=minutes(preferences.preferredDayStart)??540,end=minutes(preferences.preferredDayEnd)??1260;
  if(startDate){const date=new Date(Date.parse(startDate+'T00:00:00Z')+(day-1)*86400000).toISOString().slice(0,10);if(preferences.arrivalAt){if(date<preferences.arrivalAt.slice(0,10))end=0;else if(date===preferences.arrivalAt.slice(0,10))start=Math.max(start,minutes(preferences.arrivalAt.slice(11,16))??start);}if(preferences.departureAt){if(date>preferences.departureAt.slice(0,10))end=0;else if(date===preferences.departureAt.slice(0,10))end=Math.min(end,minutes(preferences.departureAt.slice(11,16))??end);}}
  const period=choice.preferredTimePeriod;if(period==='morning')end=Math.min(end,720);if(period==='afternoon'){start=Math.max(start,720);end=Math.min(end,1020);}if(period==='evening')start=Math.max(start,1020);
  for(const item of items.filter(i=>i.day===day)){const time=minutes(item.startTime);if(time!==null)start=Math.max(start,time+(item.durationMin||90)+30);}
  const explicit=period==='specific'?minutes(choice.specificTime):null;if(explicit!==null)start=explicit;
  let windows=[[0,1440]],reported=false;
  if(Array.isArray(place.openingPeriods)&&place.openingPeriods.length&&startDate){
   const weekday=new Date(Date.parse(startDate+'T00:00:00Z')+(day-1)*86400000).getUTCDay();reported=true;
   windows=place.openingPeriods.filter(p=>p.open?.day===weekday||!p.close).map(p=>[p.close?(p.open.hour||0)*60+(p.open.minute||0):0,!p.close||p.close.day!==p.open.day?1440:(p.close.hour||0)*60+(p.close.minute||0)]);
  }
  const window=windows.find(([open,close])=>Math.max(start,open)+duration<=Math.min(end,close)&&(explicit===null||explicit>=open));
  if(!window)return {startTime:choice.specificTime||'',durationMin:duration,timeStatus:'CONFLICT',scheduleNote:'No suitable time in your day / reported hours. Assign manually after checking the venue.'};
  start=Math.max(start,window[0]);return {startTime:String(Math.floor(start/60)).padStart(2,'0')+':'+String(start%60).padStart(2,'0'),durationMin:duration,timeStatus:'TENTATIVE',scheduleNote:reported?'Based on provider-reported weekly hours; confirm your travel date.':'Opening hours unknown. Suggested time only; verify with venue.'};
 }
 function reconcile(selected,previous,days,preferences={},startDate=previous?.startDate){
  if(!Number.isInteger(days)||days<1||days>91)throw new RangeError('Choose valid trip dates.');
  const selectedPlaces=places(selected),known=new Map(selectedPlaces.map(p=>[p.id,p]));
  const items=(previous?.items||[]).filter(i=>known.has(i.selectedPlaceId)).map(i=>({...i}));
  const signature=JSON.stringify([preferences,startDate]),changed=previous?.preferenceSignature!==undefined&&previous.preferenceSignature!==signature;
  if(changed)for(let j=items.length-1;j>=0;j--)if(!items[j].userModified)items.splice(j,1);
  const used=new Set(items.map(i=>i.selectedPlaceId)),cap=paceCaps[preferences.tripPace]||3;
  const weight=p=>['day_trip','overnight_option'].includes(p.tripType)?cap:1;
  for(const p of selectedPlaces){if(used.has(p.id))continue;
   const f=preferences.activityPreferences?.find(f=>f.activityId===p.id)||{};
   const candidates=f.preferredDay?[f.preferredDay]:Array.from({length:days},(_,i)=>i+1).sort((a,b)=>Number(a===1||a===days)-Number(b===1||b===days));
   let day=p.tripType==='long_distance'||preferences.planningMode==='manual'&&!f.preferredDay?null:candidates.find(d=>d>=1&&d<=days&&items.filter(i=>i.day===d).reduce((n,i)=>n+weight(known.get(i.selectedPlaceId)),0)+weight(p)<=cap)||null;
   const timing=day===null?{startTime:f.specificTime||'',timeStatus:'UNASSIGNED'}:proposedTime(p,items,day,preferences,f,startDate);if(timing.timeStatus==='CONFLICT')day=null;
   items.push({id:'item:'+p.id,selectedPlaceId:p.id,type:p.source==='custom'?'custom':'activity',day,...timing,notes:'',userModified:false});used.add(p.id);
  }
  items.forEach((i,index)=>{i.order=index;});
  const result={version:1,startDate,preferenceSignature:signature,selectedPlaces,items};validate(result,days);return result;
 }
 function validate(plan,days){
  if(plan?.version!==1||!Array.isArray(plan.items)||!Array.isArray(plan.selectedPlaces)||plan.items.length>500)throw new RangeError('Invalid itinerary.');
  const known=new Set(plan.selectedPlaces.map(identity)),ids=new Set(),refs=new Set();
  for(const i of plan.items){
   if(typeof i.id!=='string'||!i.id||ids.has(i.id)||!known.has(i.selectedPlaceId)||refs.has(i.selectedPlaceId))throw new RangeError('Invalid or duplicate itinerary identity.');
   if(i.day!==null&&(!Number.isInteger(i.day)||i.day<1||i.day>days))throw new RangeError('An activity is outside your travel dates. Move it before shortening the trip.');
   if(!/^$|^(?:[01]\d|2[0-3]):[0-5]\d$/.test(i.startTime||'')||String(i.notes||'').length>2000)throw new RangeError('Check itinerary time and notes.');
   ids.add(i.id);refs.add(i.selectedPlaceId);
  }return plan;
 }
 function rows(plan){const byId=new Map(plan.selectedPlaces.map(p=>[identity(p),p]));return plan.items.map(i=>({...i,title:i.title||byId.get(i.selectedPlaceId)?.title||byId.get(i.selectedPlaceId)?.name||'Saved place'}));}
 function legacy(selected,timeline,days,preferences){
  if(selected?.length&&!timeline.length)return reconcile(selected,null,days,preferences);
  const selectedPlaces=timeline.map(p=>({id:'legacy:'+p.id,source:'custom',title:p.title}));
  const existing={version:1,selectedPlaces,items:timeline.map((p,index)=>({id:'legacy-item:'+p.id,selectedPlaceId:'legacy:'+p.id,type:'custom',day:Number(p.day)||1,startTime:p.startTime||'',notes:p.description||'',order:index,userModified:true}))};
  return reconcile([...selectedPlaces,...(selected||[])],existing,days,preferences);
 }
 return {paceCaps,identity,places,reconcile,validate,rows,legacy};
})();
