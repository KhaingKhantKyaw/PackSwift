/* Reuses selected activity references, the existing pace control and form draft storage. */
window.PackSwiftItineraryPreferences={mount(form,getSelected){
 const model=PackSwiftItineraryPreferenceModel,root=document.getElementById('itinerary-preferences-content'),hidden=document.getElementById('itinerary-preferences-state'),pace=document.getElementById('pace');
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const read=()=>{let raw={};try{raw=JSON.parse(hidden.value||'{}');}catch{}return model.normalize(raw,getSelected());};
 const days=()=>Math.max(0,Math.round((Date.parse(form.elements.endDate.value)-Date.parse(form.elements.startDate.value))/86400000)+1)||0;
 function write(p,notify=true){hidden.value=JSON.stringify(model.normalize(p,getSelected()));pace.value=p.tripPace;if(notify)hidden.dispatchEvent(new Event('input',{bubbles:true}));}
 const modes=el('fieldset',undefined,'preference-modes');modes.append(el('legend','How would you like to plan your itinerary?'));
 const modeInputs=[];
 for(const[value,title,copy]of [['auto','✦ Plan It For Me','Let PackSwift organize your selected places into a practical schedule.'],['collaborative','♡ Plan Together','Choose what matters to you and PackSwift will organize the rest.'],['manual',"☷ I’ll Plan It",'Choose the days and times yourself.']]){
  const label=el('label',undefined,'preference-mode'),radio=el('input');radio.type='radio';radio.name='itinerary-mode-choice';radio.value=value;
  // Transient controls are omitted from saved fields; the hidden JSON is authoritative.
  radio.dataset.preferenceTransient='true';label.append(radio,el('strong',title));if(value==='collaborative')label.append(el('small','Recommended','preference-badge'));label.append(el('span',copy));modes.append(label);modeInputs.push(radio);
  radio.onchange=()=>{const p=read();p.planningMode=value;write(p);modeCopy();};
 }
 root.append(modes);const modeHelp=el('p',undefined,'studio-note');root.append(modeHelp);
 const paceLabel=el('label',"What’s your preferred pace?");paceLabel.htmlFor='pace';root.append(paceLabel,pace);
 pace.onchange=()=>{const p=read();p.tripPace=pace.value;write(p);};
 const heading=el('h4','Your Selected Places'),count=el('p',undefined,'studio-note'),list=el('div',undefined,'preference-places');root.append(heading,count,list);
 const routine=el('details',undefined,'studio-detail');routine.append(el('summary','Typical Travel Day'),el('p','Optional — help PackSwift plan around your routine.','studio-note'));const pair=el('div',undefined,'studio-pair'),times={};
 for(const[key,title]of [['preferredDayStart','Start around'],['preferredDayEnd','Finish around']]){const label=el('label',title),input=el('input');input.type='time';input.id='preference-'+key;label.htmlFor=input.id;label.append(input);pair.append(label);times[key]=input;input.onchange=()=>{const p=read();p[key]=input.value;write(p);};}routine.append(pair);root.append(routine,el('strong','Not sure? Leave it to PackSwift.'),el('p','Anything you leave open can be arranged automatically. Preferences are saved in this step; applying them to generation comes next.','studio-note'));
 function modeCopy(){const mode=read().planningMode;modeHelp.textContent=mode==='auto'?'PackSwift will arrange your trip for you. Customization is optional.':mode==='manual'?'Set the days and times you want. Your choices are stored as user-defined preferences.':'Customize only the places that matter to you; leave the rest flexible.';}
 function sync(raw){let p=raw?model.normalize(raw,getSelected()):read();if(!hidden.value&&!raw)p.tripPace=pace.value||'balanced';write(p,false);modeInputs.forEach(r=>r.checked=r.value===p.planningMode);for(const key of Object.keys(times))times[key].value=p[key];modeCopy();count.textContent=`${getSelected().length} places selected`;list.replaceChildren();
  if(!getSelected().length)list.append(el('p','No places selected yet. Add places in Activities, or continue with flexible preferences.','studio-note'));
  getSelected().forEach((place,index)=>{
   const id=model.activityKey(place),row=el('details',undefined,'preference-place'),summary=el('summary'),title=el('strong',place.title||place.name),description=el('span',undefined,'studio-note'),action=el('span','Customize','workspace-link');summary.append(title,description,action);row.append(summary);
   const pf=()=>read().activityPreferences.find(a=>a.activityId===id);
   function describe(){const a=pf();if(!a)return;description.textContent=`${a.preferredDay?'Day '+a.preferredDay:'Any day'} · ${a.preferredTimePeriod==='specific'?(a.specificTime||'Choose time'):a.preferredTimePeriod==='any'?'Any time':a.preferredTimePeriod}${a.priority==='must_visit'?' · ★ Must Visit':a.priority==='optional'?' · Optional':''}${a.isUserLocked?' · 🔒 Your preference':' · Flexible'}`;action.textContent=a.isUserLocked||a.priority!=='would_like'?'Edit':'Customize';}
   const controls=el('div',undefined,'preference-controls');
   function select(labelText,field,options){const label=el('label',labelText),select=el('select');select.id=`activity-preference-${index}-${field}`;select.setAttribute('aria-label',labelText+' for '+(place.title||place.name));for(const[value,text]of options){const o=el('option',text);o.value=value;select.append(o);}select.value=pf()[field]??'';label.append(select);controls.append(label);select.onchange=()=>update(field,field==='preferredDay'?(select.value?Number(select.value):null):select.value);return select;}
   const dayOptions=[['','Any Day']];for(let d=1;d<=days();d++){const date=new Date(Date.parse(form.elements.startDate.value+'T00:00:00Z')+(d-1)*86400000).toISOString().slice(0,10);dayOptions.push([String(d),`Day ${d} — ${PackSwiftTripContext.displayDate(date)}`]);}if(pf().preferredDay>days())dayOptions.push([String(pf().preferredDay),`Day ${pf().preferredDay} — outside current dates`]);select('Preferred day','preferredDay',dayOptions);
   select('Preferred time','preferredTimePeriod',[['any','Any Time'],['morning','Morning'],['afternoon','Afternoon'],['evening','Evening'],['specific','Specific Time']]);
   const exactLabel=el('label','Specific time'),exact=el('input');exact.type='time';exact.setAttribute('aria-label','Specific time for '+(place.title||place.name));exact.value=pf().specificTime||'';exactLabel.append(exact);controls.append(exactLabel);exact.onchange=()=>update('specificTime',exact.value||null);
   select('How important is this activity?','priority',[['must_visit','★ Must Visit'],['would_like','♡ Would Like'],['optional','○ Optional']]);
   const reset=el('button','Reset to flexible','studio-secondary');reset.type='button';reset.onclick=()=>{const p=read();p.activityPreferences=p.activityPreferences.filter(a=>a.activityId!==id);write(p);sync();};controls.append(reset);
   function update(field,value){const p=read(),a=p.activityPreferences.find(a=>a.activityId===id);a[field]=value;write(p);exactLabel.hidden=pf().preferredTimePeriod!=='specific';describe();}
   exactLabel.hidden=pf().preferredTimePeriod!=='specific';describe();row.append(controls);list.append(row);
  });
 }
 sync();return {get:read,sync,validate:()=>model.validate(read(),days())};
}};
