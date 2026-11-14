(() => {
 'use strict';
 const root=document.getElementById('saved-trip-content'), status=document.getElementById('saved-trip-status');
 const parts=location.pathname.split('/').filter(Boolean),id=parts[1],section=parts[2]||'overview';
 let data,busy=false,dirty=false;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const link=(text,href)=>{const a=el('a',text,'button button-secondary');a.href=href;return a;};
 const button=(text,fn)=>{const b=el('button',text,'button button-secondary');b.type='button';b.onclick=fn;return b;};
 const path=s=>`/trips/${encodeURIComponent(id)}${s==='overview'?'':'/'+s}`;
 const card=title=>{const c=el('section',null,'panel saved-trip-card');c.append(el('h2',title));return c;};
 const date=value=>PackSwiftTripContext.displayDate(value);
 const format=n=>Number(n||0).toLocaleString();
 const api=(url,options)=>window.PackSwift.api(url,options);
 function feedback(text){status.hidden=false;status.textContent=text;}
 async function mutate(change){if(busy)return;busy=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);feedback('Saving changes…');try{data=await api(`/api/trips/${id}/workspace`,{method:'PATCH',body:JSON.stringify({...change,revision:data.workspace.revision||0})});dirty=false;await hydrateSavedItinerary();render();feedback('Trip updated.');}catch(e){feedback(e.message+' Your changes have not been saved.');const retry=button('Reload saved trip',()=>{if(!dirty||confirm('Discard unsaved changes and reload?'))load();});status.append(retry);}finally{busy=false;root.querySelectorAll('button').forEach(b=>b.disabled=false);}}
 function nav(){const n=document.getElementById('saved-trip-nav');n.replaceChildren(link('← My Trips','/trips'));for(const [key,title]of [['overview','Overview'],['requirements','Requirements'],['itinerary','Itinerary'],['packing','Packing']]){const a=link(title,path(key));if(section===key)a.setAttribute('aria-current','page');n.append(a);}}
 function selectedSchedule(){const schedule=data.selectedSchedule;if(!schedule)return;const c=card('Your selected places · planned schedule');c.append(el('small','Google Maps · confirm travel times and costs.'));
  for(const day of schedule.days){if(!day.activities.length)continue;c.append(el('h3','Day '+day.day));for(const p of day.activities){c.append(el('strong',p.title));for(const text of p.planningBlocks?.length?p.planningBlocks:[p.planningTime||'Flexible time'])c.append(el('p',text));}}
  for(const p of schedule.unscheduled)c.append(el('p',p.title+' — '+p.reason));c.append(link('Choose days and priorities',`/trip-planner?trip_id=${id}&step=itinerary-preferences`));root.append(c);
 }
 function overview(){const d=data.details;const hero=el('section',null,'saved-trip-hero');hero.append(el('span','YOUR SAVED TRIP','eyebrow'),el('h1',`Your ${d.destination} Trip`),el('p',d.tripType==='local'?`Local trip in ${d.destination}`:`${d.origin} → ${d.destination}`),el('p',`${date(d.start)} – ${date(d.end)} · ${d.nights} nights · ${d.adults} adults${d.children?` · ${d.children} children`:''} · ${d.style}`),el('p',d.budget===null?'Budget not set · finish it in Edit Trip':`Estimated budget: ${d.currency} ${format(d.budget)}`),el('p','Check the forecast near departure.'),link('Edit Trip',`/trip-planner?trip_id=${id}`),button('Print / save offline summary',()=>window.print()));root.append(hero);
  const departure=card('Travel-day reminders');
  for(const text of ['Confirm departure time, terminal and baggage with your carrier.','Keep your accommodation address and booking references offline.','Check your arrival route and an alternative connection.','Allow time for transfers, check-in and rest.'])departure.append(el('p',text));
  departure.append(link('Review arrival route',`/trip-planner?trip_id=${id}`));root.append(departure);
  if(data.itineraryPreferences){const p=data.itineraryPreferences,c=card('Itinerary Preferences');c.append(el('p',({auto:'Plan It For Me',collaborative:'Plan Together',manual:'I’ll Plan It'}[p.planningMode]||'Plan Together')+' · '+p.tripPace),el('small','Saved day and priority choices.','saved-trip-hint'),link('Edit preferences',`/trip-planner?trip_id=${id}&step=itinerary-preferences`));root.append(c);}
  const next=card('Recommended next step');next.append(el('p',data.progress.complete?'Plan reviewed.':`Continue with ${data.progress.next.label.toLowerCase()}.`));if(data.progress.next)next.append(link('Continue →',path(data.progress.next.key==='overview'?'requirements':data.progress.next.key)));next.append(el('small','Planning progress—not booking or entry confirmation.','saved-trip-hint'));root.append(next);
  const readiness=card(`${data.progress.percent}% planned`),progress=el('progress',null,'saved-trip-progress');progress.max=100;progress.value=data.progress.percent;progress.setAttribute('aria-label','Phase 1 planning progress');readiness.append(progress);for(const s of data.progress.sections){const row=el('div',null,'saved-trip-status-row');row.append(el('strong',s.label),el('span',`${s.done?'✓ ':''}${s.status}`));readiness.append(row);}readiness.append(el('p','Covers details, entry review, itinerary and packing—not bookings.','saved-trip-hint'));root.append(readiness);
  const grid=el('div',null,'saved-trip-grid');for(const [key,title,copy]of [['requirements','Travel requirements',`${d.nationality||'Nationality not specified'} passport · ${d.country||d.destination}`],['itinerary','Your itinerary',`${d.nights+1} calendar days · ${data.editablePlan||data.editableStopCount?data.editableStopCount:data.timeline.length} planned stops`],['packing','Smart packing',`${data.packing.filter(p=>p.completed).length} / ${data.packing.length} prepared`]]){const c=card(title);c.append(el('p',copy),link('Open →',path(key)));grid.append(c);}root.append(grid);
 }
 const requirements=[['passport','Passport','Verify validity, condition and blank-page rules.'],['entry','Visa / entry permission','Confirm eligibility for your passport and travel purpose.'],['arrival','Arrival requirements','Check whether official arrival declarations or other documents apply.'],['onward','Return / onward travel','Check evidence required by immigration and your carrier.'],['accommodation','Accommodation information','Keep your stay address and reservation details accessible.'],['insurance','Travel insurance','Review cover, exclusions and emergency assistance details.']];
 function requirementsView(){const d=data.details;if(d.tripType==='local'){root.append(el('h1','Local trip requirements'),el('p','International entry requirements are not required for this local trip.'));return;}root.append(el('h1','Travel requirements'),el('p',`${d.nationality||'Nationality not provided'} passport · ${d.origin} → ${d.destination}${d.country?' ('+d.country+')':''} · ${date(d.start)} – ${date(d.end)}`),el('p','No live immigration verification is available. Please verify with the official immigration or embassy source before traveling. “Reviewed” records your check, not legal eligibility.','saved-trip-hint'));const grid=el('div',null,'saved-trip-grid');for(const [key,title,copy]of requirements){const c=card(title),checked=data.workspace.requirements?.[key];c.append(el('p',copy),el('small',checked?`Reviewed by you: ${date(checked)}`:'Official information: not checked by PackSwift.','saved-trip-hint'),button(checked?'Undo reviewed':'Mark as Reviewed',()=>mutate({action:'requirement',key,reviewed:!checked})));grid.append(c);}root.append(grid);}
 function editableItinerary(){
  const plan=data.editablePlan,d=data.details;
  root.append(el('h1',`${d.destination} itinerary`),link('Edit this itinerary',`/trip-planner?trip_id=${encodeURIComponent(id)}&view=preview`));
  const stale=plan.startDate!==d.start||plan.endDate!==d.end||plan.destination.toLowerCase()!==d.destination.toLowerCase();
  if(stale)root.append(el('p','Trip details have changed. Open the editor to review and update this saved itinerary.','saved-trip-hint'));
  root.append(el('p','Your saved plan · fixed stops stay protected when rebuilding. Times and costs are planning estimates, not reservations.','saved-trip-hint'));
  for(const day of plan.days){
   const c=card(`Day ${day.day} · ${date(day.date)}`);
   if(!day.stops.length)c.append(el('p','Free time — add a stop in the itinerary editor.'));
   for(const stop of day.stops){const row=el('article',null,'saved-itinerary-stop');row.append(el('small',`${stop.startTime} · ${stop.durationMinutes} min${stop.locked?' · Fixed':''}`),el('h3',stop.name));
    if(stop.notes)row.append(el('p',stop.notes));
    if(stop.costAmount!==null)row.append(el('p',`${stop.currency} ${format(stop.costAmount)} · entered estimate`));
    else if(!['rest','transfer'].includes(stop.kind))row.append(el('small','Cost not confirmed','saved-trip-hint'));
    if(stop.routeFromPrevious)row.append(el('p',stop.routeFromPrevious.durationMinutes===null?'Travel time unverified':`${stop.routeFromPrevious.durationMinutes} min travel · ${stop.routeFromPrevious.source==='routes'?'route estimate':'approximate'}`,'saved-trip-hint'));
    if(stop.placeId&&stop.provider==='google'){const a=link('View place on Google Maps ↗',`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.name)}&query_place_id=${encodeURIComponent(stop.placeId)}`);a.target='_blank';a.rel='noopener noreferrer';row.append(a);}
    if(stop.warnings?.length){const notes=el('details');notes.append(el('summary','Check before you go'));for(const text of stop.warnings)notes.append(el('p',text,'saved-trip-hint'));row.append(notes);}c.append(row);
   }root.append(c);
  }
  if(plan.unscheduled?.length){const c=card('Still to fit in');for(const stop of plan.unscheduled)c.append(el('p',`${stop.name} — ${stop.reason}`));root.append(c);}
  const review=button('Mark itinerary reviewed',()=>mutate({action:'review-itinerary'}));review.disabled=stale;root.append(review,button('Print / save offline summary',()=>window.print()));
 }
 function itinerary(){if(data.editablePlan)return editableItinerary();selectedSchedule();root.append(el('h1',`${data.details.destination} itinerary`),el('p','Suggested activities—not confirmed reservations. Edit the day, time and title, then save. Leave time blank if unknown.','saved-trip-hint'));const editor=el('div');const items=structuredClone(data.timeline);function draw(){editor.replaceChildren();items.forEach((item,index)=>{const row=el('div',null,'saved-trip-editor');for(const [field,title,type]of [['day','Day','number'],['startTime','Time','time'],['title','Activity','text']]){const label=el('label',title),input=el('input',null,'field-control');input.type=type;input.value=item[field]||'';if(type==='number'){input.min=1;input.max=data.details.nights+1;}if(type==='text')input.maxLength=180;input.oninput=()=>{item[field]=type==='number'?Number(input.value):input.value;dirty=true;};label.append(input);row.append(label);}row.append(button('Remove',()=>{items.splice(index,1);dirty=true;draw();}));editor.append(row);});}draw();root.append(button('Regenerate itinerary',()=>{if(confirm('Replace all itinerary edits with a new suggested plan?'))mutate({action:'regenerate'});}),button('Regenerate a day',()=>{const value=prompt('Which day would you like to regenerate?');if(value===null)return;const day=Number(value);if(!Number.isInteger(day)||day<1||day>data.details.nights+1)return feedback('Choose a valid day.');if(confirm(`Replace activities for Day ${day}?`))mutate({action:'regenerate',day});}),editor,button('+ Add activity',()=>{items.push({day:1,title:'New activity',startTime:''});dirty=true;draw();}),button('Save itinerary',()=>{if(items.some(p=>p.day>data.details.nights+1||p.day<1||!p.title.trim()))return feedback('Check each title and day against your trip dates.');mutate({action:'itinerary',items});}),button('Mark itinerary reviewed',()=>{if(dirty)return feedback('Save your itinerary changes before reviewing.');mutate({action:'review-itinerary'});}));}
 async function hydrateSavedItinerary(){
  if(section!=='itinerary'||!data.editablePlan)return;
  try{const result=await api('/api/itinerary-plan/hydrate',{method:'POST',body:JSON.stringify({plan:data.editablePlan,input:{destination:data.editablePlan.destination,startDate:data.editablePlan.startDate,endDate:data.editablePlan.endDate}})});if(result.plan)data.editablePlan=result.plan;}catch{/* Saved decisions remain visible even if provider details cannot refresh. */}
 }
 function packing(){root.append(el('h1','Smart packing'),el('p',`${data.details.destination} · ${data.details.nights} nights · ${data.details.purpose}`),el('p','Mark owned items as prepared. “I Need It” saves your missing-item list; shopping is outside Phase 1.','saved-trip-hint'));if(!data.packing.length){root.append(el('p','No packing items were generated for this trip.'));return;}const groups=Object.groupBy(data.packing,p=>p.category);for(const [category,items]of Object.entries(groups)){const c=card(category);for(const p of items){const row=el('div',null,'saved-trip-packing'),info=el('div');info.append(el('strong',p.itemName),el('p',p.reason||'Suggested from your saved trip context.'));const actions=el('div');for(const [value,title]of [['have','✓ I Have It'],['need','I Need It'],['unchecked','Reset']]){const b=button(title,()=>mutate({action:'packing',itemId:p.id,state:value}));b.setAttribute('aria-pressed',String(value==='have'?p.completed:value==='need'?(data.workspace.needs||[]).includes(p.id):!p.completed&&!(data.workspace.needs||[]).includes(p.id)));actions.append(b);}row.append(info,actions);c.append(row);}root.append(c);}}
 function render(){root.replaceChildren();nav();if(section==='requirements')requirementsView();else if(section==='itinerary')itinerary();else if(section==='packing')packing();else overview();root.setAttribute('aria-busy','false');}

 function emptyTrips(grid){
   if(grid.children.length)return;
   const empty=card('No trips planned yet');
   empty.append(el('p','Start planning your next adventure with PackSwift.'),link('Plan a Trip →','/trip-planner'));
   grid.append(empty);
 }
 function removeTrip(trip,tripCard,opener){
   const dialog=el('dialog',null,'trip-auth-dialog remove-trip-dialog');
   dialog.setAttribute('aria-labelledby','remove-trip-title');
   dialog.setAttribute('aria-describedby','remove-trip-description');
   const title=el('h2','Remove Trip?');title.id='remove-trip-title';
   const icon=el('span','⚠ ');icon.setAttribute('aria-hidden','true');title.prepend(icon);
   const warning=el('p','This will remove the saved trip and its associated planning information.');warning.id='remove-trip-description';
   const error=el('p');error.setAttribute('role','alert');
   let pending=false,removed=false;
   const cancel=button('Cancel',()=>dialog.close());
   const confirmButton=button('Remove Trip',async()=>{
     if(pending)return;pending=true;cancel.disabled=true;confirmButton.disabled=true;
     confirmButton.textContent='Removing…';error.textContent='';
     try{
       await api('/api/trips/'+encodeURIComponent(trip.tripId),{method:'DELETE'});
       const grid=tripCard.parentElement;tripCard.remove();emptyTrips(grid);removed=true;dialog.close();
       const toast=el('div','Trip removed successfully.','trip-remove-toast');toast.setAttribute('role','status');document.body.append(toast);setTimeout(()=>toast.remove(),5000);
     }catch{
       error.textContent="We couldn't remove this trip. Please try again.";
     }finally{pending=false;cancel.disabled=false;confirmButton.disabled=false;confirmButton.textContent='Remove Trip';}
   });
   confirmButton.classList.add('remove-trip-confirm');
   const actions=el('div');actions.append(cancel,confirmButton);
   dialog.append(title,el('p',`Are you sure you want to remove your ${trip.details.destination} trip?`),el('strong',trip.details.tripType==='local'?`Local trip in ${trip.details.destination}`:`${trip.details.origin} → ${trip.details.destination}`),el('p',`${date(trip.details.start)} – ${date(trip.details.end)}`),warning,error,actions);
   dialog.addEventListener('cancel',event=>{if(pending)event.preventDefault();});
   dialog.addEventListener('click',event=>{if(event.target!==dialog||pending)return;const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();});
   dialog.addEventListener('close',()=>{dialog.remove();if(!removed&&opener.isConnected)opener.focus();else{const target=root.querySelector('.saved-trip-grid a')||root.querySelector('a');target?.focus();}},{once:true});
   document.body.append(dialog);dialog.showModal();cancel.focus();
 }

 async function load(){feedback('Loading your saved trip…');root.setAttribute('aria-busy','true');try{await window.PackSwift.authReady;if(!window.PackSwift.currentUser){root.replaceChildren(el('h1','Your trips, in one place'),link('Sign in to continue','/login?redirect='+encodeURIComponent(location.pathname)));feedback('Sign in to access your saved trips.');return;}if(!id){const result=await api('/api/trips');root.replaceChildren(el('h1','My Trips'));const grid=el('div',null,'saved-trip-grid');for(const t of result.trips){const c=card(t.details.destination);c.append(el('p',t.details.tripType==='local'?`Local trip in ${t.details.destination}`:`${t.details.origin} → ${t.details.destination}`),el('p',`${date(t.details.start)} – ${date(t.details.end)} · ${t.progress.percent}% planned`),link('Continue Planning',`/trips/${t.tripId}`),link('Edit Trip',`/trip-planner?trip_id=${t.tripId}`));const remove=button('Remove Trip',()=>removeTrip(t,c,remove));remove.classList.add('remove-trip-action');remove.setAttribute('aria-label',`Remove ${t.details.destination} trip`);c.append(remove);grid.append(c);}root.append(grid);emptyTrips(grid);root.append(link('Plan a trip','/trip-planner'),link('Older saved plans','/my-trips'));}else{data=await api(`/api/trips/${encodeURIComponent(id)}/workspace`);await hydrateSavedItinerary();render();}status.hidden=true;}catch(e){feedback(e.message||'We couldn’t load your trip.');status.append(button('Try again',load));}finally{root.setAttribute('aria-busy','false');}}
 let refreshTimer;
 const refreshWhenSafe=()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if(!dirty&&!busy&&!document.querySelector('.remove-trip-dialog[open]'))load();},60);};
 window.addEventListener('storage',e=>{if(e.key==='packswift:trips-changed')refreshWhenSafe();});
 window.addEventListener('focus',refreshWhenSafe);
 window.addEventListener('pageshow',e=>{if(e.persisted)refreshWhenSafe();});
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});load();
})();
