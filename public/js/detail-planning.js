(() => {
 const form=document.getElementById('trip-planner-form');
 let tripId,entering=false,selected=[],rejected=[],pool=[],busy=false,saveTimer;
 const n=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 const id=p=>String(p.place_id||p.placeId||p.id||p.title||p.name);
 const api=(url,body,method='POST')=>window.PackSwift.api(url,{method,body:JSON.stringify(body)});
 const section=n('section');section.className='detail-place-stage';section.hidden=true;
 document.getElementById('smart-preview').after(section);
 const title=n('h2','Make this trip yours'),status=n('p'),list=n('div'),board=n('button','View selected Plan Board →');
 status.setAttribute('role','status');list.className='detail-place-grid';board.type='button';board.className='button button-primary';section.append(title,status,list,board);
 function fields(){return [...form.elements].filter(e=>e.name).map(e=>({name:e.name,value:e.value,checked:e.checked,type:e.type}));}
 async function save(){await api(`/api/trips/${tripId}/details`,{fields:fields(),selected,rejected},'PUT');}
 function render(){
  list.replaceChildren();const candidates=pool.filter(p=>!selected.some(s=>id(s)===id(p))&&!rejected.includes(id(p))).slice(0,6);
  status.textContent=`${selected.length} added to your plan board`;
  for(const place of candidates){const card=n('article');card.className='detail-place-card';const image=place.imageUrl||place.image;if(image){const img=n('img');img.src=image;img.alt='';img.loading='lazy';img.onerror=()=>img.remove();card.append(img);}
   card.append(n('h3',place.title||place.name),n('p',place.category||'Destination highlight'));
   const actions=n('div');for(const [label,add] of [['+',true],['✕',false]]){const b=n('button',label);b.type='button';b.setAttribute('aria-label',`${add?'Add':'Skip'} ${place.title||place.name}`);b.onclick=async()=>{if(busy)return;busy=true;actions.querySelectorAll('button').forEach(x=>x.disabled=true);if(add)selected.push(place);else rejected.push(id(place));try{await save();card.classList.add('is-leaving');setTimeout(()=>{render();status.textContent=add?'Added to plan board ✓':'Another place is ready to explore';busy=false;},220);}catch(e){if(add)selected.pop();else rejected.pop();status.textContent=e.message||'Could not save. Try again.';busy=false;actions.querySelectorAll('button').forEach(x=>x.disabled=false);}};actions.append(b);}card.append(actions);list.append(card);
  }
  if(!candidates.length)list.append(n('p','You’ve reviewed this collection. Your selected places are ready below.'));
 }
 async function enter(input,places){
  if(entering)return;entering=true;const toast=document.getElementById('preview-toast');toast.textContent='Saving your trip…';
  try{
   if(!tripId){
    const existing=new URLSearchParams(location.search).get('trip_id');
    if(existing){const r=await window.PackSwift.api(`/api/trips/${encodeURIComponent(existing)}`);tripId=existing;const d=r.trip?.preferences?.detailPlanning;selected=d?.selected||[];rejected=d?.rejected||[];for(const f of d?.fields||[]){for(const el of form.elements){if(el.name!==f.name)continue;if(el.type==='checkbox'||el.type==='radio'){if(el.value===f.value)el.checked=!!f.checked;}else el.value=f.value;}}}
    else{const r=await api('/api/trips/analyze',input);if(!r.persistence?.saved||!r.persistence.tripId)throw Error('Your trip could not be saved. Please try again.');tripId=r.persistence.tripId;}
   }
   await save();
   pool=[...new Map([...places,...(window.PackSwiftTripEngine?.knowledge(input.destination)||[])].map(p=>[id(p),p])).values()];
   document.body.classList.add('planning-details-active');
   form.querySelectorAll('[data-deferred-planner-section]').forEach(el=>{el.hidden=false;if(el.tagName==='DETAILS')el.open=true;});
   form.querySelectorAll('.form-grid > *').forEach(el=>{if(!el.hasAttribute('data-deferred-planner-section'))el.classList.add('detail-step-hidden');});
   document.getElementById('smart-preview').hidden=true;section.hidden=false;render();form.scrollTop=0;
   if(!document.getElementById('detail-exchange')){
    const box=n('section');box.id='detail-exchange';box.className='form-field-wide';box.append(n('h3','Currency exchange'));
    const label=n('label','Your currency');label.htmlFor='detail-base-currency';const select=n('select');select.id='detail-base-currency';select.name='exchangeBase';select.className='field-control';['USD','THB','EUR','JPY','SGD','MMK','GBP','CNY'].forEach(code=>{const o=n('option',code);o.value=code;select.append(o);});const rate=n('p','Choose a currency to check its rate.');rate.setAttribute('role','status');box.append(label,select,rate);form.querySelector('.form-grid').append(box);
    select.onchange=async()=>{rate.textContent='Checking exchange rate…';try{const r=await window.PackSwift.api(`/api/trips/currency-rate?base=${select.value}&target=${encodeURIComponent(input.currency||'USD')}`);rate.textContent=`1 ${r.base} ≈ ${r.rate} ${r.target} · indicative rate; fees excluded`;}catch(e){rate.textContent=e.message||'Rate unavailable.';}};select.onchange();
   }
   history.replaceState(null,'',`/trip-planner?trip_id=${encodeURIComponent(tripId)}`);
  }catch(e){toast.textContent=e.message||'Unable to save your trip.';}finally{entering=false;}
 }
 form.addEventListener('change',()=>{if(!tripId)return;clearTimeout(saveTimer);saveTimer=setTimeout(()=>save().then(()=>{status.textContent='Preferences saved ✓';}).catch(e=>{status.textContent=e.message;}),400);});
 board.onclick=async()=>{if(!selected.length){status.textContent='Add at least one place first.';return;}try{await save();list.replaceChildren();selected.forEach((p,i)=>{const c=n('article');c.className='detail-place-card';c.append(n('small',`STOP ${String(i+1).padStart(2,'0')}`),n('h3',p.title||p.name),n('p',p.hours||'Opening hours not available'),n('p',p.ticket||'Check current entry prices'));list.append(c);});title.textContent='Your selected Plan Board';board.hidden=true;const back=n('button','← Back to places');back.type='button';back.onclick=()=>{back.remove();board.hidden=false;title.textContent='Make this trip yours';render();};section.append(back);}catch(e){status.textContent=e.message;}};
 window.PackSwiftDetails={enter};
})();
