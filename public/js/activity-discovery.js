/* Discovery UI owns presentation only; planner retains selected objects and persistence. */
globalThis.PackSwiftActivityDiscovery=(()=>{
 const model=globalThis.PackSwiftActivities;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 let filter='all',visible=20,lastPool;
 function render(root,state,onSelect,onSkip,onRemove){
  root.replaceChildren();if(lastPool!==state.places){visible=20;filter='all';lastPool=state.places;}
  const result=state.activityResult,pool=state.places.filter(p=>!state.skipped.includes(model.identity(p))&&!state.selected.some(s=>model.identity(s)===model.identity(p)));
  if(result){const d=result.demand;root.append(el('p',`${d.tripDays-1} nights · approximately ${d.usableDays} exploration days · ${d.targetPerDay} experiences/day. ${state.places.length} options found; choose only what you love.`,'activity-context'));
   for(const note of result.notices||[])root.append(el('p',note,'activity-notice'));
  }
  if(pool.length){const filters=el('div',null,'activity-filters');filters.setAttribute('aria-label','Filter activity recommendations');
   const choices=['all',...(pool.some(p=>p.matchedInterests?.length)?['for you']:[]),...[...new Set(pool.flatMap(p=>p.categories||[]))].sort(),...(pool.some(p=>p.tripType!=='in_city')?['day trips']:[])];
   for(const value of choices){const b=el('button',value.replaceAll('_',' '));b.type='button';b.setAttribute('aria-pressed',String(filter===value));b.onclick=()=>{filter=value;visible=20;render(root,state,onSelect,onSkip,onRemove);};filters.append(b);}root.append(filters);
  }
  const filtered=pool.filter(p=>filter==='all'||filter==='for you'&&p.matchedInterests?.length||filter==='day trips'&&p.tripType!=='in_city'||p.categories?.includes(filter));
  const groups=model.groupActivities(filtered);let count=0;
  for(const group of groups){if(count>=visible)break;const section=el('section',null,'activity-group');if(group.matched)section.append(el('small','MATCHED TO YOUR INTERESTS','activity-match'));section.append(el('h4',group.title));const grid=el('div',null,'activity-pair');
   for(const p of group.places){if(count++>=visible)break;const card=el('article',null,'activity-card');const media=el('div',null,'activity-media');
    if(p.imageUrl){const image=el('img');image.src=p.imageUrl;image.alt=p.title||p.name;image.loading='lazy';image.width=400;image.height=250;image.onerror=()=>{image.remove();media.append(el('span','Photo unavailable'));};media.append(image);}else media.append(el('span','Photo unavailable'));card.append(media);
    const content=el('div',null,'activity-card-content');content.append(el('small',(p.tripType||'in_city').replaceAll('_',' ').toUpperCase()),el('h5',p.title||p.name));
    if(p.matchedInterests?.length)content.append(el('small',`Matches “${p.matchedInterests.join(', ')}”`,'activity-match'));
    content.append(el('small',`${p.priceLevel==='PRICE_LEVEL_FREE'?'Provider indicates free':p.ticket||'Admission price unavailable'}${p.suggestedStayMin?' · '+(p.suggestedStayMin/60).toFixed(1)+' hrs suggested':''}`));
    const detail=el('details');detail.append(el('summary','Location & travel details'),el('p',p.travelContext||p.location||'Verify location before travel'));
    if(p.imageCredit)detail.append(el('small',p.imageCredit));content.append(detail);
    const actions=el('div',null,'activity-actions');for(const [label,handler]of [['+ Add to Trip',onSelect],['Skip',onSkip]]){const b=el('button',label);b.type='button';b.setAttribute('aria-label',`${label}: ${p.title||p.name}`);b.onclick=()=>handler(p);actions.append(b);}content.append(actions);card.append(content);grid.append(card);
   }section.append(grid);root.append(section);
  }
  if(filtered.length>visible){const more=el('button',`Show more activities (${filtered.length-visible} remaining)`,'studio-secondary');more.type='button';more.onclick=()=>{visible+=20;render(root,state,onSelect,onSkip,onRemove);};root.append(more);}
  for(const p of state.selected){const row=el('div',null,'studio-selected');row.append(el('span','✓ '+(p.title||p.name)));const b=el('button','Remove');b.type='button';b.setAttribute('aria-label','Remove '+(p.title||p.name));b.onclick=()=>onRemove(p);row.append(b);root.append(row);}
 }
 return {render};
})();
