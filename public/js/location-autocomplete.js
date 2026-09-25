(() => {
  let catalog=[];
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  window.addEventListener('packswift:location-catalog',event=>{catalog=event.detail;});
  for(const id of ['origin-search','destination-search']){
    const input=document.getElementById(id);if(!input)continue;
    input.removeAttribute('list');input.autocomplete='off';input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');
    const list=document.createElement('div');list.id=`${id}-suggestions`;list.className='location-suggestions';list.hidden=true;list.setAttribute('role','listbox');list.setAttribute('aria-label','Matching locations');input.after(list);input.setAttribute('aria-controls',list.id);
    let active=-1;
    const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
    function render(){
      close();list.replaceChildren();const query=normalize(input.value);if(!query||input.disabled||input.readOnly)return;
      const entries=new Map();
      catalog.forEach(city=>{
        const name=normalize(city.name),country=normalize(city.country);
        if(country.startsWith(query))entries.set(`country:${country}`,{value:city.country,label:city.country,kind:'Country'});
        if(name.startsWith(query)||country.startsWith(query))entries.set(`city:${name}:${country}`,{value:city.name,label:name===country?city.name:`${city.name}, ${city.country}`,kind:'City'});
      });
      const seen=new Set();const matches=[...entries.values()].sort((a,b)=>Number(b.kind==='Country')-Number(a.kind==='Country')||a.label.localeCompare(b.label)).filter(item=>{const key=normalize(item.label);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,12);
      matches.forEach((item,index)=>{const button=document.createElement('button');button.type='button';button.tabIndex=-1;button.id=`${list.id}-${index}`;button.setAttribute('role','option');button.setAttribute('aria-selected','false');const label=document.createElement('span');label.textContent=item.label;const kind=document.createElement('small');kind.textContent=item.kind;button.append(label,kind);button.addEventListener('click',()=>{input.value=item.value;close();input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));close();input.focus();close();});list.append(button);});
      if(!matches.length){const text=document.createElement('p');text.textContent='No matching locations in the catalog. You can still enter a city.';list.append(text);}
      list.hidden=false;input.setAttribute('aria-expanded','true');
    }
    input.addEventListener('input',render);input.addEventListener('focus',render);
    input.addEventListener('keydown',event=>{
      if(event.key==='Escape'||event.key==='Tab'){close();return;}
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(list.hidden)render();const buttons=[...list.querySelectorAll('button')];if(!buttons.length)return;active=(active+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons.forEach((b,i)=>b.setAttribute('aria-selected',String(i===active)));input.setAttribute('aria-activedescendant',buttons[active].id);buttons[active].scrollIntoView({block:'nearest'});}
      if(event.key==='Enter'&&!list.hidden&&active>=0){event.preventDefault();list.querySelectorAll('button')[active]?.click();}
    });
    document.addEventListener('pointerdown',event=>{if(event.target!==input&&!list.contains(event.target))close();});
    list.addEventListener('focusout',event=>{if(!list.contains(event.relatedTarget)&&event.relatedTarget!==input)close();});
  }
})();
