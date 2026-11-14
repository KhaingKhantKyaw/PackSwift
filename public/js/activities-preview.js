/* Destination discovery and reversible votes; form fields carry choices through login/save. */
(() => {
 'use strict';
 const model=window.PackSwiftActivityChoicesModel,field=document.getElementById('activity-choices-state');
 if(!field||!model)return;
 const storageKey='packswift:activity-choices:draft',params=new URLSearchParams(location.search);
 let host,list,status,retry,heading,counts,note,undo,sentinel,observer,destination='',signature='',version=0,timer,controller,storageAvailable=true,feed,style='',purposes=[],lastDismissal;
 const cache=new Map(),dismissed=new Map(),pendingDismissals=new Map();
 const explored=new Set();
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
 const read=()=>model.parse(field.value);
 const safeURL=value=>{try{const url=new URL(value,location.origin);return url.protocol==='https:'||(url.origin===location.origin&&url.pathname.startsWith('/api/activities/photo/'))?url.href:'';}catch{return '';}};
 if(!params.has('trip_id')&&!params.has('resume_draft')){
  try{const state=model.fromTemporary(sessionStorage.getItem(storageKey));field.value=JSON.stringify(state);if(!state.destinations.length)sessionStorage.removeItem(storageKey);}catch{storageAvailable=false;}
 }
 function thumb(down){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
  const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M7 10v11H3V10h4Zm0 1 5-8c2 0 3 1 2 4l-1 3h6a2 2 0 0 1 2 2l-2 7a3 3 0 0 1-3 2H7');svg.append(path);if(down)svg.classList.add('thumb-down');return svg;
 }
 function updateVotes(){
  if(!host)return;const state=read(),entry=state.destinations.find(item=>model.destinationKey(item.destination)===model.destinationKey(destination));
  const up=entry?.choices.filter(choice=>choice.vote==='up').length||0,down=entry?.choices.filter(choice=>choice.vote==='down').length||0;
  counts.textContent=up||down?`${up} liked · ${down} not interested`:'';
  for(const choice of entry?.choices||[])if(choice.vote==='down')rejections().add(choice.id);
  list.querySelectorAll('[data-activity-id]').forEach(card=>{const vote=model.getVote(state,destination,card.dataset.activityId);card.hidden=rejections().has(card.dataset.activityId)&&!pendingDismissals.has(card.dataset.activityId);card.dataset.vote=vote||'';card.querySelectorAll('[data-vote]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.vote===vote)));});
  note.textContent=storageAvailable?'Choices kept in your draft for 20 minutes. Save your plan to keep them.':'Choices stay on this page. Save your plan before leaving.';
 }
 function rejections(){const key=model.destinationKey(destination);if(!dismissed.has(key))dismissed.set(key,new Set());return dismissed.get(key);}
 function persist(state){field.value=JSON.stringify(state);try{sessionStorage.setItem(storageKey,JSON.stringify(model.toTemporary(state)));}catch{storageAvailable=false;}field.dispatchEvent(new Event('input',{bubbles:true}));}
 function choose(item,vote){
  if(pendingDismissals.has(item.id))return;
  const state=model.setVote(read(),destination,{id:item.id,title:item.name},vote);
  if(vote==='down'){
   const card=[...list.children].find(node=>node.dataset.activityId===item.id);if(!card)return;
   const pending={card,ready:false,height:card.getBoundingClientRect().height,focused:card.contains(document.activeElement),version};
   pendingDismissals.set(item.id,pending);card.style.minHeight=pending.height+'px';card.setAttribute('aria-busy','true');
   card.querySelectorAll('button').forEach(button=>button.disabled=true);
   rejections().add(item.id);lastDismissal={item,destination,index:feed.items.findIndex(value=>value.id===item.id),previousVote:model.getVote(read(),destination,item.id)};undo.hidden=false;undo.textContent='Undo last dismissal';
   const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:180;
   card.animate([{opacity:1},{opacity:0}],{duration,easing:'ease-out'}).finished.then(()=>{
    if(pending.version!==version||pendingDismissals.get(item.id)!==pending)return;
    pending.ready=true;card.replaceChildren(el('p','Finding another activity…','activity-replacement-status'));drawFeed();
   }).catch(()=>{});
  }
  persist(state);updateVotes();
  if(vote==='down'&&available().length<feed.limit)load();
 }
 function render(items,replacementHeights=new Map()){
  const panel=host.closest('[data-preview-section]'),scrollTop=panel.scrollTop;
  const existing=new Map([...list.children].map(card=>[card.dataset.activityId,card]));
  let position=0;
  for(const item of items){
   if(!item||typeof item.id!=='string'||typeof item.name!=='string')continue;
   if(existing.has(item.id)){const card=existing.get(item.id);existing.delete(item.id);if(list.children[position]!==card)list.insertBefore(card,list.children[position]||null);position++;continue;}
   const card=el('article',undefined,'activity-preview-card');card.dataset.activityId=item.id;
   if(replacementHeights.has(item.id))card.style.minHeight=replacementHeights.get(item.id)+'px';
   const media=el('div',undefined,'activity-preview-photo'),src=safeURL(item.imageUrl);
   if(src){const img=el('img');img.src=src;img.alt=item.name;img.loading='lazy';img.onerror=()=>media.replaceChildren(el('span','Photo unavailable'));media.append(img);}else media.append(el('span','Photo unavailable'));
   const body=el('div',undefined,'activity-preview-body'),title=el('h3',item.name),rating=el('p',undefined,'activity-preview-rating');title.title=item.name;
   if(typeof item.rating==='number'&&item.rating>0&&item.rating<=5){rating.append(el('span','★','activity-rating-star'),el('strong',item.rating.toFixed(1)));if(Number.isInteger(item.ratingCount)&&item.ratingCount>0)rating.append(el('span',`(${item.ratingCount.toLocaleString()} reviews)`));}else rating.textContent='Rating unavailable';
   const actions=el('div',undefined,'activity-preview-actions');actions.setAttribute('role','group');actions.setAttribute('aria-label','Your preference for '+item.name);
   for(const [vote,label]of [['up','Interested'],['down','Not for me']]){const button=el('button');button.type='button';button.dataset.vote=vote;button.setAttribute('aria-label',(vote==='up'?'Interested in ':'Not interested in ')+item.name);button.title=label;button.append(thumb(vote==='down'),el('span',label));button.onclick=()=>choose(item,vote);actions.append(button);}
   body.append(title);if(item.purpose)body.append(el('small',item.purpose,'activity-match-label'));body.append(rating,actions);
   const credits=el('div',undefined,'activity-preview-credits');
   for(const author of Array.isArray(item.imageAuthors)?item.imageAuthors:[]){if(!author?.name)continue;const url=safeURL(author.url),credit=el(url?'a':'span',author.name);if(url){credit.href=url;credit.target='_blank';credit.rel='noopener noreferrer';}credits.append(credit);}
   card.append(media,credits,body);list.insertBefore(card,list.children[position]||null);position++;
  }
  for(const card of existing.values())card.remove();
  updateVotes();
  panel.scrollTop=scrollTop;
 }
 const available=()=>feed?feed.items.filter(item=>!rejections().has(item.id)):[];
 const hasMore=()=>Boolean(feed?.streams.some(stream=>stream.variant<3));
 function drawFeed(){
  if(!feed)return;
  const replacements=[],visible=new Set([...list.children].map(card=>card.dataset.activityId));
  for(const [id,pending] of pendingDismissals){
   if(!pending.ready)continue;
   const replacement=available().find(item=>!visible.has(item.id));
   if(replacement){
    feed.items.splice(feed.items.findIndex(item=>item.id===replacement.id),1);
    feed.items.splice(feed.items.findIndex(item=>item.id===id),0,replacement);
    pendingDismissals.delete(id);visible.add(replacement.id);replacements.push({replacement,pending});
   }else{
    pending.card.firstChild.textContent=feed.error?'Couldn’t load a replacement. Try again below.':feed.loading?'Finding another activity…':hasMore()?'Load more activities below to find a replacement.':'No more matching activities. Try different interests.';
    pending.card.setAttribute('aria-busy',String(feed.loading));
   }
  }
  render(feed.items.filter(item=>!rejections().has(item.id)||pendingDismissals.has(item.id)).slice(0,feed.displayLimit??feed.limit),new Map(replacements.map(({replacement,pending})=>[replacement.id,pending.height])));
  for(const {replacement,pending} of replacements){
   const card=[...list.children].find(node=>node.dataset.activityId===replacement.id);if(!card)continue;
   card.style.minHeight=pending.height+'px';
   if(pending.focused)card.querySelector('[data-vote="down"]').focus({preventScroll:true});
   card.animate([{opacity:0},{opacity:1}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:180,easing:'ease-in'});
  }
  retry.hidden=!hasMore()&&available().length<=feed.limit;
  retry.disabled=feed.loading;retry.textContent=feed.error?'Try again':'More activities';
  status.textContent=feed.loading?'Finding activities…':feed.error||(!available().length?(hasMore()?'No matches on this page. Try more activities.':'No matching activities found. Try another interest or destination.'):!hasMore()&&available().length<=feed.limit?'You’ve reached the available matches. Change your purposes or style to explore more.':purposes.length?(style?'Google Maps ratings · matched to your purposes and style':'Google Maps ratings · matched to your interests'):'Popular things to do · Google Maps');
 }
 function more(){if(!feed||feed.loading||timer)return;const previousLimit=feed.limit;feed.limit+=6;if(hasMore()&&(available().length<feed.limit||feed.streams.some(s=>!s.requests))){feed.displayLimit=previousLimit;load(true);}else drawFeed();}
 async function load(force=false){
  if(!feed||feed.loading||!hasMore())return;
  const token=version,active=feed,city=destination,travelStyle=style,lastShown=list.lastElementChild?.dataset.activityId;active.loading=true;active.requestVersion=token;active.error='';controller=new AbortController();const signal=controller.signal;
  list.setAttribute('aria-busy','true');drawFeed();
  try{
   // One refill serves at most three interests. Rotate to unserved interests
   // first; don't burn three rounds of quota automatically for an empty result.
   if((force||available().length<active.limit)&&hasMore()){
    const streams=active.streams.filter(stream=>stream.variant<3).sort((a,b)=>(a.requests||0)-(b.requests||0)).slice(0,3);
    const pages=await Promise.all(streams.map(async stream=>{
     try{const query=new URLSearchParams({destination:city,variant:String(stream.variant)});if(stream.purpose)query.set('purpose',stream.purpose);if(travelStyle)query.set('style',travelStyle);if(stream.pageToken)query.set('pageToken',stream.pageToken);
      const response=await fetch('/api/places/popular-activities?'+query,{signal});
      if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Activity search is unavailable on this site right now. Please try again.');
      const data=await response.json().catch(()=>null);
      if(!response.ok||!Array.isArray(data?.items))throw Error(typeof data?.message==='string'?data.message:response.status===429?'Too many activity searches. Wait a minute and try again.':'Activities are unavailable. Please try again.');
      return {stream,data};
     }catch(error){return {stream,error};}
    }));
    if(token!==version)return;
    const batches=[];
    for(const {stream,data,error} of pages){
     if(error){if(error.name!=='AbortError')active.error=error instanceof TypeError?'Could not reach activity search. Check your connection and try again.':error.message;continue;}
     stream.requests=(stream.requests||0)+1;
     batches.push(data.items.map(item=>({...item,purpose:stream.purpose})));
     if(typeof data.nextPageToken==='string'&&data.nextPageToken&&!stream.tokens.has(data.nextPageToken)){stream.pageToken=data.nextPageToken;stream.tokens.add(data.nextPageToken);}else{stream.variant++;stream.pageToken='';stream.tokens.clear();}
    }
    // Interleave sources so a first purpose cannot crowd out the others.
    const added=[];for(let index=0;index<Math.max(0,...batches.map(batch=>batch.length));index++)for(const batch of batches){const item=batch[index];if(item&&typeof item.id==='string'&&typeof item.name==='string'&&!active.seen.has(item.id)){active.seen.add(item.id);added.push(item);}}
    // Keep shown cards stable but prioritize the newly requested interests ahead of surplus unseen cards.
    const after=active.items.findIndex(item=>item.id===lastShown)+1;
    active.items.splice(after,0,...added);
   }
  }finally{if(active.requestVersion===token){active.loading=false;delete active.displayLimit;}if(token===version){list.removeAttribute('aria-busy');drawFeed();}}
 }
 function beginFeed(){
  const cached=cache.get(signature);
  feed=cached&&Date.now()-cached.time<10*60*1000?cached:{time:Date.now(),items:[],seen:new Set(),limit:6,loading:false,error:'',streams:(purposes.length?purposes:[null]).map(purpose=>({purpose,variant:0,pageToken:'',tokens:new Set(),requests:0}))};
  feed.loading=false;delete feed.displayLimit;cache.set(signature,feed);if(cache.size>10)cache.delete(cache.keys().next().value);
  updateVotes();drawFeed();if(available().length<feed.limit&&hasMore()){status.textContent='Finding activities…';timer=setTimeout(()=>{timer=null;load();},600);}
 }
 function mount(parent,input){
  if(!host){
   host=el('section',undefined,'activities-discovery');heading=el('p',undefined,'activities-destination');counts=el('small',undefined,'activities-vote-count');counts.setAttribute('role','status');
   status=el('small',undefined,'activities-provider-status');status.setAttribute('role','status');retry=el('button','More activities','activities-refresh');retry.type='button';retry.onclick=()=>{if(feed){if(feed.error)load(true);else more();}else if(destination.length>=2){explored.add(model.destinationKey(destination));beginFeed();}};
   undo=el('button','Undo last dismissal','activities-undo');undo.type='button';undo.hidden=true;undo.onclick=()=>{if(!lastDismissal||lastDismissal.destination!==destination)return;const {item,index,previousVote}=lastDismissal;pendingDismissals.delete(item.id);[...list.children].find(card=>card.dataset.activityId===item.id)?.remove();const current=feed.items.findIndex(value=>value.id===item.id);if(current>=0)feed.items.splice(current,1);feed.items.splice(index,0,item);rejections().delete(item.id);persist(model.setVote(read(),destination,{id:item.id,title:item.name},previousVote));lastDismissal=null;undo.hidden=true;drawFeed();};
   list=el('div',undefined,'activities-card-list');sentinel=el('div',undefined,'activities-scroll-sentinel');sentinel.setAttribute('aria-hidden','true');note=el('small',undefined,'activities-draft-note');host.append(heading,counts,list,sentinel,status,retry,undo,note);
   if('IntersectionObserver' in window){observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)&&feed&&!feed.loading&&!feed.error&&!timer&&list.children.length&&(hasMore()||available().length>feed.limit))more();},{root:parent.closest('[data-preview-section]'),rootMargin:'100px'});observer.observe(sentinel);}
  }
  if(host.parentElement!==parent)parent.append(host);
  destination=String(input.destination||'').trim();style=String(input.travelStyle||'');try{purposes=JSON.parse(input.travelPurposes||'[]');}catch{purposes=[];}if(!Array.isArray(purposes))purposes=[];purposes=[...new Set(purposes.filter(value=>typeof value==='string'))].slice(0,10);if(!purposes.length&&input.travelPurposeCategory)purposes=[input.travelPurposeCategory];
  heading.textContent=destination?'Explore '+destination:'Activities';
  const next=JSON.stringify([model.destinationKey(destination),[...purposes].sort(),style]);
  if(next!==signature){signature=next;version++;controller?.abort();clearTimeout(timer);timer=null;pendingDismissals.clear();lastDismissal=null;undo.hidden=true;list.replaceChildren();list.removeAttribute('aria-busy');feed=null;
   if(destination.length<2){retry.hidden=true;status.textContent='Choose a destination to explore activities.';}
   else if(!purposes.length&&!explored.has(model.destinationKey(destination))){retry.hidden=false;retry.disabled=false;retry.textContent='Explore popular activities';status.textContent='Browse popular activities or choose interests for closer matches.';}
   else beginFeed();
  }
  updateVotes();
 }
 for(const event of ['packswift:planner-loaded','packswift:draft-restored'])window.addEventListener(event,()=>{field.value=JSON.stringify(read());updateVotes();drawFeed();});
 // A pending replacement must never reclaim focus after the user moves elsewhere.
 for(const event of ['focusin','pointerdown'])document.addEventListener(event,event=>{for(const pending of pendingDismissals.values())if(!pending.card.contains(event.target))pending.focused=false;});
 document.addEventListener('keydown',event=>{if(event.key==='Tab')for(const pending of pendingDismissals.values())pending.focused=false;});
 window.PackSwiftActivitiesPreview={mount};
})();
