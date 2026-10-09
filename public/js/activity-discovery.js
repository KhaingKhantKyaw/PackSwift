/* Discovery UI owns presentation only; planner retains selected objects and persistence. */
globalThis.PackSwiftActivityDiscovery=(()=>{
 const model=globalThis.PackSwiftActivities;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 let filter='all',visible=20,lastPool;
 const mediaCache=new Map();
 const photoObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){photoObserver.unobserve(entry.target);entry.target.loadPhoto?.();}},{rootMargin:'160px'});
 function category(p){const t=[...(p.types||[]),...(p.categories||[])].join(' ');return /cafe/.test(t)?['☕','Cafe']:/restaurant|food|dining/.test(t)?['🍽','Restaurant']:/beach/.test(t)?['☀','Beach']:/nature|park|hiking/.test(t)?['♧','Nature']:/nightlife|bar/.test(t)?['☾','Nightlife']:/shopping|market/.test(t)?['◇','Shopping']:['⌂','Culture'];}
 function mediaFor(p){
  const key=model.identity(p)+'|'+(p.imageUrl||'');if(mediaCache.has(key))return mediaCache.get(key);
  const media=el('div',null,'activity-media'),[icon,label]=category(p);
  function fallback(state,message){media.dataset.state=state;media.replaceChildren();const box=el('div',null,'activity-fallback'),symbol=el('span',icon);symbol.setAttribute('aria-hidden','true');box.append(symbol,el('strong',label),el('small',message));media.append(box);}
  fallback(p.imageUrl?'loading':'missing',p.imageUrl?'Loading photo…':'Category illustration · no photo supplied');
  if(p.imageUrl){let started=false;media.loadPhoto=async()=>{if(started)return;started=true;try{
   let source=p.imageUrl;
   if(source.startsWith('/api/activities/photo/')){const response=await fetch(source);if(!response.ok){let code='PHOTO_REQUEST_FAILED';try{code=(await response.json()).code||code;}catch{}fallback(response.status===404?'missing':code==='PHOTO_CONFIGURATION'?'configuration':'error',response.status===404?'Category illustration · no photo supplied':code==='PHOTO_CONFIGURATION'?'Photo service unavailable':'Photo could not load');return;}const blob=await response.blob();if(!blob.type.startsWith('image/'))throw Error('Invalid photo response');source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}
   const image=el('img');image.alt=p.title||p.name;image.width=640;image.height=360;image.decoding='async';image.onload=()=>{media.dataset.state='ready';media.querySelector('.activity-fallback')?.remove();};image.onerror=()=>fallback('error','Photo could not load');image.src=source;media.append(image);
  }catch{fallback('error','Photo could not load');}};photoObserver.observe(media);}
  mediaCache.set(key,media);if(mediaCache.size>100){for(const[k,old]of mediaCache){if(!old.isConnected&&old!==media){photoObserver.unobserve(old);if(old.objectUrl)URL.revokeObjectURL(old.objectUrl);mediaCache.delete(k);break;}}}return media;
 }
 function render(root,state,onSelect,onSkip,onRemove){
  root.replaceChildren();if(lastPool!==state.places){visible=20;filter='all';lastPool=state.places;}
  const result=state.activityResult,pool=state.places.filter(p=>!state.skipped.includes(model.identity(p)));
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
   for(const p of group.places){if(count++>=visible)break;const card=el('article',null,'activity-card');card.append(mediaFor(p));
    const content=el('div',null,'activity-card-content'),title=el('h5',p.title||p.name);title.title=p.title||p.name;content.append(el('small',(p.tripType||'in_city').replaceAll('_',' ').toUpperCase()),title,el('small',category(p)[1]));
    if(p.matchedInterests?.length)content.append(el('small',`Matches “${p.matchedInterests.join(', ')}”`,'activity-match'));
    const dining=/restaurant|cafe|food|dining/.test([...(p.types||[]),...(p.categories||[])].join(' '));
    content.append(el('small',`${p.priceLevel==='PRICE_LEVEL_FREE'?'Provider indicates free':p.ticket||(dining?'Price information unavailable':'Admission price unavailable')}${p.suggestedStayMin?' · '+(p.suggestedStayMin/60).toFixed(1)+' hrs suggested':''}`));
    const detail=el('details');detail.append(el('summary','Location & travel details'),el('p',p.travelContext||p.location||'Verify location before travel'));
    if(p.imageUrl){const credit=el('small',null,'activity-photo-credit');if(p.imageAuthors?.length){credit.append(document.createTextNode('Photo: '));for(const author of p.imageAuthors){const name=el(/^https:\/\//.test(author.url)?'a':'span',author.name);if(name.tagName==='A'){name.href=author.url;name.target='_blank';name.rel='noopener noreferrer';}credit.append(name,document.createTextNode(' · '));}credit.append(document.createTextNode('Google Maps'));}else credit.textContent=p.imageCredit||'Photo supplied by provider';content.append(credit);}content.append(detail);
    const selected=state.selected.some(s=>model.identity(s)===model.identity(p));card.dataset.selected=String(selected);
    const actions=el('div',null,'activity-actions');for(const [label,handler]of [[selected?'✓ Added':'+ Add to Trip',onSelect],['Skip',onSkip]]){const b=el('button',label);b.type='button';b.disabled=selected;b.setAttribute('aria-label',`${label}: ${p.title||p.name}`);b.onclick=()=>handler(p);actions.append(b);}card.append(content,actions);grid.append(card);
   }section.append(grid);root.append(section);
  }
  if(filtered.length>visible){const more=el('button',`Show more activities (${filtered.length-visible} remaining)`,'studio-secondary');more.type='button';more.onclick=()=>{visible+=20;render(root,state,onSelect,onSkip,onRemove);};root.append(more);}
  for(const p of state.selected.filter(p=>p.source!=='user_search')){const row=el('div',null,'studio-selected');row.append(el('span','✓ '+(p.title||p.name)));const b=el('button','Remove');b.type='button';b.setAttribute('aria-label','Remove '+(p.title||p.name));b.onclick=()=>onRemove(p);row.append(b);root.append(row);}
 }
 return {render};
})();
