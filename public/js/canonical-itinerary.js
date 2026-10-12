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
 function reconcile(selected,previous,days,preferences={}){
  if(!Number.isInteger(days)||days<1||days>91)throw new RangeError('Choose valid trip dates.');
  const selectedPlaces=places(selected),known=new Map(selectedPlaces.map(p=>[p.id,p]));
  const items=(previous?.items||[]).filter(i=>known.has(i.selectedPlaceId)).map(i=>({...i}));
  const signature=JSON.stringify(preferences),changed=previous?.preferenceSignature!==undefined&&previous.preferenceSignature!==signature;
  if(changed)for(let j=items.length-1;j>=0;j--)if(!items[j].userModified)items.splice(j,1);
  const used=new Set(items.map(i=>i.selectedPlaceId)),cap=paceCaps[preferences.tripPace]||3;
  const weight=p=>['day_trip','overnight_option'].includes(p.tripType)?cap:1;
  for(const p of selectedPlaces){if(used.has(p.id))continue;
   const f=preferences.activityPreferences?.find(f=>f.activityId===p.id)||{};
   const candidates=f.preferredDay?[f.preferredDay]:Array.from({length:days},(_,i)=>i+1).sort((a,b)=>Number(a===1||a===days)-Number(b===1||b===days));
   const day=p.tripType==='long_distance'?null:candidates.find(d=>d>=1&&d<=days&&items.filter(i=>i.day===d).reduce((n,i)=>n+weight(known.get(i.selectedPlaceId)),0)+weight(p)<=cap)||null;
   items.push({id:'item:'+p.id,selectedPlaceId:p.id,type:p.source==='custom'?'custom':'activity',day,startTime:f.preferredTimePeriod==='specific'?f.specificTime||'':'',notes:'',userModified:false});used.add(p.id);
  }
  items.forEach((i,index)=>{i.order=index;});
  const result={version:1,preferenceSignature:signature,selectedPlaces,items};validate(result,days);return result;
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
