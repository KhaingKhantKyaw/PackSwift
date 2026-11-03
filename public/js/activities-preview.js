/* Destination discovery and reversible votes; form fields carry choices through login/save. */
(() => {
 'use strict';
 const model=window.PackSwiftActivityChoicesModel,field=document.getElementById('activity-choices-state');
 if(!field||!model)return;
 const storageKey='packswift:activity-choices:draft',params=new URLSearchParams(location.search);
 let host,list,status,retry,heading,counts,note,undo,sentinel,observer,destination='',signature='',version=0,timer,controller,storageAvailable=true,feed,style='',purposes=[],lastDismissal;
 const cache=new Map(),dismissed=new Map();
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
  list.querySelectorAll('[data-activity-id]').forEach(card=>{const vote=model.getVote(state,destination,card.dataset.activityId);card.hidden=rejections().has(card.dataset.activityId);card.dataset.vote=vote||'';card.querySelectorAll('[data-vote]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.vote===vote)));});
  note.textContent=storageAvailable?'Choices kept in your draft for 20 minutes. Save your plan to keep them.':'Choices stay on this page. Save your plan before leaving.';
 }
 function rejections(){const key=model.destinationKey(destination);if(!dismissed.has(key))dismissed.set(key,new Set());return dismissed.get(key);}
 function persist(state){field.value=JSON.stringify(state);try{sessionStorage.setItem(storageKey,JSON.stringify(model.toTemporary(state)));}catch{storageAvailable=false;}field.dispatchEvent(new Event('input',{bubbles:true}));}
 function choose(item,vote){
  const state=model.setVote(read(),destination,{id:item.id,title:item.name},vote);
  if(vote==='down'){rejections().add(item.id);lastDismissal={item,destination};undo.hidden=false;undo.textContent='Undo last dismissal';}
  persist(state);updateVotes();
  if(vote==='down'){drawFeed();undo.focus({preventScroll:true});if(available().length<feed.limit)load();}
 }
 function render(items){
  list.replaceChildren();
  for(const item of items){
   if(!item||typeof item.id!=='string'||typeof item.name!=='string')continue;
   const card=el('article',undefined,'activity-preview-card');card.dataset.activityId=item.id;
   const media=el('div',undefined,'activity-preview-photo'),src=safeURL(item.imageUrl);
   if(src){const img=el('img');img.src=src;img.alt=item.name;img.loading='lazy';img.onerror=()=>media.replaceChildren(el('span','Photo unavailable'));media.append(img);}else media.append(el('span','Photo unavailable'));
   const body=el('div',undefined,'activity-preview-body'),title=el('h3',item.name),rating=el('p',undefined,'activity-preview-rating');
   if(typeof item.rating==='number'&&item.rating>0&&item.rating<=5){rating.append(el('span','★','activity-rating-star'),el('strong',item.rating.toFixed(1)));if(Number.isInteger(item.ratingCount)&&item.ratingCount>0)rating.append(el('span',`(${item.ratingCount.toLocaleString()} reviews)`));}else rating.textContent='Rating unavailable';
   const actions=el('div',undefined,'activity-preview-actions');actions.setAttribute('role','group');actions.setAttribute('aria-label','Your preference for '+item.name);
   for(const [vote,label]of [['up','Interested'],['down','Not for me']]){const button=el('button');button.type='button';button.dataset.vote=vote;button.setAttribute('aria-label',(vote==='up'?'Interested in ':'Not interested in ')+item.name);button.title=label;button.append(thumb(vote==='down'),el('span',label));button.onclick=()=>choose(item,vote);actions.append(button);}
   body.append(title);if(item.purpose)body.append(el('small',item.purpose,'activity-match-label'));body.append(rating,actions);
   const credits=el('div',undefined,'activity-preview-credits');
   for(const author of Array.isArray(item.imageAuthors)?item.imageAuthors:[]){if(!author?.name)continue;const url=safeURL(author.url),credit=el(url?'a':'span',author.name);if(url){credit.href=url;credit.target='_blank';credit.rel='noopener noreferrer';}credits.append(credit);}
   card.append(media);if(credits.childNodes.length)card.append(credits);card.append(body);list.append(card);
  }
  updateVotes();
 }
 const available=()=>feed?feed.items.filter(item=>!rejections().has(item.id)):[];
 const hasMore=()=>Boolean(feed?.streams.some(stream=>stream.variant<3));
 function drawFeed(){
  if(!feed)return;render(available().slice(0,feed.limit));
  retry.hidden=!hasMore()&&available().length<=feed.limit;
  retry.disabled=feed.loading;retry.textContent=feed.error?'Try again':'More activities';
  status.textContent=feed.loading?'Finding more matches…':feed.error||(!hasMore()&&available().length<=feed.limit?'You’ve reached the available matches. Change your purposes or style to explore more.':'Google Maps ratings · matched to your purposes and style');
 }
 function more(){if(!feed||feed.loading||timer)return;feed.limit+=6;drawFeed();if(available().length<feed.limit)load();}
 async function load(force=false){
  if(!feed||feed.loading||!hasMore())return;
  const token=version,active=feed,city=destination,travelStyle=style;active.loading=true;active.requestVersion=token;active.error='';controller=new AbortController();const signal=controller.signal;
  list.setAttribute('aria-busy','true');drawFeed();
  try{
   // Bound each refill; further pages require scrolling, dismissing, or pressing More.
   for(let round=0;round<3&&token===version&&((force&&round===0)||available().length<active.limit)&&hasMore();round++){
    const streams=active.streams.filter(stream=>stream.variant<3);
    const pages=await Promise.all(streams.map(async stream=>{
     try{const query=new URLSearchParams({destination:city,purpose:stream.purpose,style:travelStyle,variant:String(stream.variant)});if(stream.pageToken)query.set('pageToken',stream.pageToken);
      const response=await fetch('/api/places/popular-activities?'+query,{signal}),data=await response.json();
      if(!response.ok||!Array.isArray(data.items))throw Error(data.message||'Activities are unavailable. Please try again.');
      return {stream,data};
     }catch(error){return {stream,error};}
    }));
    if(token!==version)return;
    const batches=[];
    for(const {stream,data,error} of pages){
     if(error){if(error.name!=='AbortError')active.error=error.message;continue;}
     batches.push(data.items.map(item=>({...item,purpose:stream.purpose})));
     if(typeof data.nextPageToken==='string'&&data.nextPageToken&&!stream.tokens.has(data.nextPageToken)){stream.pageToken=data.nextPageToken;stream.tokens.add(data.nextPageToken);}else{stream.variant++;stream.pageToken='';stream.tokens.clear();}
    }
    // Interleave sources so a first purpose cannot crowd out the others.
    for(let index=0;index<Math.max(0,...batches.map(batch=>batch.length));index++)for(const batch of batches){const item=batch[index];if(item&&typeof item.id==='string'&&typeof item.name==='string'&&!active.seen.has(item.id)){active.seen.add(item.id);active.items.push(item);}}
    if(active.error)break;
   }
  }finally{if(active.requestVersion===token)active.loading=false;if(token===version){list.removeAttribute('aria-busy');drawFeed();}}
 }
 function mount(parent,input){
  if(!host){
   host=el('section',undefined,'activities-discovery');heading=el('p',undefined,'activities-destination');counts=el('small',undefined,'activities-vote-count');counts.setAttribute('role','status');
   status=el('small',undefined,'activities-provider-status');status.setAttribute('role','status');retry=el('button','More activities','activities-refresh');retry.type='button';retry.onclick=()=>feed?.error?load(true):more();
   undo=el('button','Undo last dismissal','activities-undo');undo.type='button';undo.hidden=true;undo.onclick=()=>{if(!lastDismissal||lastDismissal.destination!==destination)return;const item=lastDismissal.item;rejections().delete(item.id);persist(model.setVote(read(),destination,{id:item.id,title:item.name},null));lastDismissal=null;undo.hidden=true;drawFeed();};
   list=el('div',undefined,'activities-card-list');sentinel=el('div',undefined,'activities-scroll-sentinel');sentinel.setAttribute('aria-hidden','true');note=el('small',undefined,'activities-draft-note');host.append(heading,counts,undo,list,sentinel,status,retry,note);
   observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)&&feed&&!feed.loading&&!feed.error&&!timer&&list.children.length&&(hasMore()||available().length>feed.limit))more();},{root:parent.closest('[data-preview-section]'),rootMargin:'100px'});observer.observe(sentinel);
  }
  if(host.parentElement!==parent)parent.append(host);
  destination=String(input.destination||'').trim();style=String(input.travelStyle||'');try{purposes=JSON.parse(input.travelPurposes||'[]');}catch{purposes=[];}if(!Array.isArray(purposes))purposes=[];purposes=[...new Set(purposes.filter(value=>typeof value==='string'))].slice(0,10);if(!purposes.length&&input.travelPurposeCategory)purposes=[input.travelPurposeCategory];
  heading.textContent=destination?'Explore '+destination:'Activities';
  const next=JSON.stringify([model.destinationKey(destination),[...purposes].sort(),style]);
  if(next!==signature){signature=next;version++;controller?.abort();clearTimeout(timer);timer=null;lastDismissal=null;undo.hidden=true;list.replaceChildren();list.removeAttribute('aria-busy');feed=null;
   if(!destination||!purposes.length||!style){retry.hidden=true;status.textContent='Choose travel purposes and a travel style to see matching activities.';}
   else{const cached=cache.get(next);feed=cached&&Date.now()-cached.time<10*60*1000?cached:{time:Date.now(),items:[],seen:new Set(),limit:6,loading:false,error:'',streams:purposes.map(purpose=>({purpose,variant:0,pageToken:'',tokens:new Set()}))};feed.loading=false;cache.set(next,feed);if(cache.size>10)cache.delete(cache.keys().next().value);updateVotes();drawFeed();if(available().length<feed.limit&&hasMore()){status.textContent='Finding matching activities…';timer=setTimeout(()=>{timer=null;load();},600);}}
  }
  updateVotes();
 }
 for(const event of ['packswift:planner-loaded','packswift:draft-restored'])window.addEventListener(event,()=>{field.value=JSON.stringify(read());updateVotes();drawFeed();});
 window.PackSwiftActivitiesPreview={mount};
})();
