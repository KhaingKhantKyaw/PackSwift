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
 const minutes=value=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value||'')?Number(value.slice(0,2))*60+Number(value.slice(3)):null;
 const dateFor=(start,day)=>new Date(Date.parse(start+'T00:00:00Z')+(day-1)*86400000).toISOString().slice(0,10);
 const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 const bounded=(n,fallback,max=720)=>n!==''&&n!=null&&Number.isFinite(Number(n))?Math.max(0,Math.min(max,Number(n))):fallback;
 function coordinates(p){const c=p?.coordinates||p;return c&&Number.isFinite(c.latitude)&&Math.abs(c.latitude)<=90&&Number.isFinite(c.longitude)&&Math.abs(c.longitude)<=180?c:null;}
 function distance(a,b){a=coordinates(a);b=coordinates(b);if(!a||!b)return null;const rad=n=>n*Math.PI/180;return 12742*Math.asin(Math.min(1,Math.sqrt(Math.sin(rad(b.latitude-a.latitude)/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(b.longitude-a.longitude)/2)**2)));}
 function duration(place,item={}){
  if(Number(item.durationMin)>0)return {durationMin:Number(item.durationMin),durationSource:item.durationSource||'ESTIMATED'};
  if(Number(place.suggestedStayMin)>0)return {durationMin:Math.min(place.durationSource==='USER'?1440:720,Number(place.suggestedStayMin)),durationSource:['USER','PROVIDER'].includes(place.durationSource)?place.durationSource:'ESTIMATED'};
  const tags=[...(place.tags||[]),...(place.types||[]),...(place.categories||[])].join(' ');
  return {durationMin:/theme_park|amusement_park/.test(tags)?360:/museum/.test(tags)?120:/cafe|restaurant|temple/.test(tags)?60:/shopping/.test(tags)?120:place.tripType==='day_trip'?360:90,durationSource:'ESTIMATED'};
 }
 function dayWindow(startDate,day,p={}){
  let start=minutes(p.preferredDayStart)??540,end=minutes(p.preferredDayEnd)??1260;
  if(startDate){const date=dateFor(startDate,day);
   if(p.arrivalAt){if(date<p.arrivalAt.slice(0,10))end=0;else if(date===p.arrivalAt.slice(0,10))start=Math.max(start,(minutes(p.arrivalAt.slice(11,16))??start)+bounded(p.arrivalBufferMin,0));}
   if(p.departureAt){if(date>p.departureAt.slice(0,10))end=0;else if(date===p.departureAt.slice(0,10))end=Math.min(end,(minutes(p.departureAt.slice(11,16))??end)-bounded(p.departureBufferMin,0));}
  }return {start,end};
 }
 // Provider periods are weekly local-wall-time intervals. Previous-day overnight
 // periods are included; missing close is only 24/7 for the provider's Sunday-00 convention.
 function openingWindows(place,date){
  const exception=place.openingExceptions?.[date];
  if(exception?.closed===true)return {status:'KNOWN',windows:[]};
  const periods=exception?.periods||place.openingPeriods;
  if(!date||!Array.isArray(periods)||!periods.length)return {status:'UNKNOWN',windows:[]};
  const weekday=new Date(date+'T00:00:00Z').getUTCDay(),windows=[];let partial=false;
  for(const period of periods){const o=period.open,c=period.close;
   if(!o||!Number.isInteger(o.day)||o.day<0||o.day>6||!Number.isInteger(o.hour)||o.hour<0||o.hour>23||(o.minute||0)<0||(o.minute||0)>59){partial=true;continue;}
   if(!c){if(o.day===0&&o.hour===0&&!(o.minute||0))windows.push([0,1440]);else partial=true;continue;}
   if(!Number.isInteger(c.day)||c.day<0||c.day>6||!Number.isInteger(c.hour)||c.hour<0||c.hour>23||(c.minute||0)<0||(c.minute||0)>59){partial=true;continue;}
   const open=o.day*1440+o.hour*60+(o.minute||0);let close=c.day*1440+c.hour*60+(c.minute||0);if(close<=open)close+=10080;
   for(const shift of [-10080,0,10080]){const a=Math.max(0,open+shift-weekday*1440),b=Math.min(1440,close+shift-weekday*1440);if(b>a)windows.push([a,b]);}
  }return {status:partial?'PARTIAL':'KNOWN',windows:windows.sort((a,b)=>a[0]-b[0])};
 }
 function proposedTime(place,items,day,preferences,choice,startDate){
  const visit=duration(place),durationMin=visit.durationMin;
  let {start,end}=dayWindow(startDate,day,preferences);
  const period=choice.preferredTimePeriod;if(period==='morning')end=Math.min(end,720);if(period==='afternoon'){start=Math.max(start,720);end=Math.min(end,1020);}if(period==='evening')start=Math.max(start,1020);
  const explicit=period==='specific'?minutes(choice.specificTime):null;
  const hours=openingWindows(place,startDate?dateFor(startDate,day):null),windows=hours.status==='KNOWN'?hours.windows:[[0,1440]];
  const occupied=items.filter(i=>i.day===day&&minutes(i.startTime)!==null).map(i=>[minutes(i.startTime),minutes(i.startTime)+(i.durationMin||90)]).sort((a,b)=>a[0]-b[0]);
  const buffer=bounded(preferences.transitionBufferMin,30,180);
  for(const [open,close] of windows){let t=explicit??Math.max(start,open);if(t<start||t<open)continue;
   for(const [a,b] of occupied){if(t+durationMin+buffer<=a)break;if(t<b+buffer&&t+durationMin+buffer>a){if(explicit!==null){t=Infinity;break;}t=b+buffer;}}
   if(t+durationMin<=Math.min(end,close))return {...visit,startTime:clock(t),timeStatus:'TENTATIVE',scheduleNote:hours.status==='KNOWN'?'Provider-reported weekly hours; confirm exceptions for your date.':'Opening hours unknown / not confirmed. Suggested time only.'};
  }
  return {...visit,startTime:choice.specificTime||'',timeStatus:'CONFLICT',scheduleNote:'No suitable time in the available day / reported hours. Change day, time or duration.'};
 }
 function reconcile(selected,previous,days,preferences={},startDate=previous?.startDate){
  if(!Number.isInteger(days)||days<1||days>91)throw new RangeError('Choose valid trip dates.');
  const selectedPlaces=places(selected),known=new Map(selectedPlaces.map(p=>[p.id,p]));
  const items=(previous?.items||[]).filter(i=>known.has(i.selectedPlaceId)).map(i=>({...i}));
  const signature=JSON.stringify([preferences,startDate]),changed=previous?.preferenceSignature!==undefined&&previous.preferenceSignature!==signature;
  // Legacy callers retain their preference-triggered behavior. Phase D requires
  // explicit authorization to rearrange already assigned flexible activities.
  if(changed&&previous?.schedulingVersion!==2)for(let j=items.length-1;j>=0;j--)if(!items[j].userModified&&!items[j].locked)items.splice(j,1);
  const used=new Set(items.map(i=>i.selectedPlaceId)),cap=paceCaps[preferences.tripPace]||3;
  const weight=p=>['day_trip','overnight_option'].includes(p?.tripType)||duration(p||{}).durationMin>=300?cap:1;
  const priorities={must_visit:0,would_like:1,optional:2};
  const pending=selectedPlaces.filter(p=>!used.has(p.id));
  const priority=p=>previous?.items?.find(i=>i.selectedPlaceId===p.id)?.priority||preferences.activityPreferences?.find(f=>f.activityId===p.id)?.priority||'would_like';
  // Stable greedy geographic grouping, never a route-time estimate.
  let anchor=coordinates(preferences.accommodation);
  const ordered=[];while(pending.length){pending.sort((a,b)=>(priorities[priority(a)]??1)-(priorities[priority(b)]??1)||(distance(anchor,a)??Infinity)-(distance(anchor,b)??Infinity)||selectedPlaces.indexOf(a)-selectedPlaces.indexOf(b));const next=pending.shift();ordered.push(next);anchor=coordinates(next)||anchor;}
  for(const p of ordered){if(used.has(p.id))continue;
   const f=preferences.activityPreferences?.find(f=>f.activityId===p.id)||{};
   const candidates=f.preferredDay?[f.preferredDay]:Array.from({length:days},(_,i)=>i+1).sort((a,b)=>Number(a===1||a===days)-Number(b===1||b===days));
   const score=d=>{const group=items.filter(i=>i.day===d).map(i=>known.get(i.selectedPlaceId));const distances=group.map(q=>distance(p,q)).filter(n=>n!==null);return distances.length?Math.min(...distances):15;};
   candidates.sort((a,b)=>score(a)-score(b));
   let day=null,timing={...duration(p),startTime:f.specificTime||'',timeStatus:'UNASSIGNED'};
   if(!['long_distance','overnight_option'].includes(p.tripType)&&!(preferences.planningMode==='manual'&&!f.preferredDay))for(const d of candidates){
    const light=(d===1&&!preferences.arrivalAt&&preferences.lightArrivalDay)||(d===days&&!preferences.departureAt&&preferences.lightDepartureDay);
    if(d<1||d>days||items.filter(i=>i.day===d).reduce((n,i)=>n+weight(known.get(i.selectedPlaceId)),0)+weight(p)>(light?1:cap))continue;
    const proposed=proposedTime(p,items,d,preferences,f,startDate);timing=proposed;if(proposed.timeStatus!=='CONFLICT'){day=d;break;}
   }
   items.push({id:'item:'+p.id,selectedPlaceId:p.id,type:p.source==='custom'?'custom':'activity',day,...timing,priority:priority(p),notes:'',userModified:false});used.add(p.id);
  }
  items.forEach((i,index)=>{i.order=index;});
  const result={...previous,version:1,startDate,preferenceSignature:signature,selectedPlaces,items};validate(result,days);return result;
 }
 function suggest(selected,previous,days,preferences={},startDate=previous?.startDate){
  const protectedItems=(previous?.items||[]).filter(i=>i.locked||i.userModified);
  const prepared=places(selected).map(p=>{const old=previous?.items?.find(i=>i.selectedPlaceId===p.id);return old?.durationSource==='USER'?{...p,suggestedStayMin:old.durationMin,durationSource:'USER'}:p;});
  const choices={...preferences,activityPreferences:places(selected).map(p=>({...preferences.activityPreferences?.find(f=>f.activityId===p.id),activityId:p.id,priority:previous?.items?.find(i=>i.selectedPlaceId===p.id)?.priority||preferences.activityPreferences?.find(f=>f.activityId===p.id)?.priority||'would_like'}))};
  const plan=reconcile(prepared,{...previous,items:protectedItems,schedulingVersion:2},days,choices,startDate);
  plan.preferenceSignature=JSON.stringify([preferences,startDate]);
  for(const item of plan.items){const old=previous?.items?.find(i=>i.id===item.id);if(old){item.priority=old.priority||item.priority;item.notes=old.notes||'';if(old.durationSource==='USER'){item.durationMin=old.durationMin;item.durationSource='USER';}}}
  plan.selectedPlaces=places(selected);return plan;
 }
 function conflicts(plan,preferences={}){
  const warnings=[],byId=new Map(plan.selectedPlaces.map(p=>[identity(p),p]));
  let fingerprint=2166136261;for(const char of JSON.stringify([plan.startDate,preferences,plan.items.map(i=>[i.id,i.day,i.startTime,i.durationMin]),plan.selectedPlaces.map(p=>[identity(p),p.openingPeriods,p.coordinates])]))fingerprint=Math.imul(fingerprint^char.charCodeAt(0),16777619)>>>0;
  const add=(code,severity,item,message,action)=>{const id=[code,item?.id||'trip',item?.day,item?.startTime,item?.durationMin,fingerprint].join(':');warnings.push({id,code,severity,itemId:item?.id||null,message,action,accepted:Boolean(item?.acceptedWarnings?.includes(id))});};
  if(!coordinates(preferences.accommodation))add('ACCOMMODATION','INFO',null,'Add accommodation coordinates to improve geographic grouping.','Add stay details');
  for(const item of plan.items){const p=byId.get(item.selectedPlaceId)||{},t=minutes(item.startTime),d=duration(p,item).durationMin;
   if(!coordinates(p)&&item.type!=='custom')add('LOCATION','INFO',item,'Location coordinates unavailable; geographic grouping is limited.','Check location');
   if(['day_trip','overnight_option','long_distance'].includes(p.tripType))add('LOGISTICS',p.tripType==='day_trip'?'INFO':'LIKELY',item,p.tripType==='overnight_option'?'An additional overnight stay may be needed. Review accommodation.':'Outbound and return travel need checking. Travel time not calculated.','Review day / transfers');
   if(item.day===null){add('UNASSIGNED','INFO',item,'This selected activity has no day assigned.','Choose day');continue;}
   const window=dayWindow(plan.startDate,item.day,preferences),hours=openingWindows(p,plan.startDate?dateFor(plan.startDate,item.day):null);
   if(t!==null&&(t<window.start||t+d>window.end))add('TRAVEL_WINDOW','LIKELY',item,'Visit falls outside your usable day, including arrival/departure planning buffers.','Change day or time');
   if(hours.status!=='KNOWN')add('HOURS_UNKNOWN','INFO',item,'Hours not confirmed. Verify the venue for this date.','Check hours');
   else if(t!==null&&!hours.windows.some(([a,b])=>t>=a&&t+d<=b))add('HOURS','LIKELY',item,'Possible opening-hours conflict. Weekly hours may have holiday exceptions.','Change time');
  }
  for(const day of new Set(plan.items.map(i=>i.day).filter(d=>d!==null))){const items=plan.items.filter(i=>i.day===day).sort((a,b)=>(minutes(a.startTime)??1440)-(minutes(b.startTime)??1440));
   for(let n=0;n<items.length;n++){const a=items[n],at=minutes(a.startTime);for(const b of items.slice(n+1)){const bt=minutes(b.startTime);if(at!==null&&bt!==null&&at+(a.durationMin||90)>bt)add('OVERLAP',a.locked&&b.locked?'BLOCKING':'LIKELY',b,'This visit overlaps another activity. Both have been kept.','Change time / duration');}
    if(n>0){const km=distance(byId.get(items[n-1].selectedPlaceId),byId.get(a.selectedPlaceId));add('TRANSFER',km!==null&&km>25?'LIKELY':'INFO',a,(km!==null?`Approx. ${Math.round(km)} km geographic distance (not route distance). `:'')+'Travel time not calculated.','Check transfer or move day');}}
   const total=items.reduce((n,i)=>n+(i.durationMin||90),0),w=dayWindow(plan.startDate,day,preferences);if(total>Math.max(0,w.end-w.start)||items.length>(paceCaps[preferences.tripPace]||3))add('OVERLOAD','LIKELY',items[0],'This day exceeds your time window or preferred pace target.','Move activity / shorten visit');
  }return warnings;
 }
 function validate(plan,days){
  if(plan?.version!==1||!Array.isArray(plan.items)||!Array.isArray(plan.selectedPlaces)||plan.items.length>500)throw new RangeError('Invalid itinerary.');
  const known=new Set(plan.selectedPlaces.map(identity)),ids=new Set(),refs=new Set();
  for(const i of plan.items){
   if(typeof i.id!=='string'||!i.id||ids.has(i.id)||!known.has(i.selectedPlaceId)||refs.has(i.selectedPlaceId))throw new RangeError('Invalid or duplicate itinerary identity.');
   if(i.day!==null&&(!Number.isInteger(i.day)||i.day<1||i.day>days))throw new RangeError('An activity is outside your travel dates. Move it before shortening the trip.');
   if(!/^$|^(?:[01]\d|2[0-3]):[0-5]\d$/.test(i.startTime||'')||String(i.notes||'').length>2000)throw new RangeError('Check itinerary time and notes.');
   if(i.durationMin!=null&&(!Number.isInteger(i.durationMin)||i.durationMin<1||i.durationMin>1440))throw new RangeError('Visit duration must be 1–1440 minutes.');
   if(i.priority!=null&&!['must_visit','would_like','optional'].includes(i.priority))throw new RangeError('Choose a valid activity priority.');
   if(i.locked!=null&&typeof i.locked!=='boolean')throw new RangeError('Invalid activity lock.');
   if(i.acceptedWarnings!=null&&(!Array.isArray(i.acceptedWarnings)||i.acceptedWarnings.length>100||i.acceptedWarnings.some(s=>typeof s!=='string'||s.length>700)))throw new RangeError('Invalid accepted planning checks.');
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
 return {paceCaps,identity,places,reconcile,validate,rows,legacy,suggest,conflicts,dayWindow,openingWindows,duration,distance,coordinates,dateFor};
})();
