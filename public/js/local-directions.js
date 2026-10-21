(() => {
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 let host,style='Balanced',city='';
 window.PackSwiftDirections={mount(parent,input){
  style=input.travelStyle||'Balanced';city=input.destination||'';if(host){parent.append(host);return;}
  host=node('section');host.className='booking-live-results local-directions';host.append(node('h3','How to get there'));
  const fields={};for(const [key,label,type]of [['from','From','text'],['to','To','text'],['departure','Depart at (your device time zone)','datetime-local']]){const l=node('label',label),f=node('input');f.type=type;f.setAttribute('aria-label',label);if(type==='text'){f.placeholder='Place or full address, including city';f.maxLength=250;}l.append(f);host.append(l);fields[key]=f;}
  for(const key of ['from','to']){
   const field=fields[key],list=node('datalist'),status=node('small');list.id='route-places-'+key;field.setAttribute('list',list.id);field.autocomplete='off';status.setAttribute('role','status');field.parentElement.append(list,status);
   let timer,controller,sequence=0;
   field.addEventListener('input',()=>{clearTimeout(timer);controller?.abort();const version=++sequence;list.replaceChildren();status.textContent='';const q=field.value.trim(),destination=city;if(q.length<2)return;
    timer=setTimeout(async()=>{controller=new AbortController();try{const params=new URLSearchParams({q,destination});const response=await fetch('/api/places/transport-autocomplete?'+params,{signal:controller.signal});if(!response.headers.get('content-type')?.includes('application/json'))throw Error();const data=await response.json();if(!response.ok)throw Error();if(version!==sequence||city!==destination)return;for(const place of data){const option=node('option');option.value=[place.name,place.address].filter(Boolean).join(', ');list.append(option);}status.textContent=data.length?'Suggestions by Google Maps':'No suggestions found. Try another spelling or add the city.';}catch(e){if(e.name!=='AbortError'&&version===sequence)status.textContent='Suggestions unavailable. Enter a full address instead.';}},350);
   });
  }
  host.append(node('small','Leave departure blank for now. Transit schedules are limited to the next 100 days. Driving times exclude live traffic; walking routes are estimates.'));
  const b=node('button','Compare routes');b.type='button';b.className='booking-search-link';const output=node('div');output.setAttribute('aria-live','polite');host.append(b,output);parent.append(host);
  let revision=0;Object.values(fields).forEach(f=>f.addEventListener('input',()=>{revision++;output.replaceChildren();}));
  b.onclick=async()=>{const version=++revision,from=fields.from.value.trim(),to=fields.to.value.trim();if(!from||!to){output.textContent='Enter both places, including their cities.';return;}
   output.replaceChildren(node('p','Comparing routes…'));b.disabled=true;
   const link=mode=>{const u=new URL('https://www.google.com/maps/dir/');Object.entries({api:'1',origin:from,destination:to,travelmode:mode}).forEach(([k,v])=>u.searchParams.set(k,v));const a=node('a','Open Google Maps directions ↗');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';return a;};
   try{const r=await fetch('/api/local-directions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,to,departure:fields.departure.value?new Date(fields.departure.value).toISOString():null})});if(!r.headers.get('content-type')?.includes('application/json'))throw Error('Restart PackSwift to enable directions.');const data=await r.json();if(!r.ok)throw Error(data.error);if(version!==revision)return;output.replaceChildren();
    const budget=/pocket|budget/i.test(style),order=budget?['TRANSIT','WALK','DRIVE']:['DRIVE','TRANSIT','WALK'];data.results.sort((a,b)=>order.indexOf(a.mode)-order.indexOf(b.mode));
    output.append(node('p',budget?'Public transport first for your budget preference—not a guaranteed cheapest fare. Compare walking and transfer time.':'Compare convenience, walking and transfers. Driving directions do not confirm taxi availability.'));
    for(const route of data.results){const card=node('article');card.className='booking-result';card.append(node('h4',{TRANSIT:'Public transport',DRIVE:'Driving / taxi route',WALK:'Walking'}[route.mode]));
     if(route.error)card.append(node('p',route.error));else{card.append(node('p',`${Math.ceil(parseFloat(route.duration)/60)} min · ${(route.distance/1000).toFixed(1)} km`));if(route.mode==='TRANSIT')card.append(node('p',`${route.transfers} transfers · ${Math.round(route.walking)} m walking`));const fare=route.fare;card.append(node('p',fare?`Estimated fare: ${fare.currencyCode} ${(Number(fare.units||0)+Number(fare.nanos||0)/1e9).toFixed(2)}`:route.mode==='WALK'?'No transport ticket fare':'Fare unavailable — check the operator or taxi app.'));const details=node('details');details.append(node('summary','Step-by-step directions'));const list=node('ol');route.steps.forEach(s=>list.append(node('li',[s.instruction,s.line,s.from&&s.to?`${s.from} → ${s.to}`:'',s.headsign?`Toward ${s.headsign}`:''].filter(Boolean).join(' · '))));details.append(list);card.append(details);}
     card.append(link({TRANSIT:'transit',DRIVE:'driving',WALK:'walking'}[route.mode]));output.append(card);
    }output.append(node('small','Google Maps · Confirm the interpreted locations and departure time before travel. Follow local signs and current service updates.'));
   }catch(e){if(version===revision)output.replaceChildren(node('p',e.message||'Directions unavailable.'),link('transit'));}finally{b.disabled=false;}
  };
 }};
})();
