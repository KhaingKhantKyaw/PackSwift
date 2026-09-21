(() => {
  const $ = id => document.getElementById(id);
  let input = {}, places = [], destination = '', engaged = false, started = 0, timer, revision = 0;
  const excluded = new Set();
  let recommended = [], notesTimer, savedId;
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
      .filter(s => s && s.length <= 140).slice(0, 15);
    const pool = new Map(recommended.map(p => [String(p.title || p.name).toLowerCase(), {...p}]));
    requested.forEach(title => {
      const existing = [...pool.keys()].find(name => name === title.toLowerCase() || title.toLowerCase().includes(name));
      if (existing) pool.get(existing).customRequest = true;
      else pool.set(title.toLowerCase(), {id:`custom:${title.toLowerCase()}`,title,customRequest:true,category:'Custom Request',hours:'Confirm with venue',ticket:'Confirm with venue',stay:'Flexible'});
    });
    places = [...pool.values()];
  }
  function schedule() {
    const pace = String(input.pace || '').toLowerCase();
    const cap = /slow|relax/.test(pace) ? 2 : /fast|packed/.test(pace) ? 5 : 3;
    const days = Math.max(1, Math.min(30, nights()+1));
    const selected = places.filter(p => !excluded.has(key(p))).sort((a,b)=>Number(Boolean(b.customRequest))-Number(Boolean(a.customRequest)));
    const planned = selected.slice(0,days*cap), routes = Array.from({length:days},()=>[]);
    // Spread stops across the trip while respecting each day's maximum.
    planned.forEach((p,i)=>routes[Math.min(days-1,Math.floor(i / Math.max(1,Math.ceil(planned.length/days))))].push(p));
    return {routes,unscheduled:selected.slice(days*cap),cap};
  }
  function renderBoard() {
    const list=$('preview-timeline'), {routes,unscheduled,cap}=schedule();list.replaceChildren();
    routes.forEach((stops,day)=>{
      const heading=document.createElement('h3');heading.textContent=`ROUTE ${day+1} · Day ${day+1}`;list.append(heading);
      if(!stops.length){const note=document.createElement('p');note.textContent='Free time';list.append(note);}
      stops.forEach((p,i)=>{const stop=document.createElement('div');stop.className='preview-stop';const badge=document.createElement('span');badge.textContent=`STOP ${String(i+1).padStart(2,'0')}`;stop.append(badge,card(p,false));list.append(stop);});
    });
    if(unscheduled.length){const note=document.createElement('p');note.textContent=`${unscheduled.length} places remain unscheduled (maximum ${cap} per day): ${unscheduled.map(p=>p.title || p.name).join(', ')}. Increase your pace or trip length to include them.`;list.append(note);}
  }
  const key = p => String(p.placeId || p.place_id || p.id || p.title || p.name);
  const money = n => { try { return new Intl.NumberFormat('en', {style:'currency',currency:input.currency || 'USD',maximumFractionDigits:0}).format(n || 0); } catch { return String(n || 0); } };
  const nights = () => Math.max(0, Math.round((Date.parse(input.endDate)-Date.parse(input.startDate))/86400000) || 0);
  function snapshot() {
    const tags = [input.destination, input.startDate && input.endDate ? `${input.startDate} – ${input.endDate} • ${nights()} nights` : 'Choose dates', input.planningGoal, input.pace, `Budget: ${money(input.budget)} • ${money(input.budget / Math.max(1,nights()))}/day`].filter(Boolean);
    $('preview-snapshot').replaceChildren(...tags.map(text => { const node=document.createElement('span');node.textContent=text;return node; }));
  }
  function card(p, editable=true) {
    const row=document.createElement('article');row.className='preview-place';row.classList.toggle('is-excluded',excluded.has(key(p)));
    const img=document.createElement('img');img.src=p.imageUrl || p.photoUrl || p.image || '/images/packswift1.jpg';img.alt='';img.loading='lazy';img.addEventListener('error',()=>{img.hidden=true;},{once:true});
    const copy=document.createElement('div'); const title=document.createElement('strong');title.textContent=p.title || p.name || 'Place';copy.append(title);
    if(p.customRequest){const badge=document.createElement('small');badge.className='preview-custom';badge.textContent='📌 Custom Request';copy.append(badge);}
    [p.category || p.type, `🕒 Hours: ${p.hours || 'Confirm with venue'}`, `🎟️ Ticket: ${p.ticket || (p.estimatedCostPerPerson != null ? `${money(p.estimatedCostPerPerson)} estimated` : 'Confirm with venue')}`, `⏱️ Suggested stay: ${p.stay || p.duration || 'Flexible'}`].filter(Boolean).forEach(text=>{const small=document.createElement('small');small.textContent=String(text);copy.append(small);});
    row.append(img,copy);
    if(editable){const controls=document.createElement('div');controls.className='preview-place-controls';['include','exclude'].forEach(action=>{const button=document.createElement('button');button.type='button';button.dataset.place=key(p);button.dataset.action=action;button.setAttribute('aria-pressed',String(action==='include'?!excluded.has(key(p)):excluded.has(key(p))));button.setAttribute('aria-label',`${action} ${title.textContent}`);button.textContent=action==='include'?'✓':'✕';controls.append(button);});row.append(controls);}return row;
  }
  function render() {
    $('preview-checklist').replaceChildren(...places.map(p=>card(p)));
    if(!places.length) $('preview-checklist').textContent='No matching places yet. Choose a destination or adjust your preferences.';
    const valid=Boolean(input.destination && input.startDate && input.endDate && nights()>0 && places.some(p=>!excluded.has(key(p))));
    $('preview-save').disabled=!valid;$('preview-board-open').disabled=!valid;
    if(!$('preview-board').hidden)renderBoard();
  }
  window.addEventListener('packswift:preview-thinking',event=>{
    input=event.detail;
    resetSaved();
    if(!engaged && !new URLSearchParams(location.search).size)return;
    if(destination!==input.destination){excluded.clear();places=[];destination=input.destination;}
    revision++;clearTimeout(timer);started=performance.now();
    $('preview-idle').hidden=true;$('preview-content').hidden=!$('preview-board').hidden;
    $('preview-thinking').hidden=false;$('preview-skeleton').hidden=false;$('preview-checklist').hidden=true;
    $('preview-save').disabled=true;$('preview-board-open').disabled=true;
    $('preview-status').textContent=input.destination?`Curating places and balancing your budget for ${input.destination}…`:'Choose a destination to begin tailoring…';snapshot();
  });
  window.addEventListener('packswift:preview-results',event=>{
    if(!engaged && !new URLSearchParams(location.search).size)return;
    input=event.detail.input;recommended=event.detail.recommendation.primary || event.detail.recommendation.activities || [];mergeNotes();
    const token=revision;timer=setTimeout(()=>{if(token!==revision)return;$('preview-thinking').hidden=true;$('preview-skeleton').hidden=true;$('preview-checklist').hidden=false;snapshot();render();},Math.max(0,400-(performance.now()-started)));
  });
  const form=$('trip-planner-form');['input','change','click'].forEach(type=>form.addEventListener(type,()=>{engaged=true;},true));
  $('trip-notes').addEventListener('input',event=>{clearTimeout(notesTimer);const value=event.target.value;notesTimer=setTimeout(()=>{input.notes=value;mergeNotes();resetSaved();render();},350);});
  $('preview-checklist').addEventListener('click',event=>{const button=event.target.closest('[data-place]');if(!button)return;const id=button.dataset.place;button.dataset.action==='exclude'?excluded.add(id):excluded.delete(id);resetSaved();render();});
  $('preview-board-open').addEventListener('click',()=>{
    $('preview-content').hidden=true;$('preview-board').hidden=false;const list=$('preview-timeline');list.replaceChildren();
    renderBoard();
  });
  $('preview-back').addEventListener('click',()=>{$('preview-board').hidden=true;$('preview-content').hidden=false;});
  $('preview-save').addEventListener('click',()=>{
    const user=window.PackSwift?.currentUser;
    if(!user?.id){$('preview-toast').textContent='Log in to save this itinerary under your profile.';return;}
    try{
      const storageKey=`packswift_saved_plans:${user.id}`;
      const saved=JSON.parse(localStorage.getItem(storageKey) || '[]');if(!Array.isArray(saved))throw new Error();
      const plan={...input,id:savedId || crypto.randomUUID(),userId:user.id,username:user.username || user.full_name,selectedPlaces:places.filter(p=>!excluded.has(key(p))),...schedule(),updatedAt:new Date().toISOString()};
      const index=saved.findIndex(p=>p.id===plan.id);if(index>=0)saved[index]=plan;else saved.push(plan);
      localStorage.setItem(storageKey,JSON.stringify(saved));savedId=plan.id;
      $('preview-save').textContent='✓ Saved to Dashboard';$('preview-save').classList.add('is-saved');$('preview-save').disabled=true;
      $('preview-toast').textContent='Your itinerary has been saved successfully!';
    }catch{$('preview-toast').textContent='Could not save. Browser storage may be full or unavailable.';}
  });
})();
