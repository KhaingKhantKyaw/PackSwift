(() => {
  const $ = id => document.getElementById(id);
  let input = {}, places = [], destination = '', engaged = false, started = 0, timer, revision = 0;
  const excluded = new Set();
  let recommended = [], notesTimer, savedId;
  let resumeAction=null, restoredSelection=null;
  window.addEventListener('packswift:draft-restored',event=>{
    engaged=true;
    resumeAction=event.detail.action;restoredSelection=event.detail.preview;
  });
  let noteMatches=[],noteController;
  let liveReview=null, reviewController, reviewTimer;
  const ready=data=>Boolean(String(data.origin||'').trim() && String(data.destination||'').trim() && data.startDate && data.endDate && Date.parse(data.endDate)>Date.parse(data.startDate));
  window.addEventListener('packswift:preview-incomplete',event=>{
    input=event.detail;revision++;clearTimeout(timer);clearTimeout(reviewTimer);reviewController?.abort();noteController?.abort();liveReview=null;
    $('preview-thinking').hidden=true;$('preview-skeleton').hidden=true;$('preview-content').hidden=true;$('preview-board').hidden=true;$('preview-idle').hidden=false;
    const message=$('preview-idle').querySelector('p');if(message)message.textContent='Choose your departure city and travel dates to start your live plan.';
    $('preview-save').disabled=true;$('preview-board-open').disabled=true;reviewBox.replaceChildren();
  });
  const reviewBox=document.createElement('section');reviewBox.className='live-review-summary';reviewBox.setAttribute('aria-live','polite');
  $('preview-snapshot').after(reviewBox);
  function queueReview() {
    clearTimeout(reviewTimer);reviewController?.abort();liveReview=null;
    if(!ready(input) || nights()<1){reviewBox.replaceChildren();return;}
    reviewBox.textContent='Updating trip review…';
    reviewTimer=setTimeout(async()=>{
      const controller=new AbortController();reviewController=controller;
      try {
        const response=await fetch('/api/v1/trips/live-review',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({...input,passportCountry:$('passport-country')?.value,selectedPlaces:places.filter(p=>!excluded.has(key(p)))})});
        const result=await response.json();if(!response.ok)throw new Error(result.message || 'Review unavailable');
        if(controller.signal.aborted)return;liveReview=result;renderReview();if(!$('preview-board').hidden)renderBoard();
      }catch(error){if(error.name!=='AbortError')reviewBox.textContent='Detailed review is temporarily unavailable. Your selected places remain available.';}
    },800);
  }
  function textNode(tag,text){const node=document.createElement(tag);node.textContent=text;return node;}
  function reviewMoney(amount){return new Intl.NumberFormat('en',{style:'currency',currency:liveReview.budget.currency,maximumFractionDigits:0}).format(amount);}
  function renderReview(){
    reviewBox.replaceChildren();const r=liveReview,s=r.tripSummary;
    reviewBox.append(textNode('h3',`${s.origin || 'Origin'} → ${s.destination}`),textNode('p',`${s.days} days · ${s.nights} nights · ${s.adults} adults · ${s.children} children`));
    r.alerts.forEach(alert=>{const box=document.createElement('div');box.className='review-alert';box.append(textNode('strong',alert.title),textNode('p',alert.message));reviewBox.append(box);});
    const details=document.createElement('details');details.open=true;details.append(textNode('summary','Estimated ground budget'));
    r.budget.categories.forEach(row=>{const line=document.createElement('div');line.className='review-cost-row';line.append(textNode('span',row.label),textNode('strong',`${reviewMoney(row.minimum)}–${reviewMoney(row.maximum)}`));details.append(line);});
    details.append(textNode('p',`Ground total: ${reviewMoney(r.budget.total.minimum)}–${reviewMoney(r.budget.total.maximum)}`),textNode('p',r.budget.status),textNode('small',`Not included: ${r.budget.excluded.join(', ')}. ${r.budget.source}.`));reviewBox.append(details);
    const packing=document.createElement('details');packing.append(textNode('summary','Preparation & packing'));const list=document.createElement('ul');r.packingRecommendations.forEach(item=>list.append(textNode('li',item)));packing.append(list);reviewBox.append(packing,textNode('small',r.dataStatus));
  }
  async function searchNotePlaces(notes) {
    noteController?.abort();noteMatches=[];
    const theme=notes.match(noteThemes)?.[1]?.toLowerCase();
    if(!theme || !input.destination)return;
    const controller=new AbortController();noteController=controller;
    const city=input.destination;
    const userType=/market|cafe|café|nightlife/.test(theme)?'Food & Culinary':/temple/.test(theme)?'Culture & Heritage':/kid|children/.test(theme)?'Family with Kids':'Solo / Aesthetic';
    try {
      const response=await fetch('/api/generate-itinerary',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({destination:city,userType,duration:1,budgetCategory:'mid',pace:input.pace})});
      if(!response.ok)return;const result=await response.json();
      if(controller.signal.aborted || city!==input.destination || notes!==input.notes)return;
      noteMatches=(result.days || []).flatMap(day=>day.activities || day.stops || []).filter(p=>!p.isSample).map(p=>({...p,customRequest:true}));
      mergeNotes();render();
    }catch(error){if(error.name!=='AbortError')$('preview-toast').textContent='Additional note matches are temporarily unavailable.';}
  }
  const noteThemes = /\b(beach(?:es)?|markets?|nightlife|temples?|caf[eé]s?|kids|children)\b/i;
  const coastalTrips = [
    {id:'bkk-bang-saen',title:'Bang Saen Beach Escape',hours:'Open 24 hours (public beach)',ticket:'Free entry; transport extra',stay:'Half day',dayWeight:0.5},
    {id:'bkk-koh-larn',title:'Pattaya & Coral Island (Koh Larn) Day Tour',hours:'08:00–17:00 suggested tour window',ticket:'THB 800–1,200 / person · benchmark, not a live quote',stay:'Full day',dayWeight:1},
    {id:'bkk-hua-hin',title:'Hua Hin Coastal Getaway',hours:'Open 24 hours (public beach)',ticket:'Free entry; transport extra',stay:'Full day',dayWeight:1},
  ];
  function normalizeMetadata(p) {
    const category=String(p.category || p.type || '').toLowerCase();
    const duration=/market|museum|temple/.test(category)?'60–120 min':/cafe|restaurant|food/.test(category)?'45–90 min':'60–90 min';
    const opening=p.hours || p.openingHours;
    return {...p,hours:Array.isArray(opening)?opening.join(' • '):opening,
      ticket:p.ticket || p.ticketPrice || p.priceRange,
      stay:p.stay || p.suggestedStay || (p.durationMinutes?`${p.durationMinutes} min`:p.duration) || `${duration} · suggested`};
  }
  function resetSaved() {
    $('preview-save').textContent = 'Save My Trip Plan';
    $('preview-save').classList.remove('is-saved');
    $('preview-toast').textContent = '';
  }
  function mergeNotes() {
    const notes = String(input.notes || '');
    const requested = notes.replace(/\b(?:i\s+)?(?:want|would like|hope)\s+to\s+(?:visit|see|explore)\s*/gi, '')
      .replace(/\b(?:please\s+)?(?:visit|include|add|explore)\s+/gi, '')
      .split(/[,;\n]|\s+and\s+/i).map(s => s.trim().replace(/[.!]+$/, ''))
      .filter(s => s && s.length <= 140 && !noteThemes.test(s)).slice(0, 15);
    const tags=window.PackSwiftTripEngine.parseTags(notes);
    const regional=window.PackSwiftTripEngine.knowledge(input.destination).filter(p=>tags.some(t=>p.tags.includes(t)));
    const pool = new Map([...regional,...recommended,...noteMatches].map(p => [String(p.title || p.name).toLowerCase(), normalizeMetadata(p)]));
    const theme=notes.match(noteThemes)?.[1]?.toLowerCase().replace(/s$/, '');
    if(theme)pool.forEach(p=>{if(String(`${p.title} ${p.category}`).toLowerCase().includes(theme))p.customRequest=true;});
    requested.forEach(title => {
      const existing = [...pool.keys()].find(name => name === title.toLowerCase() || title.toLowerCase().includes(name));
      if (existing) pool.get(existing).customRequest = true;
      else pool.set(title.toLowerCase(), {id:`custom:${title.toLowerCase()}`,title,customRequest:true,category:'Custom Request',stay:'60–90 min · suggested'});
    });
    places = [...pool.values()];
  }
  function schedule() {
    return window.PackSwiftTripEngine.generateDynamicTrip(input.destination,nights()+1,input.notes,input.pace,{places,excluded:[...excluded],currency:input.currency,travelers:input.travelers,accessibility:input.accessibility,level:/luxury/.test(input.planningGoal)?'luxury':/budget|possible/.test(input.planningGoal)?'budget':'comfort'});
  }
  function renderBoard() {
    if(liveReview){
      const list=$('preview-timeline');list.replaceChildren();
      liveReview.itinerary.forEach(day=>{const section=document.createElement('section');section.className='review-day';section.append(textNode('h3',`Day ${day.day} · ${day.date} — ${day.title}`),textNode('p',day.guidance));
        day.activities.forEach((place,index)=>{const stop=document.createElement('div');stop.className='preview-stop';stop.append(textNode('span',`STOP ${String(index+1).padStart(2,'0')}`),card(place,false));section.append(stop);});
        section.append(textNode('small',`${day.transport} · Daily spending allowance ${reviewMoney(day.estimatedDailyGroundCost.minimum)}–${reviewMoney(day.estimatedDailyGroundCost.maximum)} (lodging excluded)`));list.append(section);});
      if(liveReview.unscheduled.length)list.append(textNode('p',`${liveReview.unscheduled.length} selected places do not fit this pace. Adjust dates or pace to include them.`));return;
    }
    const list=$('preview-timeline'), {routes,unscheduled,cap,days,expenses}=schedule();list.replaceChildren();
    routes.forEach((stops,day)=>{
      const heading=document.createElement('h3');heading.textContent=`ROUTE ${day+1} · Day ${day+1}: ${days[day].label}`;list.append(heading);
      if(!stops.length){const note=document.createElement('p');note.textContent='Free time';list.append(note);}
      stops.forEach((p,i)=>{const stop=document.createElement('div');stop.className='preview-stop';const badge=document.createElement('span');badge.textContent=`STOP ${String(i+1).padStart(2,'0')}`;stop.append(badge,card(p,false));list.append(stop);});
    });
    if(unscheduled.length){const note=document.createElement('p');note.textContent=`${unscheduled.length} places remain unscheduled (maximum ${cap} per day): ${unscheduled.map(p=>p.title || p.name).join(', ')}. Increase your pace or trip length to include them.`;list.append(note);}
    list.append(expenseCard(expenses));
  }
  function expenseCard(expenses) {
    const box=document.createElement('section');box.className='preview-expenses';
    const heading=document.createElement('h3');heading.textContent='Estimated ground expenses';box.append(heading);
    for(const [field,label] of [['accommodation','Accommodation'],['food','Food'],['localTransport','Local transport'],['attractionTickets','Known admission costs'],['total','Subtotal']]){
      const line=document.createElement('p');line.textContent=`${label}: ${expenses[field]===null?'No destination benchmark available':new Intl.NumberFormat('en',{style:'currency',currency:expenses.currency,maximumFractionDigits:0}).format(expenses[field])}`;box.append(line);
    }
    const note=document.createElement('small');note.textContent=`${expenses.source}. ${expenses.unpricedAttractions} stops have unpriced admission; subtotal is incomplete when costs are missing.`;box.append(note);return box;
  }
  const key = p => String(p.placeId || p.place_id || p.id || p.title || p.name);
  const money = n => { try { return new Intl.NumberFormat('en', {style:'currency',currency:input.currency || 'USD',maximumFractionDigits:0}).format(n || 0); } catch { return String(n || 0); } };
  const nights = () => Math.max(0, Math.round((Date.parse(input.endDate)-Date.parse(input.startDate))/86400000) || 0);
  function snapshot() {
    const tags = [input.destination, input.startDate && input.endDate ? `${input.startDate} – ${input.endDate} • ${nights()} nights` : 'Choose dates', input.planningGoal, input.pace, `Budget: ${money(input.budget)} • ${money(input.budget / Math.max(1,nights()))}/day`].filter(Boolean);
    $('preview-snapshot').replaceChildren(...tags.map(text => { const node=document.createElement('span');node.textContent=text;return node; }));
    const group=document.createElement('span');group.textContent=`${input.adults || 1} adults · ${input.children || 0} children`;$('preview-snapshot').append(group);
    [input.accessibility && input.accessibility!=='standard'?input.accessibility:null,input.dietaryStyle && input.dietaryStyle!=='any'?input.dietaryStyle:null,input.familyNeeds].filter(Boolean).forEach(text=>{const tag=document.createElement('span');tag.textContent=text;$('preview-snapshot').append(tag);});
  }
  function card(p, editable=true) {
    const row=document.createElement('article');row.className='preview-place';row.classList.toggle('is-excluded',excluded.has(key(p)));
    const img=document.createElement('img');img.src=p.imageUrl || p.photoUrl || p.image || '/images/packswift1.jpg';img.alt='';img.loading='lazy';img.addEventListener('error',()=>{img.hidden=true;},{once:true});
    const copy=document.createElement('div'); const title=document.createElement('strong');title.textContent=p.title || p.name || 'Place';copy.append(title);
    if(p.customRequest){const badge=document.createElement('small');badge.className='preview-custom';badge.textContent='📌 Added from your notes';copy.append(badge);}
    [p.category || p.type, p.hours && `🕒 Hours: ${p.hours}`, p.ticket ? `🎟️ Ticket: ${p.ticket}` : p.estimatedCostPerPerson != null ? `🎟️ Ticket: ${money(p.estimatedCostPerPerson)} estimated` : null, `⏱️ Suggested stay: ${p.stay || '60–90 min · suggested'}`, !p.hours || !p.ticket ? 'Venue hours or admission price not supplied by the source.' : null].filter(Boolean).forEach(text=>{const small=document.createElement('small');small.textContent=String(text);copy.append(small);});
    row.append(img,copy);
    if(editable){const controls=document.createElement('div');controls.className='preview-place-controls';['include','exclude'].forEach(action=>{const button=document.createElement('button');button.type='button';button.dataset.place=key(p);button.dataset.action=action;button.setAttribute('aria-pressed',String(action==='include'?!excluded.has(key(p)):excluded.has(key(p))));button.setAttribute('aria-label',`${action} ${title.textContent}`);button.textContent=action==='include'?'✓':'✕';controls.append(button);});row.append(controls);}return row;
  }
  function render() {
    $('preview-checklist').replaceChildren(...places.map(p=>card(p)));
    queueReview();
    if(!places.length) $('preview-checklist').textContent='No matching places yet. Choose a destination or adjust your preferences.';
    const valid=Boolean(input.destination && input.startDate && input.endDate && nights()>0 && places.some(p=>!excluded.has(key(p))));
    $('preview-save').disabled=!valid;$('preview-board-open').disabled=!valid;
    if(!$('preview-board').hidden)renderBoard();
  }
  window.addEventListener('packswift:preview-thinking',event=>{
    if(!ready(event.detail))return;
    clearTimeout(reviewTimer);reviewController?.abort();liveReview=null;reviewBox.replaceChildren();
    input=event.detail;
    resetSaved();
    if(!engaged && !new URLSearchParams(location.search).size)return;
    if(destination!==input.destination){noteController?.abort();noteMatches=[];excluded.clear();places=[];destination=input.destination;}
    revision++;clearTimeout(timer);started=performance.now();
    $('preview-idle').hidden=true;$('preview-content').hidden=!$('preview-board').hidden;
    $('preview-thinking').hidden=false;$('preview-skeleton').hidden=false;$('preview-checklist').hidden=true;
    $('preview-save').disabled=true;$('preview-board-open').disabled=true;
    $('preview-status').textContent=input.destination?`Curating places and balancing your budget for ${input.destination}…`:'Choose a destination to begin tailoring…';snapshot();
  });
  window.addEventListener('packswift:preview-results',event=>{
    if(!ready(event.detail.input))return;
    if(!engaged && !new URLSearchParams(location.search).size)return;
    input=event.detail.input;recommended=event.detail.recommendation.primary || event.detail.recommendation.activities || [];
    if(restoredSelection?.places?.length){recommended=restoredSelection.places;excluded.clear();(restoredSelection.excluded||[]).forEach(id=>excluded.add(id));restoredSelection=null;}
    mergeNotes();
    const token=revision;timer=setTimeout(()=>{if(token!==revision)return;$('preview-thinking').hidden=true;$('preview-skeleton').hidden=true;$('preview-checklist').hidden=false;snapshot();render();if(resumeAction==='save'||resumeAction==='board'){const action=resumeAction;resumeAction=null;$(action==='save'?'preview-save':'preview-board-open').click();}},Math.max(0,400-(performance.now()-started)));
  });
  const form=$('trip-planner-form');['input','change','click'].forEach(type=>form.addEventListener(type,()=>{engaged=true;},true));
  $('trip-notes').addEventListener('input',event=>{clearTimeout(notesTimer);noteController?.abort();noteMatches=[];const value=event.target.value;notesTimer=setTimeout(()=>{input.notes=value;mergeNotes();resetSaved();$('preview-skeleton').hidden=true;$('preview-checklist').hidden=false;render();searchNotePlaces(value);},300);});
  $('preview-checklist').addEventListener('click',event=>{const button=event.target.closest('[data-place]');if(!button)return;const id=button.dataset.place;button.dataset.action==='exclude'?excluded.add(id):excluded.delete(id);resetSaved();render();});
  $('preview-board-open').addEventListener('click',async()=>{
    if(!await window.PackSwiftDraft.gate('board',{places,excluded:[...excluded]}))return;
    $('preview-content').hidden=true;$('preview-board').hidden=false;const list=$('preview-timeline');list.replaceChildren();
    renderBoard();
  });
  $('preview-back').addEventListener('click',()=>{$('preview-board').hidden=true;$('preview-content').hidden=false;});
  $('preview-save').addEventListener('click',async()=>{
    if(!await window.PackSwiftDraft.gate('save',{places,excluded:[...excluded]}))return;
    const user=window.PackSwift?.currentUser;
    if(!user?.id){$('preview-toast').textContent='Log in to save this itinerary under your profile.';return;}
    try{
      const storageKey=`packswift_saved_plans:${user.id}`;
      const saved=JSON.parse(localStorage.getItem(storageKey) || '[]');if(!Array.isArray(saved))throw new Error();
      const plan={...input,liveReview,id:savedId || crypto.randomUUID(),userId:user.id,username:user.username || user.full_name,selectedPlaces:places.filter(p=>!excluded.has(key(p))),...schedule(),updatedAt:new Date().toISOString()};
      const index=saved.findIndex(p=>p.id===plan.id);if(index>=0)saved[index]=plan;else saved.push(plan);
      localStorage.setItem(storageKey,JSON.stringify(saved));savedId=plan.id;
      $('preview-save').textContent='✓ Saved to Dashboard';$('preview-save').classList.add('is-saved');$('preview-save').disabled=true;
      $('preview-toast').textContent='Your itinerary has been saved successfully!';
    }catch{$('preview-toast').textContent='Could not save. Browser storage may be full or unavailable.';}
  });
})();
