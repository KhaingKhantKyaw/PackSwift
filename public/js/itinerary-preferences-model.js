/* Shared Phase 1 preference schema. This stores constraints; it does not schedule places. */
globalThis.PackSwiftItineraryPreferenceModel=(()=>{
 const modes=['auto','collaborative','manual'],paces=['relaxed','balanced','packed'];
 const periods=['any','morning','afternoon','evening','specific'],priorities=['must_visit','would_like','optional'];
 const activityKey=p=>String(p.providerPlaceId||p.placeId||p.place_id||p.id||'');
 function normalize(raw={},selected=[]){
  raw=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const known=new Map((Array.isArray(raw.activityPreferences)?raw.activityPreferences:[]).filter(p=>p&&typeof p==='object').map(p=>[String(p.activityId),p]));
  const context={};for(const key of ['arrivalBufferMin','departureBufferMin','transitionBufferMin'])if(raw[key]!=null)context[key]=Number(raw[key]);
  for(const key of ['travelMode','arrivalTimezone','departureTimezone'])if(raw[key])context[key]=String(raw[key]).slice(0,100);
  for(const key of ['lightArrivalDay','lightDepartureDay'])if(raw[key])context[key]=true;
  if(raw.accommodation&&typeof raw.accommodation==='object')context.accommodation={name:String(raw.accommodation.name||'').slice(0,150),address:String(raw.accommodation.address||'').slice(0,300),latitude:raw.accommodation.latitude,longitude:raw.accommodation.longitude};
  return {...context,planningMode:modes.includes(raw.planningMode)?raw.planningMode:'collaborative',tripPace:paces.includes(raw.tripPace)?raw.tripPace:'balanced',preferredDayStart:raw.preferredDayStart??'09:00',preferredDayEnd:raw.preferredDayEnd??'21:00',...(typeof raw.arrivalAt==='string'&&raw.arrivalAt?{arrivalAt:raw.arrivalAt}:{}),...(typeof raw.departureAt==='string'&&raw.departureAt?{departureAt:raw.departureAt}:{}),
   activityPreferences:[...new Set(selected.map(activityKey))].map(activityId=>{const p=known.get(activityId)||{},preferredDay=p.preferredDay==null||p.preferredDay===''?null:Number(p.preferredDay),preferredTimePeriod=periods.includes(p.preferredTimePeriod)?p.preferredTimePeriod:'any';return {activityId,preferredDay,preferredTimePeriod,specificTime:preferredTimePeriod==='specific'?(p.specificTime||null):null,priority:priorities.includes(p.priority)?p.priority:'would_like',isUserLocked:preferredDay!==null||preferredTimePeriod!=='any'};})};
 }
 function validate(p,days){
  const errors=[];const time=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v||'');
  for(const key of ['arrivalBufferMin','departureBufferMin','transitionBufferMin'])if(p[key]!=null&&(!Number.isInteger(p[key])||p[key]<0||p[key]>720))errors.push('Planning buffers must be between 0 and 720 minutes.');
  for(const key of ['arrivalTimezone','departureTimezone'])if(p[key])try{new Intl.DateTimeFormat('en',{timeZone:p[key]});}catch{errors.push('Use a valid IANA timezone, such as Asia/Bangkok.');}
  for(const key of ['arrivalAt','departureAt'])if(p[key]){const value=p[key],stamp=Date.parse(value+'Z');if(!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)||!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,16)!==value)errors.push('Choose valid local arrival and departure dates and times.');}
  if(p.accommodation)for(const [key,limit]of [['latitude',90],['longitude',180]]){const value=p.accommodation[key];if(value!=null&&(!Number.isFinite(value)||Math.abs(value)>limit))errors.push('Check accommodation coordinates.');}
  if(!modes.includes(p.planningMode)||!paces.includes(p.tripPace))errors.push('Choose a planning mode and pace.');
  for(const value of [p.preferredDayStart,p.preferredDayEnd])if(value&&!time(value))errors.push('Choose a valid typical-day time.');
  if(p.preferredDayStart&&p.preferredDayEnd&&p.preferredDayEnd<=p.preferredDayStart)errors.push('Typical day finish must be after the start.');
  for(const a of p.activityPreferences||[]){
   if(a.preferredDay!==null&&(!Number.isInteger(a.preferredDay)||a.preferredDay<1||a.preferredDay>91||(days>0&&a.preferredDay>days)))errors.push('A preferred day is outside your trip dates. Update it or choose Any Day.');
   if(a.preferredTimePeriod==='specific'&&!time(a.specificTime))errors.push('Choose a specific time or switch to Any Time.');
  }
  return [...new Set(errors)];
 }
 return {normalize,validate,activityKey};
})();
