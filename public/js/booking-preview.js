(() => {
 const states=new Map();let stayNear='';
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 window.PackSwiftBookingPreview={mount(root,input){
  const payload=Object.fromEntries(['origin','destination','startDate','endDate','adults','children','currency','travelStyle'].map(k=>[k,input[k]]));
  const key=JSON.stringify(payload);if(!states.has(key)){if(states.size>20)states.delete(states.keys().next().value);states.set(key,{ages:[]});}const state=states.get(key);
  const area=el('section');area.className='booking-live-results';root.append(area);
  const draw=()=>{area.replaceChildren();area.append(el('small','Search on demand · cached up to 10 minutes. Confirm final prices and availability with the provider.'));
   for(const kind of ['flights','hotels']){
    if(kind==='flights'&&(input.entryMode!=='air'||input.tripType==='local'))continue;
    const group=el('section');group.className='booking-option-panel';const controls=el('div');controls.className='booking-option-controls';group.append(el('h3',kind==='flights'?'Flight options':'Stay options'));area.append(group);group.append(controls);
    try{state.ages=JSON.parse(document.getElementById('traveler-child-ages')?.value||'[]');}catch{state.ages=[];}
    const budget=/pocket|budget/i.test(input.travelStyle||''),comfort=/comfort|luxury|full/i.test(input.travelStyle||'');
    controls.append(el('small',budget?'Lowest prices first':kind==='flights'?(/comfort|luxury/i.test(input.travelStyle||'')?'Shorter journeys first · compare fares':'Recommended flights · compare price and journey time'):(comfort?'Highest-rated stays first':'Recommended stays')));
    if(kind==='hotels'){
     const label=el('label','I would like to stay near (optional)'),field=el('input'),list=el('datalist'),hint=el('small');field.type='text';field.maxLength=250;field.placeholder='Search a landmark, beach or area';field.value=stayNear;list.id='stay-near-suggestions';field.setAttribute('list',list.id);label.append(field,list);const filter=el('div');filter.className='booking-stay-filter';filter.append(label,hint);area.insertBefore(filter,area.querySelector('.booking-option-panel'));let timer,sequence=0;
     field.oninput=()=>{stayNear=field.value;delete state.hotels;const version=++sequence;clearTimeout(timer);list.replaceChildren();hint.textContent='';if(stayNear.trim().length<2)return;timer=setTimeout(async()=>{try{const r=await fetch('/api/places/transport-autocomplete?'+new URLSearchParams({q:stayNear,destination:input.destination}));if(!r.ok)throw Error();const places=await r.json();if(version!==sequence||!field.isConnected)return;for(const p of places)list.append(new Option(p.name,[p.name,p.address].filter(Boolean).join(', ')));hint.textContent='Suggestions by Google Maps. Confirm property location before booking.';}catch{if(version===sequence)hint.textContent='Enter a place or address to search nearby stays.';}},350);};
    }
    const record=state[kind],b=el('button',record?.loading?'Searching…':`Search ${kind==='flights'?'flights':'stays'}`);b.type='button';b.className='booking-search-link';b.disabled=Boolean(record?.loading)||!input.destination||!input.startDate||!input.endDate;
    b.onclick=async()=>{state[kind]={loading:true};draw();try{const response=await fetch('/api/booking-search/'+kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,stayNear:kind==='hotels'?stayNear:undefined,childAges:state.ages})});if(!(response.headers.get('content-type')||'').includes('application/json'))throw new Error('Booking search is not available on this server yet. Restart PackSwift and refresh this page.');const data=await response.json();if(!response.ok)throw new Error(data.error||'Search unavailable.');state[kind]={data};}catch(e){state[kind]={error:e.message||'Search unavailable. Please try again.'};}state.draw();};controls.append(b);
    const results=el('div');results.className='booking-results-scroll';results.tabIndex=0;results.setAttribute('role','region');results.setAttribute('aria-label',kind==='flights'?'Flight search results':'Stay search results');group.append(results);
    const status=el('p',record?.loading?'Looking for options…':record?.error||'');status.setAttribute('role','status');results.append(status);
    if(record?.data){const data=record.data;group.append(el('small',`${data.source} · ${new Date(data.searchedAt).toLocaleTimeString()}${data.cached?' · cached':''}`));if(!data.items.length)group.append(el('p','No options found. Try other dates or the external search.'));
     for(const item of data.items){const card=el('article');card.className='booking-result';card.append(el('strong',item.title||'Travel option'),el('p',item.detail),el('strong',item.price),el('small',item.priceLabel));if(item.url){try{const url=new URL(item.url);if(url.protocol==='https:'){const a=el('a',item.linkLabel||(kind==='flights'?'Compare this route on Google Flights ↗':'View stay & booking options ↗'));a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';card.append(a);}}catch{}}const use=el('button','Use in budget');use.type='button';use.onclick=()=>window.dispatchEvent(new CustomEvent('packswift:budget-quote',{detail:{kind,title:item.title,price:item.price,basis:item.priceLabel,currency:input.currency,searchedAt:data.searchedAt,context:payload}}));card.append(use);group.append(card);}
    }
    for(const child of [...group.children])if(child!==controls&&child!==results&&child.tagName!=='H3')results.append(child);
   }
  };state.draw=draw;draw();
 }};
})();
