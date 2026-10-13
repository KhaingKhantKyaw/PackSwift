/* Shared Phase 1 preference schema. This stores constraints; it does not schedule places. */
globalThis.PackSwiftItineraryPreferenceModel=(()=>{
 const modes=['auto','collaborative','manual'],paces=['relaxed','balanced','packed'];
 const periods=['any','morning','afternoon','evening','specific'],priorities=['must_visit','would_like','optional'];
 const activityKey=p=>String(p.placeId||p.place_id||p.id||p.title||p.name);
 function normalize(raw={},selected=[]){
  raw=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const known=new Map((Array.isArray(raw.activityPreferences)?raw.activityPreferences:[]).filter(p=>p&&typeof p==='object').map(p=>[String(p.activityId),p]));
  return {planningMode:modes.includes(raw.planningMode)?raw.planningMode:'collaborative',tripPace:paces.includes(raw.tripPace)?raw.tripPace:'balanced',preferredDayStart:raw.preferredDayStart??'09:00',preferredDayEnd:raw.preferredDayEnd??'21:00',
   activityPreferences:[...new Set(selected.map(activityKey))].map(activityId=>{const p=known.get(activityId)||{},preferredDay=p.preferredDay==null||p.preferredDay===''?null:Number(p.preferredDay),preferredTimePeriod=periods.includes(p.preferredTimePeriod)?p.preferredTimePeriod:'any';return {activityId,preferredDay,preferredTimePeriod,specificTime:preferredTimePeriod==='specific'?(p.specificTime||null):null,priority:priorities.includes(p.priority)?p.priority:'would_like',isUserLocked:preferredDay!==null||preferredTimePeriod!=='any'};})};
 }
 function validate(p,days){
  const errors=[];const time=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v||'');
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
