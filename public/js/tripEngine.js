/* Editable planning benchmarks; hours and admission must come from venue/provider data. */
globalThis.PackSwiftTripEngine = (() => {
  const matrix = {
    bangkok: {currency:'THB',daily:2400,spots:[['Grand Palace','culture temple','city'],['Ayutthaya Heritage Escape','culture history','escape'],['Khao Yai Nature Escape','nature hiking','escape'],['Pattaya & Koh Larn','beach island relax','coast'],['Koh Samet Island Escape','beach island','coast']]},
    tokyo: {currency:'JPY',daily:18000,spots:[['Shibuya','shopping city','city'],['Shinjuku','shopping food','city'],['Hakone','nature hiking','escape'],['Mount Fuji Area','nature hiking','escape'],['Kamakura','culture beach','coast']]},
    bali: {currency:'IDR',daily:1200000,spots:[['Ubud','culture nature','city'],['Canggu','beach cafe','coast'],['Seminyak','beach shopping','coast'],['Nusa Penida','nature adventure island','escape']]},
    hanoi: {currency:'VND',daily:1800000,spots:[['Old Quarter','culture food','city'],['Hoan Kiem Lake','nature relax','city'],['Ninh Binh','nature landscape','escape'],['Ha Long Bay','nature cruise','escape']]},
    singapore: {currency:'SGD',daily:220,spots:[['Marina Bay','city sightseeing','city'],['Chinatown','culture food','city'],['Katong','culture food','city'],['Sentosa','beach relax','coast']]},
    'da nang': {currency:'VND',daily:1600000,spots:[['Han Market','shopping food','city'],['Marble Mountains','nature culture','escape'],['My Khe Beach','beach relax','coast']]},
  };
  const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const aliases={bkk:'bangkok',sin:'singapore',tyo:'tokyo',dps:'bali',han:'hanoi',dad:'da nang'};
  const resolve = destination => {const name=normalize(destination);return matrix[aliases[name] || name] || Object.entries(matrix).find(([city])=>name.includes(city))?.[1];};
  const vocabulary={beach:['beach','beaches','coast','island'],nature:['nature','hiking','hike','mountain','landscape'],culture:['culture','temple','history','heritage'],shopping:['shopping','mall','market'],food:['food','culinary','restaurant','cafe'],relax:['relax','relaxation','leisure'],adventure:['adventure'],city:['city','sightseeing']};
  function parseTags(notes) {const words=normalize(notes).split(/\W+/);return Object.entries(vocabulary).filter(([,terms])=>terms.some(t=>words.some((w,i)=>w===t && !['no','avoid','without'].includes(words[i-1])))).map(([tag])=>tag);}
  function knowledge(destination) {
    const model=resolve(destination);if(!model)return [];
    return model.spots.map(([name,tags,zone],i)=>({id:`kb:${normalize(destination)}:${i}`,name,title:name,tags:tags.split(' '),zone,hours:null,ticketPrice:null,suggestedStayMin:zone==='city'?90:480,image:'/images/packswift1.jpg',dayWeight:zone==='city'?undefined:1,category:zone==='city'?'District exploration':'Regional escape',currency:model.currency,planningArea:true}));
  }
  function generateDynamicTrip(destination,durationDays,tripNotes,travelPace,style={}) {
    if(typeof style==='string')style={level:style};
    const model=resolve(destination),tags=parseTags(tripNotes),pace=normalize(travelPace);
    const requestedCap=/slow|relax/.test(pace)?2:/fast|packed/.test(pace)?5:3;
    const cap=style.accessibility && style.accessibility!=='standard'?Math.min(2,requestedCap):requestedCap;
    const count=Math.max(1,Math.min(90,Math.floor(Number(durationDays)||1)));
    const excluded=new Set(style.excluded || []);
    const identity=p=>String(p.placeId || p.place_id || p.id || p.title || p.name);
    const pool=style.places || knowledge(destination);
    const selected=[...new Map(pool.filter(p=>!p.isSample && !excluded.has(identity(p))).map(p=>[normalize(p.title || p.name),p])).values()].map(p=>{
      const match=tags.some(t=>normalize(`${(p.tags || []).join(' ')} ${p.category || ''} ${p.title || p.name}`).includes(t));
      return {...p,customRequest:p.customRequest || match,score:(match?10:0)+(p.customRequest?5:0)};
    }).sort((a,b)=>b.score-a.score);
    const segmented=count>=5 && tags.length>=2;
    const cityEnd=Math.ceil(count*.4),natureEnd=cityEnd+Math.floor(count*.3);
    const days=Array.from({length:count},(_,i)=>({day:i+1,label:segmented?(i<cityEnd?'City & Culture':i<natureEnd?'Nature & Regional Escapes':'Coastal & Relaxation'):'Destination Highlights',activities:[],load:0}));
    const unscheduled=[];
    selected.forEach(p=>{
      const weight=p.dayWeight || (p.suggestedStayMin>=360?1:1/cap);
      const desired=p.zone==='escape'?1:p.zone==='coast'?2:0;
      const eligible=days.filter(d=>d.activities.length<cap && d.load+weight<=1.001);
      eligible.sort((a,b)=>{
        const penalty=d=>segmented?((d.day<=cityEnd?0:d.day<=natureEnd?1:2)===desired?0:10):0;
        return penalty(a)-penalty(b)||a.load-b.load||a.day-b.day;
      });
      if(!eligible.length){unscheduled.push(p);return;}eligible[0].activities.push(p);eligible[0].load+=weight;
    });
    // Labels reflect what is actually allocated, including landlocked destinations.
    days.forEach(d=>{if(!d.activities.length)d.label='Free time';else if(segmented && !d.activities.some(p=>p.zone==='coast') && d.label==='Coastal & Relaxation')d.label='Local Exploration & Relaxation';});
    const currency=model?.currency || style.currency || 'USD';
    const factor=style.level==='budget'?.55:style.level==='luxury'?2.5:1;
    const daily=model?model.daily*factor:null,people=Math.max(1,Number(style.travelers)||1);
    const scheduled=days.flatMap(d=>d.activities);
    const tickets=scheduled.reduce((sum,p)=>sum+(typeof p.ticketPrice==='number' && p.currency===currency?p.ticketPrice:0),0)*people;
    const expenses={currency,accommodation:daily===null?null:Math.round(daily*.45*Math.max(0,count-1)*people),food:daily===null?null:Math.round(daily*.25*count*people),localTransport:daily===null?null:Math.round(daily*.15*count*people),attractionTickets:tickets,unpricedAttractions:scheduled.filter(p=>typeof p.ticketPrice!=='number'||p.currency!==currency).length,source:'Internal benchmarks; excludes intercity transfers and flights'};
    expenses.total=daily===null?null:expenses.accommodation+expenses.food+expenses.localTransport+tickets;
    return {days,routes:days.map(d=>d.activities),unscheduled,cap,expenses,tags};
  }
  return {matrix,knowledge,parseTags,generateDynamicTrip};
})();
