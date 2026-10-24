(() => {
 const states=new Map();let stayNear='';
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 window.PackSwiftBookingPreview={mount(root,input,targets){
  const payload=Object.fromEntries(['origin','destination','startDate','endDate','adults','children','currency','travelStyle'].map(k=>[k,input[k]]));
  const key=JSON.stringify(payload);if(!states.has(key)){if(states.size>20)states.delete(states.keys().next().value);states.set(key,{ages:[]});}const state=states.get(key);
  const area=el('section');area.className='booking-live-results';if(!targets)root.append(area);
  const draw=()=>{area.replaceChildren();if(targets)for(const target of Object.values(targets))target.querySelector('.booking-embedded')?.remove();
   for(const kind of ['flights','hotels']){
    if(kind==='flights'&&(input.entryMode!=='air'||input.tripType==='local'))continue;
    const group=el('section');group.className=targets?'booking-embedded':'booking-option-panel';const controls=el('div');controls.className='booking-option-controls';const header=el('header');header.className='booking-option-header';if(!targets)header.append(el('h3',kind==='flights'?'Flight options':'Stay options'));group.append(header);(targets?.[kind]||area).append(group);group.append(controls);
    try{state.ages=JSON.parse(document.getElementById('traveler-child-ages')?.value||'[]');}catch{state.ages=[];}
    if(kind==='hotels'){
     const label=el('label','Stay near'),field=el('input'),list=el('datalist'),hint=el('small');field.type='text';field.maxLength=250;field.placeholder='Search place…';field.value=stayNear;list.id='stay-near-suggestions';field.setAttribute('list',list.id);label.append(field,list);const filter=el('div');filter.className='booking-stay-filter';filter.append(label);header.append(filter);controls.append(hint);let timer,sequence=0;
     field.oninput=()=>{stayNear=field.value;delete state.hotels;const version=++sequence;clearTimeout(timer);list.replaceChildren();hint.textContent='';if(stayNear.trim().length<2)return;timer=setTimeout(async()=>{try{const r=await fetch('/api/places/transport-autocomplete?'+new URLSearchParams({q:stayNear,destination:input.destination}));if(!r.ok)throw Error();const places=await r.json();if(version!==sequence||!field.isConnected)return;for(const p of places)list.append(new Option(p.name,[p.name,p.address].filter(Boolean).join(', ')));hint.textContent='Suggestions by Google Maps. Confirm property location before booking.';}catch{if(version===sequence)hint.textContent='Enter a place or address to search nearby stays.';}},350);};
    }
    const record=state[kind],b=el('button',record?.loading?'Searching…':`Search ${kind==='flights'?'flights':'stays'}`);b.type='button';b.className='booking-search-link';b.disabled=Boolean(record?.loading)||!input.destination||!input.startDate||!input.endDate;
    b.onclick=async()=>{state[kind]={loading:true};draw();try{const response=await fetch('/api/booking-search/'+kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,stayNear:kind==='hotels'?stayNear:undefined,childAges:state.ages})});if(!(response.headers.get('content-type')||'').includes('application/json'))throw new Error('Booking search is not available on this server yet. Restart PackSwift and refresh this page.');const data=await response.json();if(!response.ok)throw new Error(data.error||'Search unavailable.');state[kind]={data};}catch(e){state[kind]={error:e.message||'Search unavailable. Please try again.'};}state.draw();};controls.append(b);
    const results=el('div');results.className='booking-results-scroll';results.tabIndex=0;results.setAttribute('role','region');results.setAttribute('aria-label',kind==='flights'?'Flight search results':'Stay search results');group.append(results);
    const status=el('p',record?.loading?'Looking for options…':record?.error||'');status.setAttribute('role','status');results.append(status);
    if(record?.data){const data=record.data;group.append(el('small',`${data.source} · ${new Date(data.searchedAt).toLocaleTimeString()}${data.cached?' · cached':''}`));if(!data.items.length)group.append(el('p','No options found. Try other dates or the external search.'));
     for(const item of data.items){
      const card=el('article');card.className='booking-result';card.append(el('strong',item.title||'Travel option'),el('p',item.detail),el('strong',item.price),el('small',item.priceLabel));
      let url;try{const candidate=new URL(item.url);if(candidate.protocol==='https:'&&!candidate.username&&!candidate.password)url=candidate;}catch{}
      let label=kind==='flights'?'Compare route on Google Flights ↗':'View stay & booking options ↗';
      if(kind==='flights'&&item.linkLabel?.startsWith('View booking'))label='View flight booking options ↗';
      if(!url&&kind==='hotels'){
       url=new URL('https://www.booking.com/searchresults.html');
       Object.entries({ss:[item.title,input.destination].filter(Boolean).join(', '),checkin:input.startDate,checkout:input.endDate,group_adults:input.adults,group_children:Number(input.children)||0,selected_currency:input.currency||'USD'}).forEach(([k,v])=>{if(v!=null)url.searchParams.set(k,String(v));});
       for(const age of state.ages||[])if(Number.isInteger(age))url.searchParams.append('age',String(age));
       label='Find this stay on Booking.com ↗';
      }
      if(url){const a=el('a',label);a.className='booking-result-action';a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label',label+' (opens in a new tab)');card.append(a);}
      group.append(card);
     }
    }
    for(const child of [...group.children])if(child!==controls&&child!==results&&child!==header)results.append(child);
   }
  };state.draw=draw;draw();
 }};
})();
