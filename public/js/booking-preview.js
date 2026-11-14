(() => {
 const states=new Map();let activeKey='';
 const form=document.getElementById('trip-planner-form'),nearState=document.createElement('input');nearState.type='hidden';nearState.name='stayNearPreferences';nearState.id='stay-near-state';form.append(nearState);
 const nearValues=()=>{try{return JSON.parse(nearState.value||'{}');}catch{return {};}};
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 window.PackSwiftBookingPreview={mount(root,input,targets){
  const payload=Object.fromEntries(['origin','destination','startDate','endDate','adults','children','currency','travelStyle','childAges'].map(k=>[k,input[k]]));
  const bookingCurrency=window.PackSwiftCurrency.booking(input.origin);payload.currency=bookingCurrency.code;
  const destinationKey=String(input.destination||'').trim().toLowerCase();let stayNear=nearValues()[destinationKey]||'';
  const key=JSON.stringify(payload);activeKey=key;if(!states.has(key)){if(states.size>20)states.delete(states.keys().next().value);states.set(key,{ages:[]});}const state=states.get(key);
  const area=el('section');area.className='booking-live-results';if(!targets)root.append(area);
  const draw=()=>{area.replaceChildren();if(targets)for(const target of Object.values(targets))target.querySelector('.booking-embedded')?.remove();
   for(const kind of ['flights','hotels']){
    if(kind==='flights'&&(input.entryMode!=='air'||input.tripType==='local'))continue;
    const group=el('section');group.className=targets?'booking-embedded':'booking-option-panel';const controls=el('div');controls.className='booking-option-controls';const header=el('header');header.className='booking-option-header';if(!targets)header.append(el('h3',kind==='flights'?'Flight options':'Stay options'));group.append(header);(targets?.[kind]||area).append(group);group.append(controls);
    try{state.ages=JSON.parse(document.getElementById('traveler-child-ages')?.value||'[]');}catch{state.ages=[];}
    if(kind==='hotels'){
     const label=el('label','Stay near'),field=el('input'),list=el('datalist'),hint=el('small');field.type='text';field.maxLength=250;field.placeholder='Search place…';field.value=stayNear;list.id='stay-near-suggestions';field.setAttribute('list',list.id);label.append(field,list);const filter=el('div');filter.className='booking-stay-filter';filter.append(label);header.append(filter);controls.append(hint);let timer,sequence=0;
     field.onchange=()=>window.dispatchEvent(new Event('packswift:stash-draft'));
     field.oninput=()=>{stayNear=field.value;nearState.value=JSON.stringify({...nearValues(),[destinationKey]:stayNear});delete state.hotels;results.replaceChildren(el('p','Area changed. Search stays again.'));b.disabled=!bookingCurrency.known||!input.destination||!input.startDate||!input.endDate;b.textContent='Search stays';const version=++sequence;clearTimeout(timer);list.replaceChildren();hint.textContent='';if(stayNear.trim().length<2)return;timer=setTimeout(async()=>{try{const r=await fetch('/api/places/transport-autocomplete?'+new URLSearchParams({q:stayNear,destination:input.destination}));if(!r.ok)throw Error();const places=await r.json();if(version!==sequence||!field.isConnected)return;for(const p of places)list.append(new Option(p.name,[p.name,p.address].filter(Boolean).join(', ')));hint.textContent='Google Maps · confirm the property location.';}catch{if(version===sequence)hint.textContent='Enter a place or address to search nearby stays.';}},350);};
    }
    const record=state[kind],b=el('button',record?.loading?'Searching…':`Search ${kind==='flights'?'flights':'stays'}`);b.type='button';b.className='booking-search-link';b.disabled=Boolean(record?.loading)||!bookingCurrency.known||!input.destination||!input.startDate||!input.endDate;
    b.onclick=async()=>{
     const request={loading:true};state[kind]=request;draw();
     const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),60000);
     try{
      const response=await fetch('/api/booking-search/'+kind,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},signal:controller.signal,body:JSON.stringify({...payload,stayNear:kind==='hotels'?stayNear:undefined,childAges:state.ages})});
      if(!(response.headers.get('content-type')||'').includes('application/json'))throw new Error('This site could not return live booking results. Try the external search link.');
      const data=await response.json();
      if(!response.ok)throw new Error(data?.error||data?.message||'Search unavailable. Please try again.');
      if(!Array.isArray(data?.items)||data.items.some(item=>!item||typeof item!=='object'))throw new Error('Booking results were incomplete. Search again or use the external search link.');
      if(state[kind]!==request)return;state[kind]={data};
     }catch(e){
      if(state[kind]!==request)return;
      state[kind]={error:controller.signal.aborted?'Booking search timed out. Please try again.':e.message||'Search unavailable. Please try again.'};
     }finally{clearTimeout(timeout);}
     if(activeKey===key)state.draw();
    };controls.append(b);
    const currencyNote=el('small',record?.data?.currencyNotice||(!bookingCurrency.known?'Choose a recognized origin city or add its country (e.g. Toronto, Canada).':bookingCurrency.needsConversion?`Estimates in ${bookingCurrency.code} · original quotes in ${bookingCurrency.providerCode}`:`Prices in ${bookingCurrency.code} · origin currency`));currencyNote.className='booking-currency-note';currencyNote.setAttribute('role','status');controls.append(currencyNote);
    const results=el('div');results.className='booking-results-scroll';results.tabIndex=0;results.setAttribute('role','region');results.setAttribute('aria-label',kind==='flights'?'Flight search results':'Stay search results');group.append(results);
    const status=el('p',record?.loading?'Looking for options…':record?.error||'');status.setAttribute('role','status');results.append(status);
    if(record?.data){const data=record.data;group.append(el('small',`${data.source} · ${new Date(data.searchedAt).toLocaleTimeString()}${data.cached?' · cached':''}`));if(!data.items.length)group.append(el('p','No options found. Try other dates or the external search.'));
     for(const item of data.items){
      const card=el('article');card.className='booking-result';card.append(el('strong',item.title||'Travel option'),el('p',item.detail),el('strong',item.price),el('small',item.priceLabel));
      if(item.estimated&&item.originalPrice)card.append(el('small','Provider quote: '+item.originalPrice));
      let url;try{const candidate=new URL(item.url);if(candidate.protocol==='https:'&&!candidate.username&&!candidate.password)url=candidate;}catch{}
      let label=kind==='flights'?'Compare route on Google Flights ↗':'View stay & booking options ↗';
      if(kind==='flights'&&item.linkLabel?.startsWith('View booking'))label='View flight booking options ↗';
      if(url&&kind==='flights'&&/(^|\.)google\.[a-z.]+$/.test(url.hostname))url.searchParams.set('curr',bookingCurrency.providerCode);
      if(!url&&kind==='hotels'){
       url=new URL('https://www.booking.com/searchresults.html');
       Object.entries({ss:[item.title,input.destination].filter(Boolean).join(', '),checkin:input.startDate,checkout:input.endDate,group_adults:input.adults,group_children:Number(input.children)||0,selected_currency:bookingCurrency.providerCode}).forEach(([k,v])=>{if(v!=null)url.searchParams.set(k,String(v));});
       for(const age of state.ages||[])if(Number.isInteger(age))url.searchParams.append('age',String(age));
       label='Find this stay on Booking.com ↗';
      }
      if(url){const a=el('a',label);a.className='booking-result-action';a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label',label+' (opens in a new tab)');card.append(a);}
      group.append(card);
     }
     if(data.conversion){const rateDate=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(data.conversion.updatedAt));const note=el('small',`Estimated conversion · rate updated ${rateDate} (UTC). Payment rates may differ. `),attribution=el('a','Rates By Exchange Rate API');attribution.href='https://www.exchangerate-api.com';attribution.target='_blank';attribution.rel='noopener noreferrer';note.append(attribution);group.append(note);}
    }
    for(const child of [...group.children])if(child!==controls&&child!==results&&child!==header)results.append(child);
   }
  };state.draw=draw;draw();
 }};
})();
