(() => {
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const topics={'Relaxation & Wellness':'spas massage wellness gardens','Nature & Outdoor':'nature parks waterfalls beaches outdoor activities','Food, Drink & Culinary':'local restaurants food markets cooking classes','Shopping & Fashion':'shopping markets boutiques','Nightlife & Entertainment':'live music evening entertainment','Local Life & Socializing':'local neighborhoods cafes','Events, Festivals & Sports':'sports venues event venues','Content Creation & Photography':'scenic viewpoints photography landmarks','Water & Marine Activities':'boat tours snorkeling water activities','Culture, History & Heritage':'museums temples historic landmarks'};
 let host,current,signature='',version=0;
 window.PackSwiftItineraryDiscovery={mount(parent,input,selected){
  current={input,selected};
  if(!host){host=node('section');host.className='itinerary-discovery';host.append(node('h3','Arrival & departure'));
   for(const [name,label,type]of [['arrivalTime','Arrival time (destination local time)','time'],['arrivalLocation','Arrival airport, station or starting place','text'],['arrivalHotel','Hotel or accommodation (optional)','text'],['departureTime','Departure time (destination local time, optional)','time']]){const l=node('label',label),f=node('input');f.name=name;f.id='itinerary-'+name;f.type=type;f.setAttribute('form','trip-planner-form');f.maxLength=200;l.append(f);host.append(l);f.addEventListener('change',()=>document.getElementById('trip-planner-form').dispatchEvent(new Event('input',{bubbles:true})));}
   const transportLabel=node('label','Getting between stops'),transport=node('select');transport.name='itineraryTransport';transport.id='itinerary-transport';transport.setAttribute('form','trip-planner-form');for(const [value,title]of [['TRANSIT','Public transport'],['WALK','Walking'],['DRIVE','Car / taxi']])transport.append(new Option(title,value));transportLabel.append(transport);host.append(transportLabel);transport.addEventListener('change',()=>document.getElementById('trip-planner-form').dispatchEvent(new Event('input',{bubbles:true})));
   const time=host.querySelector('#itinerary-arrivalTime');time.type='hidden';const picker=node('div');picker.className='arrival-time-picker';time.after(picker);
   const selects=['Hour','Minute','AM/PM'].map((label,index)=>{const s=node('select');s.setAttribute('aria-label','Arrival '+label);s.append(new Option(label,''));const values=index===0?Array.from({length:12},(_,i)=>String(i+1)):index===1?Array.from({length:60},(_,i)=>String(i).padStart(2,'0')):['AM','PM'];values.forEach(v=>s.append(new Option(v,v)));picker.append(s);return s;});
   host.syncTime=()=>{if(/^\d{2}:\d{2}$/.test(time.value)){const hour=Number(time.value.slice(0,2));selects[0].value=String(hour%12||12);selects[1].value=time.value.slice(3);selects[2].value=hour>=12?'PM':'AM';}};
   selects.forEach(s=>s.addEventListener('change',()=>{if(selects.every(x=>x.value!=='')){const hour=Number(selects[0].value)%12+(selects[2].value==='PM'?12:0);time.value=String(hour).padStart(2,'0')+':'+selects[1].value;time.dispatchEvent(new Event('change',{bubbles:true}));}}));
   for(const name of ['arrivalLocation','arrivalHotel']){const field=host.querySelector('#itinerary-'+name),list=node('datalist'),notice=node('small');list.id=name+'-suggestions';field.setAttribute('list',list.id);field.autocomplete='off';field.placeholder=name==='arrivalHotel'?'Search hotel or accommodation':'Search airport or starting place';notice.setAttribute('role','status');field.after(list,notice);let timer,controller,seq=0;
    field.addEventListener('input',()=>{clearTimeout(timer);controller?.abort();const token=++seq,q=field.value.trim(),destination=current.input.destination||'';list.replaceChildren();notice.textContent='';if(q.length<2)return;timer=setTimeout(async()=>{controller=new AbortController();try{const r=await fetch('/api/places/transport-autocomplete?'+new URLSearchParams({q,destination}),{signal:controller.signal});if(!r.ok)throw Error();const items=await r.json();if(token!==seq||destination!==(current.input.destination||''))return;items.forEach(p=>list.append(new Option(p.name,[p.name,p.address].filter(Boolean).join(', '))));notice.textContent=items.length?'Google Maps':'No matches. Try another spelling.';}catch(e){if(e.name!=='AbortError'&&token===seq)notice.textContent='Suggestions unavailable. Enter the address.';}},350);});
   }
   const heading=node('h3','Your interested places'),status=node('p'),results=node('div');heading.dataset.interestsHeading='true';results.className='itinerary-shortlist';status.setAttribute('role','status');host.append(heading,results,status);
   host.updateSelection=()=>{
    const {input,selected}=current,model=PackSwiftActivityChoicesModel,field=document.getElementById('activity-choices-state'),state=model.parse(field?.value);
    const entry=state.destinations.find(d=>model.destinationKey(d.destination)===model.destinationKey(input.destination));
    const liked=(entry?.choices||[]).filter(c=>c.vote==='up'),next=JSON.stringify([input.destination,input.startDate,input.endDate,input.itineraryPreferences,liked,selected.map(PackSwiftPlaceSearchModel.identity)]);
    if(next===signature)return;signature=next;results.replaceChildren();status.textContent='';
    if(!liked.length){results.append(node('p','Like an activity to keep it here, or search for a place above.'));return;}
    const days=Math.max(0,Math.min(91,Math.round((Date.parse(input.endDate)-Date.parse(input.startDate))/86400000)+1))||0;
    for(const choice of liked){
     const row=node('article');row.className='itinerary-shortlist-row';row.append(node('strong',choice.title));const controls=node('div');controls.className='shortlist-actions';
     const day=node('select');day.setAttribute('aria-label','Choose day for '+choice.title);day.append(new Option('Flexible day',''));for(let n=1;n<=days;n++)day.append(new Option('Day '+n,String(n)));
     const added=selected.some(p=>PackSwiftPlaceSearchModel.identity(p)===choice.id),add=node('button',added?'In itinerary':'Add to day');add.type='button';add.disabled=added;day.disabled=added;
     if(added)day.value=String(input.itineraryPreferences?.activityPreferences?.find(p=>p.activityId===choice.id)?.preferredDay||'');
     add.onclick=async()=>{const destination=input.destination;add.disabled=true;add.textContent='Adding…';try{const r=await fetch('/api/places/'+encodeURIComponent(choice.id)+'?'+new URLSearchParams({destination}));const place=await r.json();if(!r.ok)throw Error(place.message||'Could not add this place. Try again.');if(destination!==current.input.destination)return;window.dispatchEvent(new CustomEvent('packswift:add-itinerary-place',{detail:{...place,requestedDay:day.value?Number(day.value):null}}));}catch(e){status.textContent=e.message;add.disabled=false;add.textContent='Add to day';}};
     const remove=node('button','Remove');remove.type='button';remove.setAttribute('aria-label','Remove '+choice.title+' from shortlist');remove.onclick=()=>{field.value=JSON.stringify(model.setVote(model.parse(field.value),input.destination,{id:choice.id,title:choice.title},null));field.dispatchEvent(new Event('input',{bubbles:true}));};
     controls.append(day,add,remove);row.append(controls);results.append(row);
    }
   };
  }
  parent.prepend(host);
  const search=document.querySelector('.preview-interested-places');if(search)host.insertBefore(search,host.querySelector('[data-interests-heading]'));
  host.syncTime();
  host.updateSelection();
 }};
})();
