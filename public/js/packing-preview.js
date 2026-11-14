(() => {
 const categories=['Documents & Money','Daily Essentials','Clothing','Footwear','Toiletries','Beauty & Personal Care','Health & Medication','Electronics','Weather Protection','Activity Gear','Travel Comfort','Children & Family','My Items'];
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 let host,field,context,removed,forecast=null,forecastKey='',forecastTimer,forecastController;
 let activeTab='pack',drawSignature='',openCategories=new Set(['Documents & Money','Clothing']);
 const drafts=new Map(),tabScroll=new Map();
 const guidance=()=>window.PackSwiftTravelGuidance;
 const scrollContainer=()=>host?.closest('.reference-preview-card');
 field=document.getElementById('packing-checklist-state');if(!field){field=el('input');field.type='hidden';field.id='packing-checklist-state';field.name='packingChecklist';document.getElementById('trip-planner-form').append(field);}
 if(!document.getElementById('packing-snapshot')){const snapshot=el('input');snapshot.type='hidden';snapshot.id='packing-snapshot';snapshot.name='packingSnapshot';document.getElementById('trip-planner-form').append(snapshot);}
 function loadForecast(input){const key=JSON.stringify([input.destination,input.startDate,input.endDate]);if(key===forecastKey)return;forecastKey=key;forecast=null;clearTimeout(forecastTimer);forecastController?.abort();if(!input.destination||!input.startDate||!input.endDate)return;
  forecastTimer=setTimeout(async()=>{forecastController=new AbortController();try{const response=await fetch('/api/trip-forecast?'+new URLSearchParams({destination:input.destination,startDate:input.startDate,endDate:input.endDate}),{signal:forecastController.signal});if(!response.ok)throw Error();const data=await response.json();if(key===forecastKey){forecast=data;draw();}}catch(error){if(error.name!=='AbortError'&&key===forecastKey){forecast={status:'unavailable',daily:[]};draw();}}},500);
 }
 function weatherSummary(){const box=el('details');box.className='packing-weather';const daily=forecast?.daily||[],summary=el('summary',daily.length?'Weather for '+daily.length+' of '+forecast.totalDays+' trip days':'Trip weather');box.append(summary);
  const copy={loading:'Checking your trip dates…','outside-horizon':'Forecast not available for these dates yet. Check again within 16 days of travel.','not-configured':'Daily forecasts are not configured on this server. Check the forecast before packing.',unavailable:'Forecast unavailable. Suggestions below are general; check local weather before leaving.',partial:'Only the dates below have a forecast. Later days are not predicted.',available:'Forecasts can change. Review again before departure.'};box.append(el('p',copy[forecast?.status||'loading']));
  for(const day of daily)box.append(el('p',day.date+' · '+(day.lowC===null||day.highC===null?'Temperature unavailable':day.lowC+'–'+day.highC+'°C')+' · '+(day.rainProbability===null?'Rain estimate unavailable':day.rainProbability+'% chance of rain')));
  if(daily.length){const source=el('a','Weather: Open-Meteo');source.href='https://open-meteo.com/';source.target='_blank';source.rel='noopener noreferrer';box.append(source,el('small','Checked '+new Date(forecast.checkedAt).toLocaleString()));}return box;
 }
 function read(){try{return JSON.parse(field.value)||{};}catch{return {};}}
 function save(s){field.value=JSON.stringify(s);draw(true);field.dispatchEvent(new Event('input',{bubbles:true}));}
 function suggestions(i,selected){
  let personal={};try{personal=JSON.parse(i.planningSupport||'{}').preferences||{};}catch{}
  const days=Math.max(1,Math.round((Date.parse(i.endDate)-Date.parse(i.startDate))/86400000)+1||1),qty=Math.min(days,personal.laundry==='Every few days'?3:personal.laundry==='No laundry planned'?days:7),items=[];
  const shared=new Set(['Tickets and booking details','Toothpaste','Shampoo / body wash','Basic first-aid supplies','Travel adapter','Child travel essentials']);
  const add=(category,name,quantity=1,reason='Essential')=>items.push({id:category+':'+name,category,name,quantity,reason,scope:shared.has(name)?'shared':'per traveler'});
  add('Documents & Money',i.isInternational===false?'Personal identification':'Passport');add('Documents & Money','Tickets and booking details');add('Documents & Money','Payment cards / cash');
  add('Daily Essentials','Reusable water bottle');add('Daily Essentials','Day bag');
  add('Clothing','Lightweight tops',qty,days+' travel days · adjust for laundry');add('Clothing','Comfortable bottoms',Math.max(1,Math.ceil(qty/3)));add('Clothing','Underwear',qty);add('Clothing','Sleepwear');add('Clothing','Light layer');
  add('Footwear','Comfortable walking shoes');add('Toiletries','Toothbrush');add('Toiletries','Toothpaste');add('Toiletries','Deodorant');add('Toiletries','Shampoo / body wash');
  add('Beauty & Personal Care','Sunscreen');add('Beauty & Personal Care','Personal skincare');
  add('Health & Medication','Personal medication',1,'If needed');add('Health & Medication','Basic first-aid supplies');
  add('Electronics','Phone charger');if(i.isInternational!==false)add('Electronics','Travel adapter',1,'Check destination socket type');
  add('Weather Protection','Compact umbrella',1,'Optional precaution · forecast not verified');
  const daily=forecast?.daily||[],lows=daily.map(d=>d.lowC).filter(Number.isFinite),highs=daily.map(d=>d.highC).filter(Number.isFinite);
  if(daily.some(d=>Number.isFinite(d.rainProbability)&&d.rainProbability>=50))add('Weather Protection','Rain jacket',1,'Rain possible on forecast trip dates');
  if(lows.length&&Math.min(...lows)<=12)add('Clothing','Warm outer layer',1,'Cool temperatures on forecast trip dates');
  if(lows.length&&Math.min(...lows)<=4)add('Clothing','Warm hat and gloves',1,'Cold temperatures on forecast trip dates');
  if(highs.length&&Math.max(...highs)>=28)add('Weather Protection','Sun hat',1,'Warm temperatures on forecast trip dates');
  const interests=String(i.travelPurposes||i.travelPurposeCategory||'');
  const places=selected.map(p=>p.title||p.name||'').join(' ');
  if(/Water|Marine|beach|swim/i.test(interests+' '+places))add('Activity Gear','Swimwear',1,'Water activities');
  if(/Nature|Outdoor|hiking|trail/i.test(interests+' '+places))add('Activity Gear','Outdoor footwear',1,'Outdoor activities');
  if(/temple|pagoda|mosque/i.test(places))add('Clothing','Shoulder and knee covering',1,'Religious visits · confirm venue dress rules');
  if(Number(i.children)>0)add('Children & Family','Child travel essentials',Number(i.children));
  add('Travel Comfort','Eye mask / earplugs',1,'Optional');
  for(const name of personal.packingItems||[])if(!items.some(x=>x.name===name))add('My Items',name,1,'Your saved essential');
  const excluded=String(personal.packingExclusions||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  return items.filter(x=>!excluded.includes(x.name.toLowerCase()));
 }
 const button=(text,action,key)=>{const b=el('button',text);b.type='button';b.onclick=action;if(key)b.dataset.packingFocus=key;return b;};
 function switchTab(id,focus=false){
  const scroller=scrollContainer();if(scroller)tabScroll.set(activeTab,scroller.scrollTop);
  activeTab=id;draw(true);if(scroller)scroller.scrollTop=tabScroll.get(id)||0;
  if(focus)document.getElementById('packing-tab-'+id)?.focus({preventScroll:true});
 }
 function draw(force=false){
  if(!context||!host)return;
  const {input,selected}=context,s=read();s.edits||={};s.dismissed||=[];s.custom||=[];
  const items=[...suggestions(input,selected),...s.custom].filter(x=>!s.dismissed.includes(x.id)).map(x=>({...x,...s.edits[x.id]}));
  document.getElementById('packing-snapshot').value=JSON.stringify(items.map(item=>({id:item.id,name:item.name,category:item.category,quantity:item.quantity,packed:Boolean(item.packed),reason:[item.scope||'Custom quantity',item.reason].filter(Boolean).join(' · ')})));
  const detailed=guidance()?.getMode()==='detailed',tasks=guidance()?.getTasks()||[];
  const signature=JSON.stringify([items,input.destination,input.startDate,input.endDate,forecast,activeTab,detailed,tasks,removed]);
  if(!force&&drawSignature===signature)return;drawSignature=signature;
  const focus=document.activeElement,focusKey=host.contains(focus)?focus.dataset.packingFocus:null,selection=focusKey&&focus.tagName==='INPUT'&&focus.type==='text'?[focus.selectionStart,focus.selectionEnd]:null;
  const scroller=scrollContainer(),scrollTop=scroller?.scrollTop||0;
  host.querySelectorAll('[data-category]').forEach(section=>section.open?openCategories.add(section.dataset.category):openCategories.delete(section.dataset.category));
  host.replaceChildren();host.dataset.guidanceMode=detailed?'detailed':'quick';
  const top=el('div');top.className='packing-essentials-top';
  const count=el('p',items.filter(x=>x.packed).length+' / '+items.length+' packed');count.className='packing-progress-text';count.setAttribute('role','status');
  const mode=button(detailed?'More guidance':'Quick view',()=>guidance()?.setLevel(detailed?'quick':'detailed'),'mode');mode.className='packing-guidance-switch';mode.setAttribute('aria-label',detailed?'Switch to Quick view':'Switch to More guidance');top.append(count,mode);host.append(top);
  const tabs=el('div');tabs.className='packing-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Packing and trip essentials');
  const definitions=[['pack','What to pack'],['how','How to pack'],['prepare','Before you go']];
  definitions.forEach(([id,label],index)=>{const tab=button(label,()=>switchTab(id),'tab-'+id);tab.id='packing-tab-'+id;tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(activeTab===id));tab.setAttribute('aria-controls','packing-tabpanel');tab.tabIndex=activeTab===id?0:-1;tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:-1)+3)%3;switchTab(definitions[next][0],true);};tabs.append(tab);});host.append(tabs);
  const content=el('div');content.id='packing-tabpanel';content.className='packing-tabpanel';content.setAttribute('role','tabpanel');content.setAttribute('aria-labelledby','packing-tab-'+activeTab);content.tabIndex=0;host.append(content);
  if(activeTab==='pack')drawPacking(content,items,input,detailed);
  else if(activeTab==='how')drawTips(content,input,selected,detailed);
  else drawPreparation(content,tasks,detailed);
  if(focusKey){const replacement=[...host.querySelectorAll('[data-packing-focus]')].find(n=>n.dataset.packingFocus===focusKey);if(replacement){replacement.focus({preventScroll:true});if(selection)replacement.setSelectionRange(...selection);}else if(removed)host.querySelector('[data-packing-focus="undo"]')?.focus({preventScroll:true});}
  if(scroller)scroller.scrollTop=scrollTop;
 }
 function drawPacking(content,items,input,detailed){
  content.append(el('small','Quantities are per traveler unless marked shared. Adjust for your group and laundry plans.'),weatherSummary());
  if(detailed){const tip=el('p','Start with documents and daily essentials, then work through each category. Remove anything you do not need.');tip.className='packing-help-note';content.append(tip);}
  if(removed)content.append(button('Undo removal',()=>{const state=read();state.dismissed=(state.dismissed||[]).filter(id=>id!==removed);removed=null;save(state);},'undo'));
  for(const category of categories){
   if(category==='Children & Family'&&!Number(input.children)&&!items.some(x=>x.category===category))continue;
   const section=el('details');section.dataset.category=category;section.open=openCategories.has(category);section.ontoggle=()=>{if(section.isConnected)section.open?openCategories.add(category):openCategories.delete(category);};
   const entries=items.filter(x=>x.category===category),summary=el('summary'),icon=el('span');icon.className='packing-category-icon';icon.setAttribute('aria-hidden','true');
   const symbols={'Documents & Money':'wallet','Daily Essentials':'bag','Clothing':'bag','Footwear':'map','Toiletries':'bag','Beauty & Personal Care':'pet','Health & Medication':'people','Electronics':'sliders','Weather Protection':'globe','Activity Gear':'map','Travel Comfort':'plane','Children & Family':'people','My Items':'bag'};
   icon.append(window.PackSwiftWorkspace.icon(symbols[category]||'bag'));summary.append(icon,el('span',category),el('small',entries.filter(x=>x.packed).length+'/'+entries.length));section.append(summary);
   for(const item of entries){
    const row=el('div');row.className='packing-item';const check=el('input');check.type='checkbox';check.checked=!!item.packed;check.setAttribute('aria-label','Packed '+item.name);check.dataset.packingFocus='check-'+item.id;
    const name=el('input');name.type='text';name.value=item.name;name.maxLength=100;name.setAttribute('aria-label','Item name: '+item.name);name.dataset.packingFocus='name-'+item.id;
    const quantity=el('input');quantity.type='number';quantity.min=1;quantity.max=99;quantity.value=item.quantity;quantity.setAttribute('aria-label','Quantity for '+item.name);quantity.dataset.packingFocus='qty-'+item.id;
    const update=()=>{const state=read();state.edits||={};state.edits[item.id]={name:name.value.trim()||item.name,quantity:Math.min(99,Math.max(1,Number(quantity.value)||1)),packed:check.checked};save(state);};
    check.onchange=name.onchange=quantity.onchange=update;
    const remove=button('×',()=>{const state=read();state.dismissed=[...new Set([...(state.dismissed||[]),item.id])];removed=item.id;save(state);},'remove-'+item.id);remove.setAttribute('aria-label','Remove '+item.name);
    row.append(check,name,quantity,remove);section.append(row);const note=el('small',(item.scope==='shared'?'Shared group quantity':item.scope==='per traveler'?'Per traveler':'Your custom quantity')+' · '+(item.reason||'Your item'));note.className='packing-quantity-note';section.append(note);
   }
   const addRow=el('div');addRow.className='packing-add';const custom=el('input');custom.placeholder='Add an item';custom.maxLength=100;custom.value=drafts.get(category)||'';custom.dataset.packingFocus='add-'+category;custom.setAttribute('aria-label','New item in '+category);custom.oninput=()=>drafts.set(category,custom.value);
   const insert=()=>{if(!custom.value.trim())return;const state=read();state.custom||=[];state.custom.push({id:'custom:'+crypto.randomUUID(),category,name:custom.value.trim(),quantity:1});drafts.delete(category);save(state);};
   const add=button('Add',insert,'insert-'+category);custom.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();insert();}};addRow.append(custom,add);section.append(addRow);content.append(section);
  }
 }
 function drawTips(content,input,selected,detailed){
  const title=el('h3','Pack for your days, not every possibility');content.append(title);
  const tips=[['wallet','Keep essentials easy to reach','Put travel documents, booking details, your phone and the essentials you need on the journey in an accessible bag.'],['bag','Organize small items','Group toiletries and cables in separate pouches. Use leak-resistant containers and keep a little space for the journey home.'],['bag','Plan outfits around your activities','Choose layers and comfortable footwear you can reuse. Adjust clothing quantities for your trip length and laundry plans.']];
  const purposes=String(input.travelPurposes||'')+' '+selected.map(p=>p.title||p.name||'').join(' ');
  if(/Nature|Outdoor|hiking|trail|Water|Marine|beach|swim/i.test(purposes))tips.push(['map','Prepare a day bag','Keep water, weather protection and the gear for your chosen activities together. Check any activity-specific requirements with the venue.']);
  if(Number(input.children)>0)tips.push(['people','Keep family essentials together','Pack the items your children need on the journey where you can reach them, and check quantities for each traveler.']);
  if((forecast?.daily||[]).some(d=>Number.isFinite(d.rainProbability)&&d.rainProbability>=50))tips.push(['globe','Make rain protection accessible','Rain is possible on some forecast trip days. Keep your preferred rain layer or umbrella near the top of your day bag.']);
  else tips.push(['globe','Check weather before closing your bag','Use the trip forecast in What to pack. When your dates are not covered yet, recheck closer to departure rather than treating general suggestions as a forecast.']);
  if(input.tripType!=='local')tips.push(['plane','Check your carrier’s bag rules','Review the rules for your exact ticket, baggage and items before departure. Allowances and restrictions can differ between carriers and routes.']);
  for(const [symbol,heading,copy] of tips){const row=el('details');row.className='packing-tip';row.open=detailed;const summary=el('summary'),icon=el('span');icon.className='packing-tip-icon';icon.setAttribute('aria-hidden','true');icon.append(window.PackSwiftWorkspace.icon(symbol));summary.append(icon,el('span',heading));row.append(summary,el('p',copy));content.append(row);}
 }
 function drawPreparation(content,tasks,detailed){
  const checked=tasks.filter(t=>t.checked).length,status=el('p',checked+' / '+tasks.length+' preparations checked');status.className='preparation-progress';status.setAttribute('role','status');content.append(status);
  const progress=el('progress');progress.max=tasks.length||1;progress.value=checked;progress.setAttribute('aria-label','Your preparation checklist progress');content.append(progress,el('small','Your own checks — not booking confirmation or travel clearance.'));
  if(tasks.some(task=>guidance()?.read().preparation[task.id]&&!task.checked)){const changed=el('p','Trip details changed. Recheck the affected items below.');changed.className='packing-help-note';content.append(changed);}
  for(const task of tasks){const row=el('div');row.className='preparation-item';const label=el('label'),check=el('input');check.type='checkbox';check.checked=task.checked;check.dataset.packingFocus='prepare-'+task.id;check.setAttribute('aria-label',task.title);check.onchange=()=>{const preparation={...guidance().read().preparation};if(check.checked)preparation[task.id]=task.context;else delete preparation[task.id];guidance().update({preparation});};label.append(check,el('span',task.title));const details=el('details');details.open=detailed;details.append(el('summary','What to check'),el('p',task.detail));
   const actions={bookings:['Review flights & stays',()=>showPanel('Flight & Stay')],arrival:['Edit arrival details',()=>{const panel=showPanel('Itinerary');const tools=panel?.querySelector('.itinerary-existing-tools');if(tools)tools.open=true;panel?.querySelector('[name="arrivalLocation"]')?.focus();}],offline:['Print / save trip summary',()=>window.dispatchEvent(new Event('packswift:print-summary'))],weather:['See trip forecast',()=>{switchTab('pack');const weather=host.querySelector('.packing-weather');if(weather){weather.open=true;weather.querySelector('summary').focus({preventScroll:true});}}]};
   if(actions[task.id]){const [title,action]=actions[task.id],control=button(title,action,'action-'+task.id);control.className='preparation-shortcut';details.append(control);}
   row.append(label,details);content.append(row);}
 }
 function showPanel(title){const root=document.getElementById('studio-dashboard-content'),panel=[...root.querySelectorAll('[data-preview-section]')].find(n=>n.dataset.previewSection===title);if(!panel)return;root.querySelector('.is-expanded .preview-expand')?.click();panel.open=true;panel.scrollIntoView({behavior:'auto',block:'center'});return panel;}
 window.PackSwiftPackingPreview={applySavedProgress(items){let snapshot=[];try{snapshot=JSON.parse(document.getElementById('packing-snapshot').value||'[]');}catch{}const state=read();state.edits||={};for(const item of snapshot){const saved=items.find(p=>p.itemName===item.name&&p.category===item.category);if(saved&&item.id)state.edits[item.id]={...state.edits[item.id],packed:Boolean(saved.completed)};}field.value=JSON.stringify(state);},mount(parent,input,selected){
  if(!host){host=el('section');host.className='packing-checklist packing-essentials';for(const event of ['packswift:draft-restored','packswift:planner-loaded','packswift:guidance-changed'])window.addEventListener(event,()=>draw());}
  context={input,selected};loadForecast(input);if(host.parentElement!==parent)parent.replaceChildren(host);draw();
 }};
})();
