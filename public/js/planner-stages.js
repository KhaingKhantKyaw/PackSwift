/* Compose existing controls; the studio remains the sole owner of trip state. */
window.PackSwiftStages=(()=>{
 const $=id=>document.getElementById(id),el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 function compose(form){
  form.dataset.workflow='three-stage';
  const version=el('input');version.type='hidden';version.name='workflowVersion';version.value='3';form.append(version);
  const old=[...form.querySelectorAll('[data-step]')],stages=['Trip Basics','Discover Places','Arrange Your Days'].map((title,index)=>{const s=el('section');s.className='studio-step planner-stage';s.dataset.step=index;s.hidden=index!==0;const h=el('h2',title);h.tabIndex=-1;s.append(h);return s;});
  function section(source,title){source.removeAttribute('data-step');source.className='planner-section';source.hidden=false;source.querySelectorAll(':scope > .studio-eyebrow,:scope > h3').forEach(n=>n.remove());if(title)source.prepend(el('h3',title));return source;}
  stages[0].append(section(old[0]),section(old[1],'Travelers'),section(old[2],'Budget · optional'));
  stages[1].append(section(old[3],'Your interests'),section(old[4],'Find places you love'));
  stages[2].append(section(old[5]));old[6].remove();
  for(const s of stages)form.insertBefore(s,$('planner-feedback'));
  const destination=$('destination-search'),label=form.querySelector('label[for="destination-search"]'),originLabel=$('origin-label');originLabel.before(label,destination);originLabel.textContent='Origin city · optional';$('origin-search').required=false;
  // Retain legacy mode fields for restoration, but no extra mode decision.
  form.querySelector('.trip-type-control').hidden=true;
  $('budget').required=false;$('budget').min='0';form.querySelector('label[for="budget"]').textContent='Budget target · optional';
  const goal=$('planning-goal'),goalLabel=form.querySelector('label[for="planning-goal"]');const advanced=el('details');advanced.append(el('summary','Saved budget preference'),goalLabel,goal);old[2].append(advanced);
  const lowerLabel=el('label','Prioritize lower-cost options '),lower=el('input');lower.type='checkbox';lower.id='prioritize-lower-cost';lower.dataset.preferenceTransient='true';lowerLabel.prepend(lower);advanced.before(lowerLabel);lower.onchange=()=>{goal.value=lower.checked?'make-possible':'best-value';goal.dispatchEvent(new Event('change',{bubbles:true}));};
  const syncBudgetPreference=()=>{lower.checked=goal.value==='make-possible';};window.addEventListener('packswift:planner-loaded',syncBudgetPreference);window.addEventListener('packswift:draft-restored',syncBudgetPreference);
  const extra=el('details');extra.append(el('summary','Travel details · optional'));const passportLabel=form.querySelector('label[for="passport-country"]');while(passportLabel.nextSibling)extra.append(passportLabel.nextSibling);extra.prepend(passportLabel);old[1].append(extra);
  const known=old[2].querySelector('details');if(known&&known!==advanced)stages[2].append(known);
  const stay=el('details');stay.append(el('summary','Stay & travel details · optional'));const grid=el('div');grid.className='studio-pair';for(const[name,title,type]of [['hotelName','Where are you staying?','text'],['arrivalAt','Arrival · destination local time','datetime-local'],['arrivalLocation','Arrival location','text'],['departureAt','Departure · destination local time','datetime-local'],['departureLocation','Departure location','text']]){const l=el('label',title),i=el('input');i.name=name;i.id='stage-'+name;i.type=type;i.maxLength=150;l.append(i);grid.append(l);}stay.append(el('p','Leave blank if not booked. Times use local wall time, without timezone conversion.'),grid);stages[2].append(stay);
  const arrange=el('div');arrange.id='stage-arrangement';stages[2].append(arrange);
  document.querySelector('.studio-dashboard .workspace-nav').hidden=true;document.querySelector('.studio-readiness').hidden=true;document.querySelector('.studio-save-row').hidden=true;
  form.append($('studio-save-status'));
  return stages;
 }
 function context(state,input,remove){
  const root=$('studio-dashboard-content');root.replaceChildren();const i=input();
  if(state.step===1){root.append(el('h3','Your Places'),el('p',state.selected.length+' places added'));if(!state.selected.length)root.append(el('p','No places selected yet. Keep discovering or continue with an empty itinerary.'));for(const p of state.selected){const row=el('div');row.className='stage-tray-row';const b=el('button','Remove');b.type='button';b.setAttribute('aria-label','Remove '+(p.title||p.name));b.onclick=()=>remove(p);row.append(el('span',p.title||p.name),b);root.append(row);}}
  else if(state.step===2){const b=PackSwiftTripContext.budgetSummary(i,state.review);root.append(el('h3','Budget & preparation'),el('p',i.budget>0?`Budget target: ${i.currency} ${i.budget.toLocaleString()}`:'Budget target not set'));for(const c of b.categories)root.append(el('p',c.label+': '+(c.minimum===null?'Not estimated':c.currency+' '+c.minimum.toLocaleString()+(c.maximum!==c.minimum?'–'+c.maximum.toLocaleString():'')+' · '+(c.status==='USER_ENTERED'?'Your cost':'Estimated'))));root.append(el('small','Partial costs only. Unknown prices are not zero; complete affordability cannot be assessed.'),el('p','Map, Packing and Checklist are available in your saved Trip Workspace.'));}
  else root.append(el('p',i.routeType==='domestic'?'Domestic trip · no international border crossing planned.':i.routeType==='international'?'International trip · verify entry guidance before travel.':'Add your origin when you need transport and route guidance.'),el('p','Choose dates so every itinerary day has the correct calendar date. Budget is optional.'));
 }
 function arrange(state,input,refresh,remove){
  const root=$('stage-arrangement'),i=input(),plan=state.itinerary;root.replaceChildren();if(!plan)return;
  root.append(el('p','Suggested times are tentative. Your manual edits are preserved.'));
  const count=Math.round((Date.parse(i.endDate)-Date.parse(i.startDate))/86400000)+1;
  const update=(item,patch)=>{const current=state.itinerary.items.find(i=>i.id===item.id);if(current)Object.assign(current,patch,{userModified:true});refresh();arrange(state,input,refresh,remove);};
  const move=(item,other)=>{const list=state.itinerary.items,a=list.findIndex(i=>i.id===item.id),b=list.findIndex(i=>i.id===other.id);if(a<0||b<0)return;[list[a],list[b]]=[list[b],list[a]];list[a].userModified=true;list[b].userModified=true;refresh();arrange(state,input,refresh,remove);};
  for(const day of [null,...Array.from({length:count},(_,j)=>j+1)]){const rows=plan.items.filter(p=>p.day===day);if(day===null&&!rows.length)continue;const box=el('section');box.className='stage-day';box.append(el('h3',day===null?'Not yet arranged':`Day ${day} · ${PackSwiftTripContext.displayDate(new Date(Date.parse(i.startDate+'T00:00:00Z')+(day-1)*86400000).toISOString().slice(0,10))}`));if(!rows.length)box.append(el('p','Free time · no stops planned.'));
   for(const item of rows){const p=state.selected.find(p=>PackSwiftCanonical.identity(p)===item.selectedPlaceId),title=p?.title||p?.name||item.title||'Custom stop',row=el('article');row.className='stage-stop';row.append(el('h4',title));if(p?.tripType)row.append(el('small',p.tripType.replaceAll('_',' ')));if(item.durationMin)row.append(el('p',`${item.durationMin} min suggested · duration estimate`));if(item.scheduleNote)row.append(el('small',item.scheduleNote));const controls=el('div');controls.className='stage-stop-controls';const dayLabel=el('label','Day'),select=el('select');select.setAttribute('aria-label','Day for '+title);for(const n of [null,...Array.from({length:count},(_,j)=>j+1)]){const o=el('option',n===null?'Unassigned':'Day '+n);o.value=n??'';select.append(o);}select.value=item.day??'';select.onchange=()=>update(item,{day:select.value?Number(select.value):null});dayLabel.append(select);const timeLabel=el('label','Time'),time=el('input');time.type='time';time.value=item.startTime||'';time.setAttribute('aria-label','Time for '+title);time.onchange=()=>update(item,{startTime:time.value});timeLabel.append(time);controls.append(dayLabel,timeLabel);
    for(const[label,delta]of [['Earlier',-1],['Later',1]]){const b=el('button',label);b.type='button';const rowIndex=rows.indexOf(item);b.disabled=!rows[rowIndex+delta];b.onclick=()=>move(item,rows[rowIndex+delta]);controls.append(b);}const del=el('button','Remove');del.type='button';del.setAttribute('aria-label','Remove '+title);del.onclick=()=>{remove(p);arrange(state,input,refresh,remove);};controls.append(del);row.append(controls);box.append(row);
   }root.append(box);
  }
  const label=el('label','Add a custom stop or free time'),title=el('input');title.maxLength=120;title.placeholder='e.g. Free time';label.append(title);const add=el('button','Add custom stop');add.type='button';add.onclick=()=>{if(!title.value.trim())return;state.selected.push({id:'custom:'+crypto.randomUUID(),source:'custom',title:title.value.trim()});refresh();arrange(state,input,refresh,remove);};root.append(label,add);
 }
 function transition(before,after,change){change();if(before!==after){PackSwiftPlannerMotion.animate(after,[{opacity:.6},{opacity:1}],280);after.querySelector('h2')?.focus({preventScroll:true});}}
 return {compose,context,arrange,transition};
})();
