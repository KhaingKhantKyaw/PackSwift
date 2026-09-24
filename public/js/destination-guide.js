(() => {
  const dialog=document.createElement('dialog');dialog.className='destination-guide';dialog.setAttribute('aria-labelledby','guide-title');document.body.append(dialog);
  let opener, previousOverflow;
  const node=(tag,text,className)=>{const element=document.createElement(tag);if(text)element.textContent=text;if(className)element.className=className;return element;};
  const catalogPromise=fetch('/data/destinations.json').then(r=>{if(!r.ok)throw Error();return r.json();}).catch(()=>[]);
  let request=0;
  async function open(destination){
    const token=++request;opener=document.activeElement;
    if(!dialog.open){previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();}
    dialog.replaceChildren(node('p','Opening your destination guide…','guide-loading'));
    const catalog=await catalogPromise;if(token!==request || !dialog.open)return;
    const match=catalog.find(item=>item.name.toLowerCase()===destination.name.toLowerCase());const city={...match,...destination};
    const close=node('button','×','guide-close');close.type='button';close.setAttribute('aria-label','Close destination guide');close.addEventListener('click',()=>dialog.close());
    const hero=node('header',null,'guide-hero');const image=node('img');image.src=city.bgImage||city.cardImage||'/images/packswift1.jpg';image.alt='';image.referrerPolicy='no-referrer';image.addEventListener('error',()=>{image.src='/images/packswift1.jpg';},{once:true});
    const intro=node('div',null,'guide-intro');intro.append(node('span',`${city.country || 'Explore'} · PACKSWIFT POCKET GUIDE`,'guide-eyebrow'));const title=node('h2',city.name);title.id='guide-title';intro.append(title,node('p',city.description||`Discover ${city.name} through its neighbourhoods, local culture and signature places. Start with these ideas, then make the journey yours.`));hero.append(image,intro,close);
    const body=node('div',null,'guide-body');const facts=node('div',null,'guide-facts');
    const months=(city.bestMonths||[]).map(m=>new Intl.DateTimeFormat('en',{month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2026,m-1,1))));
    for(const [label,value] of [['Travel mood',(city.interests||[]).slice(0,3).join(' · ')||'Your choice'],['Season inspiration',months.join(' · ')||'Choose your dates'],['Your journey','Flexible & personal']]){const fact=node('div');fact.append(node('small',label),node('strong',value));facts.append(fact);}body.append(facts);
    const tabs=node('div',null,'guide-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Destination guide sections');const content=node('section',null,'guide-content');content.id='guide-panel';content.setAttribute('role','tabpanel');content.tabIndex=0;
    const labels=['Discover','Sample route','Budget & stay','Before you go'];
    function section(title,text){const box=node('article',null,'guide-info');box.append(node('h3',title),node('p',text));content.append(box);return box;}
    function render(index){tabs.querySelectorAll('button').forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;});content.setAttribute('aria-labelledby',`guide-tab-${index}`);content.replaceChildren();
      const attractions=Array.isArray(city.attractions)?city.attractions:[];
      if(index===0){section(`A little of ${city.name}`,city.description||`Explore ${city.name} at your own pace. Use these starting points to build a trip around your interests.`);
        const grid=node('div',null,'guide-places');attractions.forEach((place,i)=>{const card=node('article');card.append(node('span',String(i+1).padStart(2,'0')),node('h3',place));const link=node('a','Explore on map ↗');link.href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place}, ${city.name}`)}`;link.target='_blank';link.rel='noopener noreferrer';card.append(link);grid.append(card);});content.append(grid);
        if(!attractions.length)section('Make it personal','Detailed attraction notes are not yet available for this destination. Open the planner to request recommendations for your dates and interests.');
      }else if(index===1){section('An unhurried starting point','An inspiration route, not a confirmed schedule. Adjust for opening days, distance and your arrival time.');
        const days=[['Arrive & find your rhythm',['Check in and explore near your stay']],['Discover the highlights',attractions.slice(0,2)],['Go a little deeper',attractions.slice(2,4)]];
        days.forEach(([title,spots],i)=>{const day=node('article',null,'guide-route');day.append(node('span',`DAY ${i+1}`),node('h3',title),node('p',spots.length?spots.join(' → '):'Leave space for local discoveries and rest.'));content.append(day);});
      }else if(index===2){section('A budget that fits your life','Choose Lowest cost, Best value, Comfort or Luxury in the planner. Your dates, group size and lifestyle shape the estimate in the destination’s currency.');section('Where to stay','Compare accommodation near your main activities and transport connections. Check the full price, cancellation terms and accessibility before reserving.');section('Keep the full picture','Allow separately for flights, entry documents, insurance and personal purchases. No live price or availability is implied by this guide.');
      }else{section('Local etiquette',(city.culturalNotes||[]).join(' ')||'Check local customs, dress guidance and photography rules before visiting.');section('Entry & safety','Check current official travel advice and passport-specific entry requirements before booking. Your departure city does not determine visa eligibility.');section('Pack with purpose','Bring travel documents, medication, comfortable footwear and charging essentials. Add weather-specific items once your dates are set.');}
    }
    labels.forEach((label,index)=>{const button=node('button',label);button.type='button';button.id=`guide-tab-${index}`;button.setAttribute('role','tab');button.setAttribute('aria-controls','guide-panel');button.addEventListener('click',()=>render(index));button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?3:(index+(event.key==='ArrowRight'?1:-1)+4)%4;render(next);tabs.children[next].focus();});tabs.append(button);});body.append(tabs,content);
    const footer=node('footer',null,'guide-footer');const copy=node('div');copy.append(node('strong',`Make ${city.name} your next chapter.`),node('small','Choose your dates, people and budget next.'));const plan=node('a','Plan this trip ↗','guide-cta');plan.href=`/trip-planner?destination=${encodeURIComponent(city.name)}`;footer.append(copy,plan);dialog.replaceChildren(hero,body,footer);render(0);close.focus();
  }
  dialog.addEventListener('close',()=>{request++;document.body.style.overflow=previousOverflow||'';if(opener?.isConnected)opener.focus();else document.getElementById('slider-explore')?.focus();});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  window.PackSwiftDestinationGuide={open};
})();
