(() => {
  'use strict';
  const $=s=>document.querySelector(s),root=$('#user-dashboard'),status=$('#dashboard-status');
  const tripMode=document.body.dataset.page==='trip-hub';
  let notesOpen=false;
  const openDays=new Set([1]);
  const tabs=['overview','itinerary','budget','packing','help'];
  let activeTab=new URLSearchParams(location.search).get('tab')||'overview';
  if(!tabs.includes(activeTab))activeTab='overview';
  const requestedTrip=tripMode?location.pathname.split('/').filter(Boolean)[1]:'';
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const link=(text,href,primary=false)=>{const a=el('a',text,'dashboard-link'+(primary?' dashboard-primary':''));a.href=href;return a;};
  const external=(text,url)=>{const a=link(text+' ↗',url);a.target='_blank';a.rel='noopener noreferrer';return a;};
  const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
  const section=(title,id)=>{const s=el('section',null,'dashboard-section');if(id)s.id=id;s.append(el('h2',title));return s;};
  const note=(s,text)=>s.append(el('p',text,'dashboard-note'));
  const actions=(...nodes)=>{const d=el('div',null,'dashboard-actions');d.append(...nodes);return d;};
  const field=(form,name,label,type='text',value='',max=160)=>{
    const l=el('label',label),i=el(type==='textarea'?'textarea':'input');i.name=name;
    if(type!=='textarea')i.type=type;i.value=value||'';i.maxLength=max;l.append(i);form.append(l);return i;
  };
  const select=(form,name,label,values,value)=>{const l=el('label',label),s=el('select');s.name=name;for(const v of values)s.append(new Option(v,v));s.value=values.includes(value)?value:values[0];l.append(s);form.append(l);return s;};
  const currencies=['USD','THB','MMK','EUR','GBP','SGD','JPY','KRW','VND','CNY','AUD','CAD','INR','MYR','IDR','PHP','CHF','NZD','AED'];
  const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};
  const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(v+'T00:00:00Z')):'Dates not set';
  const money=(n,c)=>new Intl.NumberFormat('en',{style:'currency',currency:/^[A-Z]{3}$/.test(c)?c:'USD',currencyDisplay:'code',maximumFractionDigits:2}).format(n);
  const safeURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
  let state,trips=[],selected='',workspace=null,prefs={},busy=false,workspaceSeq=0,submitting=null;
  const weatherCache=new Map();
  const emergencyResults=new Map();
  function captureForms(except){
    return [...root.querySelectorAll('form[data-dirty]')].filter(f=>f!==except).map(f=>({key:f.dataset.formKey,editId:f.dataset.editId||'',values:[...f.elements].filter(e=>e.name).map(e=>({name:e.name,value:e.value,checked:e.checked})),open:f.closest('details')?.open}));
  }
  function restoreForms(drafts){
    for(const draft of drafts){const f=[...root.querySelectorAll('form')].find(f=>f.dataset.formKey===draft.key);if(!f)continue;f.dataset.editId=draft.editId;
      for(const v of draft.values){const input=f.elements[v.name];if(input){input.value=v.value;if(input.type==='checkbox')input.checked=v.checked;}}
      f.dataset.dirty='true';if(f.closest('details'))f.closest('details').open=draft.open;
      if(f.elements.scope)f.elements.scope.dispatchEvent(new Event('change'));
    }
  }
  const current=()=>trips.find(t=>t.tripId===selected);
  const path=(tab='')=>'/trips/'+encodeURIComponent(selected)+(tab?'?tab='+({requirements:'help'}[tab]||tab):'');
  const planner=()=>'/trip-planner?trip_id='+encodeURIComponent(selected);
  const journey=()=>{const d=current()?.details||{};return JSON.stringify([d.origin,d.destination,d.start,d.end,d.tripType]);};
  function feedback(text){status.textContent=text;}
  async function save(change){
    if(busy)return false;busy=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);feedback('Saving…');
    try{const next=structuredClone(state);change(next);state=(await PackSwift.api('/api/profile/dashboard',{method:'PUT',body:JSON.stringify(next)})).dashboard;const drafts=captureForms(submitting);if(submitting)submitting.removeAttribute('data-dirty');render(drafts);feedback('Saved to your account.');return true;}
    catch(e){feedback(e.message+' Your changes have not been saved.');if(e.status===409)status.append(button('Load latest saved data',async()=>{try{const drafts=captureForms();state=(await PackSwift.api('/api/profile/dashboard')).dashboard;render(drafts);feedback('Latest saved data loaded. Your unfinished forms are kept; review before saving again.');}catch(error){feedback(error.message);}}));return false;}
    finally{busy=false;root.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  function formSection(parent,title){const d=el('details'),summary=el('summary',title),f=el('form',null,'dashboard-form');f.dataset.formKey=title;d.append(summary,f);parent.append(d);return f;}
  function submit(f,text,fn){const b=el('button',text,'dashboard-primary');b.type='submit';f.append(b);f.onsubmit=async e=>{e.preventDefault();if(busy||submitting||!f.reportValidity())return;submitting=f;try{const pending=fn(Object.fromEntries(new FormData(f)));[...f.elements].forEach(e=>e.disabled=true);await pending;}finally{[...f.elements].forEach(e=>e.disabled=false);submitting=null;}};}
  function rows(parent,items,draw,empty){const list=el('div',null,'dashboard-list');list.tabIndex=0;list.setAttribute('aria-label',empty);if(!items.length)note(list,empty);for(const item of items){const row=el('div',null,'dashboard-row');draw(row,item);list.append(row);}parent.append(list);}
  function remove(key,id){if(confirm('Remove this saved item?'))save(s=>{s[key]=s[key].filter(v=>v.id!==id);});}
  function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const resources={
    thailand:{guide:'https://www.tourismthailand.org/',visa:'https://www.thaievisa.go.th/'},
    vietnam:{guide:'https://vietnam.travel/',visa:'https://evisa.gov.vn/'},
    japan:{guide:'https://www.japan.travel/en/plan/',visa:'https://www.mofa.go.jp/j_info/visit/visa/index.html'}
  };
  let guidePromise;
  async function loadLocalGuide(container,destination){
    try{
      guidePromise||=fetch('/data/destinations.json').then(r=>{if(!r.ok)throw Error();return r.json();}).catch(()=>[]);
      const list=await guidePromise,city=list.find(v=>v.name.toLowerCase()===destination.split(',')[0].trim().toLowerCase());
      if(!container.isConnected)return;
      if(city){container.append(el('h3','Local planning notes'));for(const text of city.culturalNotes||[])note(container,text);if(city.attractions?.length)note(container,'Places to explore: '+city.attractions.join(' · '));note(container,'Guide notes only. Confirm hours, fares and entry rules.');}
      else note(container,'City guide unavailable. Use your arrival details and checklist below.');
    }catch{if(container.isConnected)note(container,'Local guide could not load. Your trip details remain available.');}
  }
  async function loadWeather(container,refresh=false){
    const d=current().details,key=journey();container.append(el('h3','Trip weather'));
    if(!d.start||!d.end){note(container,'Add your travel dates to see a forecast.');return;}
    if(d.end<today()||Date.parse(d.start)>Date.parse(today())+15*86400000){note(container,d.end<today()?'This trip is in the past. No live forecast is shown.':'Your dates are beyond the forecast horizon. Check again within 16 days of departure.');return;}
    if(refresh)weatherCache.delete(key);
    let record=weatherCache.get(key);
    if(!record||record.expires<Date.now()){
      record={expires:Date.now()+30*60000,promise:PackSwift.api('/api/trip-forecast?'+new URLSearchParams({destination:d.destination,startDate:d.start,endDate:d.end})).catch(()=>({status:'unavailable',daily:[]}))};weatherCache.set(key,record);
    }
    note(container,'Checking the forecast…');const data=await record.promise;if(!container.isConnected)return;
    container.replaceChildren(el('h3','Trip weather'));
    if(['available','partial'].includes(data.status)&&Array.isArray(data.daily)){
      note(container,(data.status==='partial'?'Partial forecast · ':'Forecast · ')+data.coveredDays+' of '+data.totalDays+' trip days covered');
      rows(container,data.daily,(row,day)=>{row.append(el('strong',date(day.date)),el('span',(Number.isFinite(day.lowC)?day.lowC:'—')+'–'+(Number.isFinite(day.highC)?day.highC:'—')+' °C'+(Number.isFinite(day.rainProbability)?' · '+day.rainProbability+'% rain chance':'')));},'Trip-date forecast');
      const days=data.daily;
      if(days.some(v=>v.rainProbability>=50))note(container,'Packing suggestion: rain protection and a waterproof bag for essentials.');
      if(days.some(v=>v.highC>=28))note(container,'Suggested wear: light layers, sun protection and comfortable breathable footwear.');
      if(days.some(v=>Number.isFinite(v.lowC)&&v.lowC<15))note(container,'Suggested wear: a warm outer layer for cooler mornings and evenings.');
      note(container,'Suggestions cover forecast days only; conditions can change.');
    }else note(container,({ 'outside-horizon':'Your dates are not covered by the available forecast.','not-configured':'The weather service is not configured for this deployment.'})[data.status]||'Forecast unavailable. Try again later; no seasonal average is substituted.');
    if(data.checkedAt)note(container,'Checked '+new Date(data.checkedAt).toLocaleString());
    container.append(actions(external('Weather source','https://open-meteo.com/'),button('Refresh weather',()=>{container.replaceChildren();loadWeather(container,true);})));
  }
  async function mutateTrip(change){
    if(busy||!workspace)return;busy=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);feedback('Saving trip changes…');
    try{workspace=await PackSwift.api('/api/trips/'+encodeURIComponent(selected)+'/workspace?hydrate=0',{method:'PATCH',body:JSON.stringify({...change,revision:workspace.workspace?.revision||0})});if(workspace.details)current().details=workspace.details;const drafts=captureForms(submitting);if(submitting)submitting.removeAttribute('data-dirty');render(drafts);feedback('Saved.');return true;}
    catch(e){render();feedback('Trip changes were not saved: '+e.message);if(e.status===409)status.append(button('Load latest trip',async()=>{if(await loadWorkspace())feedback('Latest trip loaded. Review your unsaved changes before saving.');}));return false;}
    finally{busy=false;root.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  function destinationResource(){const d=current()?.details||{},r=PackSwiftCurrency.resolve({name:d.destination,country:d.country});return {country:r.country||d.country||'',resource:resources[(r.country||d.country||'').toLowerCase()]};}
  function renderHero(){
    const s=section('My next trip','dashboard-trip'),t=current();
    if(!t){s.classList.add('dashboard-empty');note(s,'No saved trips yet.');s.append(link('Plan my first trip','/trip-planner',true));root.append(s);return;}
    const d=t.details,pick=el('div'),chooser=select(pick,'trip','Viewing trip',trips.map(v=>v.tripId),selected);
    [...chooser.options].forEach((o,i)=>o.textContent=trips[i].details.destination+' · '+date(trips[i].details.start));
    chooser.onchange=()=>{if(busy||(root.querySelector('[data-dirty]')&&!confirm('Switch trips and discard the unsaved form changes?'))){chooser.value=selected;return;}selected=chooser.value;workspace=null;render();loadWorkspace();};
    if(tripMode)s.replaceChildren();else s.replaceChildren(pick);const hero=el('div',null,'dashboard-hero'),intro=el('div'),next=el('div');
    const phase=d.end&&d.end<today()?'Past trip':d.start&&d.start<=today()?'Traveling now':'Upcoming trip';
    intro.append(el('span',phase,'dashboard-chip'),el('h2',tripMode?'Overview':d.destination),...(!tripMode?[el('p',date(d.start)+' – '+date(d.end))]:[]),el('p',[d.origin&&'From '+d.origin,(d.adults||1)+' adults',d.children?d.children+' children':'',d.nights+' nights'].filter(Boolean).join(' · ')));
    if(d.start&&d.start>today())intro.append(el('p',Math.round((Date.parse(d.start)-Date.parse(today()))/86400000)+' days to go'));
    intro.append(actions(link('Edit trip details',planner()),button('Save offline trip',async()=>{
      if(!workspace){feedback('Wait for the saved itinerary and packing list to load, then try again.');return;}
      if(!emergencyResults.has(journey()))try{const data=await PackSwiftEmergencyDirectory.load();emergencyResults.set(journey(),PackSwiftEmergencyDirectory.lookup(data,destinationResource().country));}catch{}
      const r=emergencyResults.get(journey()),contacts=[...(r?.contacts||[]).map(c=>({name:r.name+' · '+c.service,phone:c.number,source:c.source+' · reviewed '+c.verifiedAt+' · '+r.status+' · '+c.dialing})),...state.contacts.filter(c=>c.tripId===selected)];
      if(!r?.contacts.length&&!confirm('Verified emergency numbers are not loaded for this trip. Download the itinerary and personal contacts anyway?'))return;
      download('packswift-private-trip.txt',PackSwiftDashboardTools.summary({trip:current(),workspace,expenses:state.expenses.filter(e=>e.tripId===selected),contacts}));
    })));
    next.append(el('h3','Your next steps'));
    const tasks=[];
    if(d.budget==null)tasks.push(['Add your planned costs',path('budget')]);
    const reviewed=state.entryChecks.some(v=>v.tripId===selected&&v.reviewed&&v.journey===journey());
    if(!reviewed&&d.tripType!=='local')tasks.push(['Review entry requirements',path('help')+'#dashboard-entry']);
    if(!(workspace?.workspace?.itineraryReviewedAt))tasks.push(['Review your day-by-day itinerary',path('itinerary')]);
    if(tasks.length<3)tasks.push(['Check packing and departure essentials',path('packing')]);
    for(const [label,url]of tasks.slice(0,3))next.append(actions(link(label+' →',url)));
    const support=el('div'),level=select(support,'experience','Travel experience (optional)',['Not set','My first trip','I have traveled before'],state.experience==='first'?'My first trip':state.experience==='experienced'?'I have traveled before':'Not set');
    level.onchange=()=>save(s=>{s.experience=level.value==='My first trip'?'first':level.value==='I have traveled before'?'experienced':'';});
    next.append(support);
    if(state.experience==='first')note(next,'Start with the first step. Check documents before booking and keep travel details offline.');
    note(next,'Reminders only—not booking or entry confirmation.');
    hero.append(intro,next);s.append(hero);root.append(s);
  }
  function renderTrips(){
    const s=section('✈ My Trips','dashboard-trips'),filters=el('div');
    const filter=select(filters,'filter','Show trips',['All trips','Upcoming','Past']);s.append(filters);
    const list=el('div');s.append(list);
    const draw=()=>{list.replaceChildren();const values=trips.filter(t=>filter.value==='All trips'||(filter.value==='Past'?t.details.end&&t.details.end<today():!t.details.end||t.details.end>=today()));
      rows(list,values,(row,t)=>{const info=el('div');info.append(el('strong',t.details.destination),el('small',date(t.details.start)+' – '+date(t.details.end)));row.append(info,actions(link('Open trip','/trips/'+encodeURIComponent(t.tripId)),button('Delete',async()=>{if(!confirm('Delete your '+t.details.destination+' trip? This cannot be undone.'))return;try{await PackSwift.api('/api/trips/'+encodeURIComponent(t.tripId),{method:'DELETE'});trips=trips.filter(v=>v.tripId!==t.tripId);selected=(trips.find(v=>!v.details.end||v.details.end>=today())||trips.at(-1))?.tripId||'';render();feedback('Trip deleted.');}catch(e){feedback('Trip was not deleted: '+e.message);}})));},'No trips in this view.');};
    filter.onchange=draw;draw();root.append(s);
  }
  function renderBudget(){
    const group=el('div',null,'dashboard-split'),s=section('◈ Budget & expenses','dashboard-budget'),d=current().details,c=state.currency;
    note(s,'Planned trip total');s.append(el('strong',d.budget==null?'Not added yet':money(d.budget,d.currency),'dashboard-metric'));
    const parts=d.budgetBreakdown||{};
    for(const [key,label]of [['flights','Flights · trip total'],['stay','Stay · trip total'],['daily','Daily spending × '+(d.nights+1)+' days']]){
      note(s,label+': '+(parts[key]==null?'Not added':money(parts[key]*(key==='daily'?d.nights+1:1),d.currency)));
    }
    if(tripMode){
      const costs=formSection(s,'Edit planned costs'),fields=el('div',null,'dashboard-fields');costs.append(fields);
      for(const [key,label]of [['flights','Flights · total'],['stay','Stay · total'],['daily','Daily spending · everyone per day']]){const i=field(fields,key,label,'number',parts[key]??'');i.min='0';i.max='1000000000';i.step='.01';if(parts[key]===0)i.value='0';}
      note(costs,'Trip currency: '+d.currency+'. Leave unknown costs blank.');
      submit(costs,'Save planned costs',v=>mutateTrip({action:'costs',costs:Object.fromEntries(Object.entries(v).map(([k,value])=>[k,value===''?null:Number(value)]))}));
      s.append(actions(link('Search flights & stays',planner()+'#preview-flight-stay')));
    }
    const entries=state.expenses.filter(v=>v.tripId===selected),totals=new Map();
    for(const e of entries)totals.set(e.currency,(totals.get(e.currency)||0)+e.amount);
    note(s,'Actual spending · recorded amounts, not booking confirmations');
    if(!totals.size)note(s,'No expenses recorded.');
    for(const [currency,total]of totals)s.append(el('strong',money(total,currency),'dashboard-metric'));
    if(d.budget!=null&&totals.has(d.currency)){const diff=d.budget-totals.get(d.currency);note(s,(diff>=0?'Remaining against plan: ':'Over planned budget: ')+money(Math.abs(diff),d.currency)+(totals.size>1?' · excludes other currencies':''));}
    if(totals.size>1)note(s,'Original totals are separated by currency.');
    const combined=el('div');combined.setAttribute('role','status');s.append(actions(button('Calculate combined estimate',async()=>{
      combined.textContent='Converting recorded expenses…';
      try{
        if(totals.size>20)throw Error('Too many currencies to convert at once.');
        const rates=await Promise.all([...totals].map(async([currency,amount])=>{
          if(currency===c)return {amount,updated:null};
          const r=await PackSwift.api('/api/trips/currency-rate?'+new URLSearchParams({base:currency,target:c}));
          if(!Number.isFinite(r.rate)||r.rate<=0)throw Error('A currency rate is unavailable.');
          return {amount:amount*r.rate,updated:r.updated};
        }));
        if(!combined.isConnected)return;
        const total=rates.reduce((n,r)=>n+r.amount,0),dates=rates.map(r=>r.updated).filter(Boolean).sort();
        combined.replaceChildren(el('strong','Estimated total: '+money(total,c),'dashboard-metric'));
        note(combined,dates.length?'Oldest rate update: '+dates[0]:'No conversion needed.');
        if(d.budget!=null){
          let budget=d.budget;
          if(d.currency!==c){const r=await PackSwift.api('/api/trips/currency-rate?'+new URLSearchParams({base:d.currency,target:c}));if(!Number.isFinite(r.rate)||r.rate<=0)throw Error('Budget rate unavailable.');budget*=r.rate;note(combined,'Budget conversion updated: '+r.updated);}
          note(combined,(budget>=total?'Estimated remaining: ':'Estimated over budget: ')+money(Math.abs(budget-total),c));
        }
        note(combined,'Current-rate estimate; fees excluded. Original amounts stay unchanged.');
      }catch(e){if(combined.isConnected)combined.textContent='Combined estimate unavailable: '+e.message+' No missing rate is treated as zero.';}
    })));s.append(combined);
    const f=formSection(s,'＋ Add or edit an expense'),fields=el('div',null,'dashboard-fields');f.append(fields);
    field(fields,'date','Date','date',today()).required=true;
    select(fields,'category','Category',['Flights','Stay','Food','Transport','Activities','Other']);
    const amount=field(fields,'amount','Amount','number');amount.min='0.01';amount.max='1000000000';amount.step='0.01';amount.required=true;
    select(fields,'currency','Original currency',[...new Set([c,d.currency,...currencies])],c);
    const scope=select(fields,'scope','Expense scope',['Personal','Shared total']);
    const people=field(fields,'peopleCount','Split equally between people','number','1');people.min='1';people.max='30';people.step='1';people.parentElement.hidden=true;
    scope.onchange=()=>{people.parentElement.hidden=scope.value!=='Shared total';people.required=scope.value==='Shared total';if(scope.value!=='Shared total')people.value='1';};
    field(fields,'note','Description (optional)');
    submit(f,'Save expense',v=>save(s=>{const entry={...v,id:f.dataset.editId||crypto.randomUUID(),tripId:selected,amount:Number(v.amount),peopleCount:v.scope==='Shared total'?Number(v.peopleCount):1};s.expenses=s.expenses.filter(e=>e.id!==entry.id);s.expenses.push(entry);}));
    rows(s,entries,(row,e)=>{const info=el('div');info.append(el('strong',money(e.amount,e.currency)+' · '+e.category),el('small',date(e.date)+' · '+e.scope+(e.note?' · '+e.note:'')));if(e.scope==='Shared total'&&e.peopleCount>1)info.append(el('small',money(e.amount/e.peopleCount,e.currency)+' per person · '+e.peopleCount+' equal shares'));row.append(info,actions(button('Edit',()=>{f.dataset.editId=e.id;f.dataset.dirty='true';for(const [k,v]of Object.entries(e))if(f.elements[k])f.elements[k].value=v;scope.onchange();f.parentElement.open=true;amount.focus();}),button('Remove',()=>remove('expenses',e.id))));},'Your expense records');
    note(s,'Shared payments count once. Equal shares are estimates, not debts.');
    const converter=section('⇄ Currency'),cf=el('form',null,'dashboard-form'),fields2=el('div',null,'dashboard-fields');cf.dataset.formKey='converter';cf.append(fields2);
    const amt=field(fields2,'amount','Amount','number','1');amt.min='0';amt.max='1000000000';amt.step='any';amt.required=true;
    select(fields2,'base','From',[...new Set([d.currency,...currencies])],d.currency);
    select(fields2,'target','To',[...new Set([c,...currencies])],c);
    const result=el('p');result.setAttribute('role','status');
    submit(cf,'Convert',async v=>{const b=cf.querySelector('button');b.disabled=true;result.textContent='Checking exchange rate…';try{const r=await PackSwift.api('/api/trips/currency-rate?'+new URLSearchParams({base:v.base,target:v.target}));if(!Number.isFinite(r.rate)||r.rate<=0)throw Error('No valid rate returned.');result.textContent=money(Number(v.amount)*r.rate,v.target)+' · estimated conversion'+(r.updated?' · rate updated '+r.updated:'');}catch(e){result.textContent=e.message;}finally{b.disabled=false;}});
    converter.append(cf,result);note(converter,'Estimated rates. Payment fees may differ.');converter.append(external('Rates by ExchangeRate-API','https://www.exchangerate-api.com'));
    const pf=el('form',null,'dashboard-form');pf.dataset.formKey='currency';select(pf,'currency','My preferred currency',[...new Set([c,...currencies])],c);submit(pf,'Save currency',v=>save(s=>{s.currency=v.currency;}));converter.append(pf);group.append(s,converter);root.append(group);
  }
  function renderGuides(){
    const group=el('div',null,'dashboard-split'),s=section('⌖ Destination guides','dashboard-guide'),{country,resource}=destinationResource();
    note(s,current().details.destination+(country?' · '+country:''));
    const briefing=workspace?.briefing||{};
    for(const [key,label]of [['arrivalTime','Arrival time'],['arrivalLocation','Arrival place'],['arrivalHotel','Your accommodation'],['departureTime','Departure time'],['departureLocation','Departure place']])if(briefing[key])note(s,label+': '+briefing[key]);
    const local=el('div');s.append(local);loadLocalGuide(local,current().details.destination);
    const basics=[['Arrival','Keep your stay address offline. Confirm your terminal and how to reach your accommodation.'],['Getting around','Check the official transit network, ticket payment methods and last services before setting out.'],['Money','Check cash and card acceptance. Budget separately for transfers, meals and admission fees.'],['Before departure','Review entry conditions, insurance and carrier baggage rules. Check a current forecast near departure.']];
    for(const [title,copy]of basics){const d=el('details');d.open=state.experience==='first';d.append(el('summary',title),el('p',copy));s.append(d);}
    if(resource)s.append(actions(external('Official destination guide',resource.guide)));
    else s.append(actions(external('Find official destination advice','https://travel.state.gov/en/international-travel/travel-advisories.html')));
    note(s,'Check destination rules and your own government’s advice.');
    const safety=section('☎ Help & safety','dashboard-safety');
    const directory=el('div'),key=journey();safety.append(directory);
    PackSwiftEmergencyDirectory.mount(directory,{country:emergencyResults.get(key)?.code||country,onResult:r=>{if(r)emergencyResults.set(key,r);else emergencyResults.delete(key);}});
    safety.append(actions(link('All countries & offline contacts','/emergency-contacts.html?'+new URLSearchParams({country:PackSwiftEmergencyDirectory.countryCode(country)}))));
    rows(safety,state.contacts.filter(v=>v.tripId===selected),(row,v)=>{const info=el('div');info.append(el('strong',v.name),el('small','Personal contact · not verified by PackSwift'));if(safeURL(v.source))info.append(external('Your source',v.source));row.append(info,actions(link(v.phone,'tel:'+v.phone.replace(/[^+\d]/g,'')),button('Remove',()=>remove('contacts',v.id))));},'Your own trip contacts');
    const f=formSection(safety,'＋ Add embassy, insurance or stay contact');field(f,'name','Contact name').required=true;const phone=field(f,'phone','Phone number','tel','',32);phone.required=true;phone.pattern='[+0-9][0-9 ()-]{1,31}';field(f,'source','Source link (optional)','url','',500);
    submit(f,'Save contact',v=>save(s=>s.contacts.push({...v,id:crypto.randomUUID(),tripId:selected})));
    group.append(s,safety);root.append(group);
  }
  function renderEntry(){
    const s=section('▤ Visa & entry requirements','dashboard-entry'),entry=state.entryChecks.find(v=>v.tripId===selected)||{},d=current().details,{resource}=destinationResource();
    const reviewed=entry.reviewed&&entry.journey===journey();
    s.append(el('span',reviewed?'Reviewed by you · not travel clearance':'Check required','dashboard-chip'));
    if(entry.reviewed&&!reviewed)note(s,'Journey changed. Review entry requirements again.');
    note(s,'Check rules for your passport, purpose, stay length and transit. No passport number or scan needed.');
    note(s,'Destination: '+d.destination+' · '+date(d.start)+' – '+date(d.end)+' · '+(d.nights+1)+' calendar days');
    if(resource)s.append(actions(external('Official visa information',resource.visa)));
    else s.append(actions(external('Find destination entry advice','https://travel.state.gov/en/international-travel/travel-advisories.html')));
    const f=formSection(s,'Open my private entry check'),fields=el('div',null,'dashboard-fields');f.append(fields);
    field(fields,'passportCountry','Passport-issuing country','text',entry.passportCountry||prefs.nationality,100);
    select(fields,'passportType','Passport type',['','Ordinary','Diplomatic','Official / service','Other'],entry.passportType||'');
    field(fields,'residence','Country of residence (if relevant)','text',entry.residence,100);
    field(fields,'purpose','Purpose of travel','text',entry.purpose,100);
    field(f,'transit','Transit countries (if any)','text',entry.transit,200);
    field(f,'source','Official source you checked','url',entry.source,500);
    field(f,'notes','Conditions, documents or follow-up notes','textarea',entry.notes,1500);
    const label=el('label',null,'dashboard-check'),checked=el('input');checked.type='checkbox';checked.name='reviewed';checked.checked=Boolean(reviewed);label.append(checked,el('span','I checked the official requirements for this journey.'));f.append(label);
    f.addEventListener('input',e=>{if(e.target!==checked)checked.checked=false;});
    submit(f,'Save entry check',v=>save(s=>{const item={...v,reviewed:checked.checked,journey:journey(),id:entry.id||crypto.randomUUID(),tripId:selected};s.entryChecks=s.entryChecks.filter(e=>e.tripId!==selected);s.entryChecks.push(item);}));
    note(s,'Personal review—not visa approval. Recheck after passport, date or route changes.');
    root.append(s);
  }
  function renderPreparation(){
    const group=el('div',null,'dashboard-split'),s=section('✓ Trip preparation'),liked=section('♡ Saved interests');
    if(workspace){const items=workspace.packing||[],count=items.filter(v=>v.completed).length;s.append(el('strong',count+' / '+items.length+' packing items ready','dashboard-metric'));const progress=el('progress');progress.max=items.length||1;progress.value=count;progress.setAttribute('aria-label','Packing progress');s.append(progress);note(s,workspace.workspace?.itineraryReviewedAt?'Itinerary reviewed by you.':'Your itinerary still needs your review.');}
    else note(s,'Preparation details are loading or unavailable.');
    s.append(actions(link('Edit itinerary',path('itinerary')),link('Open packing list',path('packing'))));
    if(workspace){rows(s,workspace.packing||[],(row,p)=>{const label=el('label',null,'dashboard-check'),check=el('input');check.type='checkbox';check.checked=Boolean(p.completed);check.setAttribute('aria-label','Packed '+p.itemName);check.disabled=!Number.isInteger(p.id);check.onchange=async()=>{if(busy){check.checked=Boolean(p.completed);return;}check.disabled=true;await mutateTrip({action:'packing',itemId:p.id,state:check.checked?'have':'unchecked'});};label.append(check,el('span',p.itemName+' × '+(p.quantity||1)));row.append(label);},'Your packing checklist');}
    const forecast=el('div',null,'dashboard-weather');s.append(forecast);loadWeather(forecast);
    const wishlist=(prefs.wishlist||[]).filter(v=>String(v.detail).toLowerCase().includes(current().details.destination.toLowerCase()));
    rows(liked,wishlist,(row,v)=>{row.append(el('strong',v.name),link('Plan a visit',planner()+'&wish='+encodeURIComponent(v.name)));},'No wishlist places for this destination yet.');
    rows(liked,workspace?.likedActivities||[],(row,v)=>{row.append(el('strong',v.title),button('Remove interest',()=>{if(confirm('Remove this interest? Existing itinerary stops are kept.'))mutateTrip({action:'activity-choice',id:v.id});}));},'Liked activities saved with this trip');
    liked.append(actions(link('Review liked activities',planner()),button('Edit wishlist & packing presets',()=>{$('#dashboard-preferences').open=true;$('#dashboard-preferences').scrollIntoView({behavior:'smooth'});})));
    group.append(s,liked);root.append(group);
  }
  function renderItinerary(){
    const s=section('≡ Your itinerary','dashboard-itinerary');
    if(!workspace){note(s,'Loading the saved itinerary…');root.append(s);return;}
    const days=workspace.editablePlan?.days;
    const warnings=workspace.editablePlan?.warnings||[];
    if(warnings.length){const checks=el('details');checks.append(el('summary','Planning checks ('+warnings.length+')'));for(const warning of warnings)note(checks,warning);s.append(checks);}
    if(days)for(const day of days){const block=el('details');block.open=openDays.has(day.day);block.ontoggle=()=>{if(block.isConnected)block.open?openDays.add(day.day):openDays.delete(day.day);};block.append(el('summary','Day '+day.day+' · '+date(day.date)));rows(block,day.stops,(row,stop)=>{const info=el('div');info.append(el('strong',stop.name),el('small',(stop.startTime||'Flexible time')+(stop.durationMinutes?' · '+stop.durationMinutes+' min':'')));if(stop.notes)info.append(el('p',stop.notes));row.append(info);stopForm(row,stop,day.day,true);},'No stops planned for this day.');s.append(block);}
    else rows(s,workspace.timeline||[],(row,stop)=>{row.append(el('strong',stop.title),el('small','Day '+stop.day+' · '+(stop.startTime||'Flexible time')));stopForm(row,stop,stop.day,false);},'No saved itinerary stops yet.');
    const add=formSection(s,'Add activity'),fields=el('div',null,'dashboard-fields');add.append(fields);
    field(fields,'name','Activity','text','',180).required=true;field(fields,'startTime','Time','time',days?'09:00':'').required=Boolean(days);
    select(fields,'day','Day',Array.from({length:current().details.nights+1},(_,i)=>String(i+1)),'1');
    if(days){const duration=field(fields,'durationMinutes','Duration (minutes)','number','60');duration.min='5';duration.max='1440';duration.required=true;}
    submit(add,'Add activity',v=>days?mutateTrip({action:'edit-stop',change:{type:'add',day:Number(v.day),stop:{id:crypto.randomUUID(),name:v.name,startTime:v.startTime,durationMinutes:Number(v.durationMinutes)}}}):mutateTrip({action:'itinerary',items:[...(workspace.timeline||[]).map(t=>({id:t.id,title:t.title,day:t.day,startTime:(t.startTime||'').slice(0,5)})),{title:v.name,day:Number(v.day),startTime:v.startTime}]}));
    s.append(actions(link('Advanced planning & activities',planner()+'#preview-itinerary')));root.append(s);
    if(workspace.editablePlan?.unscheduled?.length){const list=el('details');list.append(el('summary','Unscheduled places'));for(const stop of workspace.editablePlan.unscheduled)note(list,stop.name+' · '+stop.reason);s.append(list);}
  }
  function stopForm(parent,stop,day,editable){
    for(const warning of stop.warnings||[])note(parent,warning);
    if(stop.needsRefresh)note(parent,'Place details need refreshing before travel.');
    if(editable&&stop.locked){parent.append(actions(button('Unlock stop',()=>mutateTrip({action:'edit-stop',change:{type:'lock',id:stop.id,locked:false}}))));return;}
    const f=formSection(parent,'Edit stop');f.dataset.formKey='stop-'+stop.id;f.setAttribute('aria-label','Edit '+(stop.name||stop.title));
    const fields=el('div',null,'dashboard-fields');f.append(fields);field(fields,'name','Activity','text',stop.name||stop.title,180).required=true;field(fields,'startTime','Time','time',(stop.startTime||'').slice(0,5)).required=editable;
    select(fields,'day','Day',Array.from({length:current().details.nights+1},(_,i)=>String(i+1)),String(day));
    if(editable){const duration=field(fields,'durationMinutes','Duration (minutes)','number',stop.durationMinutes);duration.min='5';duration.max='1440';duration.required=true;field(f,'notes','Notes','textarea',stop.notes||'',600);}
    submit(f,'Save changes',v=>editable?mutateTrip({action:'edit-stop',change:{type:'update',id:stop.id,day:Number(v.day),values:{name:v.name,startTime:v.startTime,durationMinutes:Number(v.durationMinutes),notes:v.notes}}}):mutateTrip({action:'itinerary',items:(workspace.timeline||[]).map(t=>({id:t.id,day:t.id===stop.id?Number(v.day):t.day,title:t.id===stop.id?v.name:t.title,startTime:t.id===stop.id?v.startTime:(t.startTime||'').slice(0,5)}))}));
    f.append(actions(button('Cancel',()=>{f.removeAttribute('data-dirty');render(captureForms(f));}),button('Remove activity',()=>{if(confirm('Remove this activity from your itinerary?'))editable?mutateTrip({action:'edit-stop',change:{type:'remove',id:stop.id}}):mutateTrip({action:'itinerary',items:(workspace.timeline||[]).filter(t=>t.id!==stop.id).map(t=>({id:t.id,day:t.day,title:t.title,startTime:(t.startTime||'').slice(0,5)}))});})));
  }
  function renderLanding(){
    root.classList.add('dashboard-landing');
    if(!trips.length){const empty=section('No trips yet','dashboard-trips');empty.append(link('Plan my first trip','/trip-planner',true));root.append(empty);return;}
    renderTrips();
    const first=root.querySelector('.dashboard-row');if(first)first.classList.add('next-trip-row');
  }
  function renderPacking(){
    const s=section('Packing','dashboard-packing');
    if(!workspace){note(s,'Loading packing list…');root.append(s);return;}
    const items=workspace.packing||[],count=items.filter(p=>p.completed).length;
    s.append(el('strong',count+' / '+items.length+' packed','dashboard-metric'));
    rows(s,items,(row,p)=>{const label=el('label',null,'dashboard-check'),check=el('input');check.type='checkbox';check.checked=Boolean(p.completed);check.setAttribute('aria-label','Packed '+p.itemName);check.onchange=async()=>{if(busy){check.checked=Boolean(p.completed);return;}check.disabled=true;await mutateTrip({action:'packing',itemId:p.id,state:check.checked?'have':'unchecked'});};label.append(check,el('span',p.itemName+' × '+(p.quantity||1)));row.append(label,el('small',p.category||''));packingForm(row,p);},'No packing items saved.');
    packingForm(s);root.append(s);
  }
  function packingForm(parent,item){
    const f=formSection(parent,item?'Edit item':'Add packing item');f.dataset.formKey='packing-'+(item?.id||'new');
    const fields=el('div',null,'dashboard-fields');f.append(fields);field(fields,'name','Item','text',item?.itemName||'',100).required=true;field(fields,'category','Category','text',item?.category||'Personal',80).required=true;
    const quantity=field(fields,'quantity','Quantity','number',item?.quantity||1);quantity.required=true;quantity.min='1';quantity.max='99';quantity.step='1';
    submit(f,item?'Save item':'Add item',v=>mutateTrip({action:item?'packing-edit':'packing-add',...(item?{itemId:item.id}:{}),name:v.name,category:v.category,quantity:Number(v.quantity)}));
    f.append(actions(button('Cancel',()=>{f.removeAttribute('data-dirty');render(captureForms(f));})));
    if(item)f.append(button('Remove item',()=>{if(confirm('Remove '+item.itemName+' from this trip?'))mutateTrip({action:'packing-remove',itemId:item.id});}));
  }
  function renderInterests(){
    const s=section('Saved places','dashboard-interests');
    rows(s,workspace?.likedActivities||[],(row,v)=>{row.append(el('strong',v.title),button('Remove interest',()=>{if(confirm('Remove this interest? Existing itinerary stops are kept.'))mutateTrip({action:'activity-choice',id:v.id});}));},'No liked activities yet.');
    const wishes=(prefs.wishlist||[]).filter(v=>String(v.detail).toLowerCase().includes(current().details.destination.toLowerCase()));
    if(wishes.length)rows(s,wishes,(row,v)=>row.append(el('strong',v.name),link('Add to plan',planner()+'&wish='+encodeURIComponent(v.name))),'Wishlist');
    s.append(link('Find activities',planner()+'#preview-activities'));root.append(s);
  }
  function renderHubNav(){
    const d=current().details;$('#trip-hub-title').textContent=d.destination;$('#trip-hub-dates').textContent=date(d.start)+' – '+date(d.end);
    const nav=$('#trip-hub-nav');nav.replaceChildren();
    for(const tab of tabs){const a=link(tab[0].toUpperCase()+tab.slice(1),path(tab));if(tab===activeTab)a.setAttribute('aria-current','page');nav.append(a);}
  }
  function renderStories(){
    const s=section('✎ My travel experiences','dashboard-experiences');note(s,'Private until shared. Only the previewed text is shared.');
    const f=formSection(s,'＋ Write an experience'),title=field(f,'title','Title','text','',100),body=field(f,'body','Your experience and useful tips','textarea','',3000);title.required=body.required=true;
    submit(f,'Save private draft',v=>save(s=>{const item={...v,id:f.dataset.editId||crypto.randomUUID(),tripId:selected};s.stories=s.stories.filter(v=>v.id!==item.id);s.stories.push(item);}));
    rows(s,state.stories.filter(v=>v.tripId===selected),(row,v)=>{const details=el('details');details.append(el('summary',v.title+' · Private draft'),el('p',v.body,'dashboard-share-preview'));
      const text=current().details.destination+'\n'+v.title+'\n\n'+v.body;
      details.append(actions(button('Edit',()=>{f.dataset.editId=v.id;f.dataset.dirty='true';title.value=v.title;body.value=v.body;f.parentElement.open=true;title.focus();}),button('Share this text',async()=>{if(!confirm('Share only this experience text? Check that it contains no private details.'))return;try{if(navigator.share)await navigator.share({title:v.title,text});else download('packswift-experience.txt',text);}catch(e){if(e.name!=='AbortError')feedback('Could not share. Try downloading the text instead.');}}),button('Download text',()=>download('packswift-experience.txt',text)),button('Delete',()=>remove('stories',v.id))));row.append(details);},'No experience drafts for this trip yet.');
    note(s,'Share through your device or download the text. No public feed.');root.append(s);
  }
  function render(drafts=captureForms()){
    root.replaceChildren();
    if(!tripMode)renderLanding();
    else if(!current()){const s=section('Trip not found');s.append(link('Back to My Trips','/profile#dashboard-trips'));root.append(s);}
    else{
      renderHubNav();
      if(activeTab==='overview'){renderHero();renderStories();const stories=root.lastElementChild,details=el('details');details.open=notesOpen;details.ontoggle=()=>{if(details.isConnected)notesOpen=details.open;};details.append(el('summary','Trip notes & experiences'));stories.before(details);details.append(stories);}
      if(activeTab==='itinerary'){renderItinerary();renderInterests();}
      if(activeTab==='budget')renderBudget();
      if(activeTab==='packing')renderPacking();
      if(activeTab==='help'){const s=section('Weather');const weather=el('div');s.append(weather);root.append(s);loadWeather(weather);renderGuides();renderEntry();}
    }
    root.hidden=false;
    const personality=$('.personality-card');if(personality&&$('#dashboard-preferences')&&!$('#dashboard-preferences').contains(personality))$('#dashboard-preferences').insertBefore(personality,$('#profile-form'));
    restoreForms(drafts);
  }
  async function loadWorkspace(){
    const seq=++workspaceSeq,id=selected;if(!id)return;
    try{const value=await PackSwift.api('/api/trips/'+encodeURIComponent(id)+'/workspace?hydrate=0');if(seq!==workspaceSeq||id!==selected)return;workspace=value;
      // Do not destroy a form the user has already begun editing.
      render();return true;
    }catch(e){if(seq===workspaceSeq)feedback('Trip details unavailable: '+e.message);return false;}
  }
  root.addEventListener('input',e=>{const form=e.target.closest('form');if(form&&form.dataset.formKey!=='converter')form.setAttribute('data-dirty','true');});
  if(tripMode)document.addEventListener('click',e=>{
    const a=e.target.closest('a');if(!a||a.target==='_blank')return;const url=new URL(a.href,location.href),tab=url.searchParams.get('tab');
    if(url.origin!==location.origin||url.pathname!==location.pathname||!tabs.includes(tab))return;e.preventDefault();if(busy)return;
    if(root.querySelector('[data-dirty]')&&!confirm('Discard unsaved changes and switch sections?'))return;
    activeTab=tab;history.replaceState(null,'',url.pathname+url.search+url.hash);render([]);$('#trip-hub-nav [aria-current]')?.focus({preventScroll:true});if(url.hash)requestAnimationFrame(()=>document.getElementById(url.hash.slice(1))?.scrollIntoView());
  });
  window.addEventListener('beforeunload',e=>{if(root.querySelector('[data-dirty]')){e.preventDefault();e.returnValue='';}});
  async function load(){
    try{const user=await PackSwift.authReady;if(!user){if(tripMode){root.hidden=false;root.append(link('Sign in to open this trip','/login?redirect='+encodeURIComponent(location.pathname+location.search)));feedback('Sign in required.');}return;}
      const [data,list,preferences]=await Promise.all([PackSwift.api('/api/profile/dashboard'),PackSwift.api('/api/trips'),PackSwift.api('/api/profile/preferences')]);
      state=data.dashboard;prefs=preferences.preferences||{};trips=list.trips||[];
      trips.sort((a,b)=>String(a.details.start||'9999').localeCompare(b.details.start||'9999'));
      selected=tripMode?requestedTrip:(trips.find(v=>!v.details.end||v.details.end>=today())||trips.at(-1))?.tripId||'';
      render();feedback('');if(tripMode&&current())await loadWorkspace();
    }catch(e){feedback('Could not load your dashboard: '+e.message);status.append(button('Try again',load));}
  }
  load();
  if($('#profile-content'))new MutationObserver(()=>{const p=$('.personality-card');if(p&&!$('#dashboard-preferences').contains(p))$('#dashboard-preferences').insertBefore(p,$('#profile-form'));}).observe($('#profile-content'),{childList:true});
})();
