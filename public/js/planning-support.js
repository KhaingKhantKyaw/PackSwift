(() => {
 const form=document.getElementById('trip-planner-form');if(!form)return;
 const $=id=>document.getElementById(id),el=(t,s)=>{const n=document.createElement(t);if(s)n.textContent=s;return n;};
 const hidden=el('input');hidden.type='hidden';hidden.name='planningSupport';hidden.id='planning-support-state';form.append(hidden);
 const read=()=>{try{return JSON.parse(hidden.value||'{}');}catch{return {};}};
 const write=s=>{hidden.value=JSON.stringify(s);hidden.dispatchEvent(new Event('input',{bubbles:true}));};
 const bar=el('section');bar.className='planning-card planning-toolbar';const heading=el('div');heading.append(el('h2','Plan with confidence'),el('p','Choose the help you need. Your trip stays editable.'));
 const guide=el('button','Guide me'),apply=el('button','Use my saved preferences'),print=el('button','Print / save trip summary');[guide,apply,print].forEach(b=>b.type='button');
 const message=el('p');message.setAttribute('role','status');bar.append(heading,guide,apply,print,message);form.before(bar);
 const saveTrip=el('button','Save to My Trips');saveTrip.type='button';bar.insertBefore(saveTrip,message);
 saveTrip.onclick=()=>{const costs=read().costs||{},target=Number(costs.comfortable)||Number(costs.maximum)||Number($('budget').value);if(!target){message.textContent='You can keep planning without a budget. Add a comfortable or maximum budget before saving this trip.';money.querySelector('details').open=true;money.scrollIntoView({behavior:'smooth'});return;}set('budget',target);$('studio-save').click();};
 new MutationObserver(()=>{const status=$('studio-save-status').textContent;if(status)message.textContent=status;}).observe($('studio-save-status'),{childList:true,subtree:true,characterData:true});
 const money=el('section');money.className='planning-card budget-support';money.append(el('h2','Your trip budget'));
 const caption=el('p','Enter whole-trip totals for everyone, in the selected trip currency. Blank means unknown; enter 0 only when no cost applies.');money.append(caption);
 const result=el('div');result.className='budget-result';result.setAttribute('aria-live','polite');money.append(result);
 const details=el('details');details.append(el('summary','Edit costs and spending limits'));const grid=el('div');grid.className='support-fields';
 const labels={flights:'Round-trip flights · all travellers',stay:'Accommodation · all rooms and nights',transfers:'Arrival and departure transfers',food:'Food & drinking water · entire trip',localTransport:'Local transportation',activities:'Activities & admission',other:'Other required costs',reserve:'Optional reserve',comfortable:'Comfortable budget',maximum:'Maximum budget'};
 const controls={};for(const [name,label]of Object.entries(labels)){const l=el('label',label),input=el('input');input.type='number';input.min=0;input.step='.01';input.placeholder='Not known';input.setAttribute('aria-label',label);controls[name]=input;input.onchange=()=>{if(!input.checkValidity())return input.reportValidity();const s=read();s.costs={...s.costs,[name]:input.value};s.costCurrency=$('currency').value;s.costContext=context();write(s);render();};l.append(input);grid.append(l);}details.append(grid);money.append(details);
 const currencyLabel=el('p');money.append(currencyLabel);
 const explain=el('p','Planning estimate, not a booking or a guaranteed minimum. Check baggage, taxes, occupancy, entry costs and insurance before paying.');money.append(explain);form.after(money);
 function context(){return ['origin','destination','startDate','endDate','adults','children'].map(n=>form.elements[n]?.value||'').join('|');}
 function render(){const s=read(),r=PackSwiftPlanningModel.budget(s.costs),currency=$('currency').value;result.replaceChildren();currencyLabel.textContent='Currency: '+currency;for(const [n,input]of Object.entries(controls))if(document.activeElement!==input)input.value=s.costs?.[n]??'';
 const stale=s.costContext&&s.costContext!==context()||s.costCurrency&&s.costCurrency!==currency;
 Object.values(controls).forEach(input=>input.disabled=Boolean(stale));
 if(stale){result.append(el('strong','Trip details changed — recheck your costs.'));const reset=el('button','Clear old costs');reset.type='button';reset.onclick=()=>{const next=read();delete next.costs;delete next.costContext;delete next.costCurrency;write(next);render();};result.append(reset);return;}
 result.append(el('strong',(r.complete?'Your entered estimate: ':'Partial estimate: ')+currency+' '+r.low.toLocaleString()+(r.high>r.low?' · '+r.high.toLocaleString()+' with reserve':'')));
 if(r.missing.length)result.append(el('p','Missing: '+r.missing.map(k=>labels[k].split(' · ')[0]).join(', ')));
 if(r.overLimit)result.append(el('p','Above your maximum. Compare shorter stays, different dates, or fewer paid activities. Savings need fresh prices.'));
 if(s.costs?.comfortable&&r.high>Number(s.costs.comfortable)&&!r.overLimit)result.append(el('p','Above your comfortable budget. Review the biggest costs first.'));
 }
 form.addEventListener('change',render);window.addEventListener('packswift:planner-loaded',render);window.addEventListener('packswift:draft-restored',render);render();
 window.addEventListener('packswift:budget-quote',event=>{
  const quote=event.detail;if(!quote)return;
  const d=el('dialog');d.className='profile-edit-dialog guide-dialog';d.setAttribute('aria-label','Add quoted cost to budget');
  const f=el('form');f.className='guided-form';f.append(el('h2','Add '+(quote.kind==='flights'?'flight':'stay')+' estimate'),el('p',quote.title||'Selected option'),el('p',quote.price+' · '+quote.basis),el('p','Check that this total covers everyone, all dates, baggage or rooms, and applicable fees. This does not reserve anything.'));
  const l=el('label','Whole-trip total in '+quote.currency),amount=el('input');amount.type='number';amount.min=0;amount.step='.01';amount.required=true;l.append(amount);f.append(l);const feedback=el('p');feedback.setAttribute('role','status');f.append(feedback);
  const cancel=el('button','Cancel');cancel.type='button';cancel.onclick=()=>{d.close();d.remove();};const save=el('button','Add estimate');f.append(cancel,save);
  f.onsubmit=e=>{e.preventDefault();if(quote.currency!==$('currency').value){feedback.textContent='Currency changed. Search again before adding a price.';return;}
   if(Object.entries(quote.context||{}).some(([k,v])=>form.elements[k]&&String(form.elements[k].value)!==String(v))){feedback.textContent='Trip details changed. Search again before adding this estimate.';return;}
   const s=read(),key=quote.kind==='flights'?'flights':'stay';
   if(s.costContext&&s.costContext!==context()||s.costCurrency&&s.costCurrency!==quote.currency){feedback.textContent='Clear the old budget costs before adding a new estimate.';return;}
   s.costs={...s.costs,[key]:amount.value};s.quoteNotes={...s.quoteNotes,[key]:{source:quote.title,checkedAt:quote.searchedAt,label:'User-entered total from search option'}};s.costCurrency=quote.currency;s.costContext=context();write(s);render();d.close();d.remove();
  };d.append(f);document.body.append(d);d.showModal();
 });
 function set(name,value){const c=form.elements[name];if(!c||value==null||value==='')return;if(c instanceof RadioNodeList)return;c.value=value;c.dispatchEvent(new Event('input',{bubbles:true}));c.dispatchEvent(new Event('change',{bubbles:true}));}
 let preferences={};
 PackSwift.authReady.then(async user=>{apply.hidden=!user;if(!user)return;try{preferences=(await PackSwift.api('/api/profile/preferences')).preferences||{};}catch{message.textContent='Saved preferences are unavailable. You can still plan manually.';}});
 function applyPrefs(p){
  const styles={'Pocket friendly':'Pocket Friendly','Comfort & value':'Comfort & Value','Full experience':'Full Experience','Ultimate luxury':'Ultimate Luxury'};
  const changes=[['origin',p.homeCity],['currency',p.currency],['travelStyle',styles[p.travelStyle]||p.travelStyle],['accessibility',p.walking==='short'?'limited':null],['pace',p.dailyPace],['dietaryStyle',['vegetarian','vegan','halal'].includes(String(p.diet).toLowerCase())?p.diet.toLowerCase():null]];
  changes.forEach(([n,v])=>set(n,v));
  if(p.interests?.length){set('travelPurposes',JSON.stringify(p.interests));set('travelPurposeCategory',p.interests[0]);}
  const prefs=$('itinerary-preferences-state');if(prefs){let v={};try{v=JSON.parse(prefs.value||'{}');}catch{}if(p.dailyPace)v.tripPace=p.dailyPace;if(p.dayStart)v.preferredDayStart=p.dayStart;if(p.dayEnd)v.preferredDayEnd=p.dayEnd;prefs.value=JSON.stringify(v);prefs.dispatchEvent(new Event('input',{bubbles:true}));}
  const s=read();s.preferences={...s.preferences,...p};write(s);
  // Apply reusable packing additions, not packed status from another journey.
  const packing=$('packing-checklist-state');if(packing){let value={};try{value=JSON.parse(packing.value||'{}');}catch{}value.custom||=[];for(const name of p.packingItems||[])if(!value.custom.some(x=>x.name===name))value.custom.push({id:'personal:'+name,category:'My Items',name,quantity:1,reason:'Your saved essential'});packing.value=JSON.stringify(value);packing.dispatchEvent(new Event('input',{bubbles:true}));}
  message.textContent='Preferences applied. Pace, walking comfort and day length help limit daily stops. Venue accessibility and route conditions still need checking.';
 }
 apply.onclick=()=>{if(confirm('Apply saved preferences to this trip? This may replace its origin, currency, interests and pace.'))applyPrefs(preferences);};
 const presetButton=el('button','Use a packing preset');presetButton.type='button';presetButton.hidden=true;bar.insertBefore(presetButton,message);
 PackSwift.authReady.then(user=>{presetButton.hidden=!user;});
 presetButton.onclick=()=>{
  const d=el('dialog');d.className='profile-edit-dialog guide-dialog';d.setAttribute('aria-label','Choose packing preset');d.append(el('h2','Packing presets'));
  for(const preset of preferences.packingPresets||[]){const b=el('button',preset.name);b.type='button';b.onclick=()=>{const s=read(),old=s.preferences?.packingItems||[];applyPrefs({packingItems:[...new Set([...old,...preset.detail.split(',').map(v=>v.trim()).filter(Boolean)])]});d.close();d.remove();};d.append(b);}
  if(!preferences.packingPresets?.length)d.append(el('p','Create a packing preset in your profile first.'));const close=el('button','Close');close.onclick=()=>{d.close();d.remove();};d.append(close);document.body.append(d);d.showModal();
 };
 const dialog=el('dialog');dialog.className='profile-edit-dialog guide-dialog';dialog.setAttribute('aria-label','Guided trip planning');document.body.append(dialog);
 const steps=[
 {title:'Where would you like to go?',fields:[['origin','Origin city','text'],['destination','Destination city','text']]},
 {title:'When, and with whom?',fields:[['startDate','Start date','date'],['endDate','End date','date'],['adults','Adults · 18+','number'],['children','Children','number']]},
 {title:'What would make this trip easier?',fields:[['guidance','Main concern',['Keeping costs low','Simple transport','Getting lost','I’m not sure']],['walking','Walking comfort',['short','moderate','long']],['dailyPace','Daily pace',['relaxed','balanced','packed']]]},
 {title:'Your spending comfort',fields:[['comfortable','Comfortable total budget','number'],['maximum','Maximum total budget','number']]}
 ];let step=0,answers={};
 function showStep(){dialog.replaceChildren();dialog.append(el('small','Step '+(step+1)+' of '+steps.length),el('h2',steps[step].title));const f=el('form');f.className='guided-form';for(const [name,label,type]of steps[step].fields){const l=el('label',label),c=el(Array.isArray(type)?'select':'input');c.name=name;if(Array.isArray(type)){c.append(new Option('Not sure yet',''));type.forEach(v=>c.append(new Option(v,v)));}else{c.type=type;if(type==='number'){c.min=name==='adults'?1:0;c.max=['adults','children'].includes(name)?20:100000000;}}c.value=answers[name]??form.elements[name]?.value??'';l.append(c);f.append(l);}if(step===3)f.append(el('p','Whole-trip amounts in '+$('currency').value+'. Leave blank if you’re unsure.'));
 const nav=el('div');nav.className='dialog-actions';const back=el('button',step?'Back':'Cancel');back.type='button';back.onclick=()=>{Object.assign(answers,Object.fromEntries(new FormData(f)));if(step){step--;showStep();}else dialog.close();};const next=el('button',step===steps.length-1?'Apply & review':'Continue');nav.append(back,next);f.append(nav);f.onsubmit=e=>{e.preventDefault();Object.assign(answers,Object.fromEntries(new FormData(f)));if(step<steps.length-1){step++;showStep();return;}if(answers.startDate&&answers.endDate&&answers.endDate<=answers.startDate){message.textContent='Return date must be after departure. Please adjust your dates.';step=1;showStep();return;}['origin','destination','startDate','endDate','adults','children'].forEach(n=>set(n,answers[n]));applyPrefs({dailyPace:answers.dailyPace,walking:answers.walking,guidance:answers.guidance});const s=read();s.costs={...s.costs,comfortable:answers.comfortable,maximum:answers.maximum};write(s);render();dialog.close();money.scrollIntoView({behavior:'smooth',block:'start'});};dialog.append(f);}
 guide.onclick=()=>{step=0;answers={};showStep();dialog.showModal();};
 print.onclick=()=>{const d=el('dialog');d.className='trip-print-summary profile-edit-dialog';d.append(el('h2','Your trip summary'));for(const n of ['origin','destination','startDate','endDate','adults','children'])d.append(el('p',n+': '+(form.elements[n]?.value||'Not set')));const b=PackSwiftPlanningModel.budget(read().costs);d.append(el('p',(b.complete?'Entered costs: ':'Partial costs: ')+$('currency').value+' '+b.high),el('h3','Before you go'));['Confirm bookings directly with providers','Keep your accommodation address and contacts','Check entry requirements and required documents','Save your arrival route and an alternative','Check the forecast and packing list'].forEach(x=>d.append(el('p','□ '+x)));const printButton=el('button','Print / save PDF');printButton.onclick=()=>window.print();const close=el('button','Close');close.onclick=()=>{d.close();d.remove();};d.append(printButton,close);document.body.append(d);d.showModal();};
 const params=new URLSearchParams(location.search);if(params.has('destination')&&!params.has('trip_id'))window.addEventListener('packswift:planner-loaded',()=>{if(!form.elements.destination.value)set('destination',params.get('destination'));if(params.get('wish'))message.textContent='Wishlist place: '+params.get('wish')+'. Find and add it in Itinerary.';},{once:true});
})();
