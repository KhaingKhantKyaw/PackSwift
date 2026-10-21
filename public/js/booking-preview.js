(() => {
 const states=new Map();
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 window.PackSwiftBookingPreview={mount(root,input){
  const payload=Object.fromEntries(['origin','destination','startDate','endDate','adults','children','currency'].map(k=>[k,input[k]]));
  const key=JSON.stringify(payload);if(!states.has(key)){if(states.size>20)states.delete(states.keys().next().value);states.set(key,{ages:[]});}const state=states.get(key);
  const area=el('section');area.className='booking-live-results';root.append(area);
  const draw=()=>{area.replaceChildren();area.append(el('small','Search on demand · cached up to 10 minutes. Confirm final prices and availability with the provider.'));
   for(const kind of ['flights','hotels']){
    if(kind==='flights'&&(input.entryMode!=='air'||input.tripType==='local'))continue;
    const group=el('section');group.append(el('h3',kind==='flights'?'Flight options':'Stay options'));area.append(group);
    if(kind==='hotels'&&Number(input.children)>0){for(let c=0;c<Number(input.children);c++){const label=el('label',`Child ${c+1} age at check-in `),field=el('input');field.type='number';field.min='1';field.max='17';field.value=state.ages[c]??'';field.setAttribute('aria-label',`Child ${c+1} age at check-in`);field.onchange=()=>{state.ages[c]=field.value===''?null:Number(field.value);delete state.hotels;draw();};label.append(field);group.append(label);}group.append(el('small','Use 1 for a child under one year.'));}
    const record=state[kind],b=el('button',record?.loading?'Searching…':`Search ${kind==='flights'?'flights':'stays'}`);b.type='button';b.className='booking-search-link';b.disabled=Boolean(record?.loading)||!input.destination||!input.startDate||!input.endDate;
    b.onclick=async()=>{state[kind]={loading:true};draw();try{const response=await fetch('/api/booking-search/'+kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,childAges:state.ages})});if(!(response.headers.get('content-type')||'').includes('application/json'))throw new Error('Booking search is not available on this server yet. Restart PackSwift and refresh this page.');const data=await response.json();if(!response.ok)throw new Error(data.error||'Search unavailable.');state[kind]={data};}catch(e){state[kind]={error:e.message||'Search unavailable. Please try again.'};}state.draw();};group.append(b);
    const status=el('p',record?.loading?'Looking for options…':record?.error||'');status.setAttribute('role','status');group.append(status);
    if(record?.data){const data=record.data;group.append(el('small',`${data.source} · ${new Date(data.searchedAt).toLocaleTimeString()}${data.cached?' · cached':''}`));if(!data.items.length)group.append(el('p','No options found. Try other dates or the external search.'));
     for(const item of data.items){const card=el('article');card.className='booking-result';card.append(el('strong',item.title||'Travel option'),el('p',item.detail),el('strong',item.price),el('small',item.priceLabel));if(item.url){try{const url=new URL(item.url);if(url.protocol==='https:'){const a=el('a',kind==='flights'?'Compare on Google Flights ↗':'View property ↗');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';card.append(a);}}catch{}}group.append(card);}
    }
   }
  };state.draw=draw;draw();
 }};
})();
