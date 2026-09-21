(() => {
  const $ = id => document.getElementById(id);
  let input = {}, places = [], destination = '', engaged = false, started = 0, timer, revision = 0;
  const excluded = new Set();
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
    [p.category || p.type, p.hours || 'Opening hours: confirm before visiting', p.ticket || (p.estimatedCostPerPerson ? `${money(p.estimatedCostPerPerson)} estimated` : 'Ticket price: check with venue'), p.stay || p.duration || 'Stay duration: flexible'].filter(Boolean).forEach(text=>{const small=document.createElement('small');small.textContent=String(text);copy.append(small);});
    row.append(img,copy);
    if(editable){const button=document.createElement('button');button.type='button';button.dataset.place=key(p);button.setAttribute('aria-pressed',String(!excluded.has(key(p))));button.setAttribute('aria-label',`${excluded.has(key(p))?'Include':'Exclude'} ${title.textContent}`);button.textContent=excluded.has(key(p))?'✕':'✓';row.append(button);}return row;
  }
  function render() {
    $('preview-checklist').replaceChildren(...places.map(p=>card(p)));
    if(!places.length) $('preview-checklist').textContent='No matching places yet. Choose a destination or adjust your preferences.';
    const valid=Boolean(input.destination && input.startDate && input.endDate && nights()>0 && places.some(p=>!excluded.has(key(p))));
    $('preview-save').disabled=!valid;$('preview-board-open').disabled=!valid;
  }
  window.addEventListener('packswift:preview-thinking',event=>{
    input=event.detail;
    if(!engaged && !new URLSearchParams(location.search).size)return;
    if(destination!==input.destination){excluded.clear();places=[];destination=input.destination;}
    revision++;clearTimeout(timer);started=performance.now();
    $('preview-idle').hidden=true;$('preview-content').hidden=false;$('preview-board').hidden=true;
    $('preview-thinking').hidden=false;$('preview-skeleton').hidden=false;$('preview-checklist').hidden=true;
    $('preview-save').disabled=true;$('preview-board-open').disabled=true;
    $('preview-status').textContent=input.destination?`Curating places and balancing your budget for ${input.destination}…`:'Choose a destination to begin tailoring…';snapshot();
  });
  window.addEventListener('packswift:preview-results',event=>{
    if(!engaged && !new URLSearchParams(location.search).size)return;
    input=event.detail.input;places=event.detail.recommendation.primary || event.detail.recommendation.activities || [];
    const token=revision;timer=setTimeout(()=>{if(token!==revision)return;$('preview-thinking').hidden=true;$('preview-skeleton').hidden=true;$('preview-checklist').hidden=false;snapshot();render();},Math.max(0,400-(performance.now()-started)));
  });
  const form=$('trip-planner-form');['input','change','click'].forEach(type=>form.addEventListener(type,()=>{engaged=true;},true));
  $('preview-checklist').addEventListener('click',event=>{const button=event.target.closest('[data-place]');if(!button)return;const id=button.dataset.place;excluded.has(id)?excluded.delete(id):excluded.add(id);render();});
  $('preview-board-open').addEventListener('click',()=>{
    $('preview-content').hidden=true;$('preview-board').hidden=false;const list=$('preview-timeline');list.replaceChildren();
    const selected=places.filter(p=>!excluded.has(key(p))), perDay=input.pace==='slow'?2:input.pace==='fast'?5:3;
    for(let day=0;day<Math.min(30,nights()+1);day++){const heading=document.createElement('h3');heading.textContent=`Day ${day+1}`;list.append(heading);const stops=selected.slice(day*perDay,(day+1)*perDay);if(!stops.length){const note=document.createElement('p');note.textContent='Free time — add more places to fill this day.';list.append(note);}stops.forEach((p,i)=>{const stop=document.createElement('div');stop.className='preview-stop';const badge=document.createElement('span');badge.textContent=`STOP ${String(i+1).padStart(2,'0')}`;stop.append(badge,card(p,false));list.append(stop);});}
  });
  $('preview-back').addEventListener('click',()=>{$('preview-board').hidden=true;$('preview-content').hidden=false;});
  $('preview-save').addEventListener('click',()=>{
    try{const saved=JSON.parse(localStorage.getItem('packswift_saved_plans') || '[]');if(!Array.isArray(saved))throw new Error();saved.push({id:crypto.randomUUID(),...input,selectedPlaces:places.filter(p=>!excluded.has(key(p))),createdAt:new Date().toISOString()});localStorage.setItem('packswift_saved_plans',JSON.stringify(saved));$('preview-toast').textContent='Trip plan saved on this device!';}catch{$('preview-toast').textContent='Could not save. Browser storage may be full or unavailable.';}
  });
})();
