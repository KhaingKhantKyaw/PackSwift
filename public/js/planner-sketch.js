/* Layout adapter: moves existing controls, retaining their listeners and draft keys. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),form=$('trip-planner-form');
 if(!document.body.classList.contains('planner-sketch'))return;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const fields=el('div',null,'sketch-fields');
 const title=el('h1','Form');form.prepend(title,fields);
 function group(label){const n=el('section',null,'sketch-field');n.dataset.field=label;n.append(el('h2',label));fields.append(n);return n;}
 function control(id,label){const n=el('div',null,'sketch-control'),l=el('label',label);l.htmlFor=id;const input=$(id);n.append(l,input.closest('.traveller-stepper')||input);return n;}
 const type=group('Trip Type');type.append(form.querySelector('.trip-type-control'));type.querySelector('legend')?.remove();
 const location=group('Location'),locations=el('div',null,'sketch-pair');locations.append(control('origin-search','Origin City'),control('destination-search','Destination City'));locations.querySelector('label').id='origin-label';location.append(locations);
 const dates=group('Dates'),pair=el('div',null,'sketch-pair');
 for(const [id,label]of [['start-date','Start Date'],['end-date','End Date']]){
  const original=$(id),wrapper=el('div',null,'sketch-control'),caption=el('label',label),display=el('input');display.id=id+'-display';display.type='text';display.placeholder='DD/MM/YY';display.inputMode='numeric';display.maxLength=8;caption.htmlFor=display.id;
  const picker=el('input');picker.type='date';picker.className='sketch-date-picker';picker.setAttribute('aria-label',label+' calendar');
  const row=el('div',null,'sketch-date');row.append(display,picker);wrapper.append(caption,row,original);pair.append(wrapper);
  const format=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)?value.slice(8)+'/'+value.slice(5,7)+'/'+value.slice(2,4):'';
  function sync(){display.value=format(original.value);picker.value=original.value;}
  function notify(){original.dispatchEvent(new Event('input',{bubbles:true}));original.dispatchEvent(new Event('change',{bubbles:true}));}
  display.addEventListener('change',()=>{const match=display.value.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);const iso=match?`20${match[3]}-${match[2]}-${match[1]}`:'';const valid=iso&&!Number.isNaN(Date.parse(iso))&&new Date(iso).toISOString().slice(0,10)===iso;display.setCustomValidity(display.value&&!valid?'Use DD/MM/YY with a valid date.':'');original.value=valid?iso:'';picker.value=original.value;notify();});
  picker.addEventListener('change',()=>{original.value=picker.value;display.setCustomValidity('');sync();notify();});
  window.addEventListener('packswift:planner-loaded',sync);window.addEventListener('packswift:draft-restored',sync);sync();
 }dates.append(pair);
 const travelers=group('Travelers'),counts=el('div',null,'sketch-pair');counts.append(control('adults','Adults'),control('children','Children'));travelers.append(counts);
 const pets=group('Pets'),petOptions=el('div',null,'sketch-pet-options');
 for(const [value,text]of [['dog','Dog'],['cat','Cat'],['other','Others']]){const button=el('button',text);button.type='button';button.dataset.pet=value;button.onclick=()=>{$('studio-pets').checked=!($('studio-pets').checked&&$('pet-type').value===value);$('pet-type').value=value;syncPets();$('studio-pets').dispatchEvent(new Event('change',{bubbles:true}));};petOptions.append(button);}pets.append(petOptions);
 function syncPets(){petOptions.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String($('studio-pets').checked&&$('pet-type').value===b.dataset.pet)));}
 window.addEventListener('packswift:planner-loaded',syncPets);window.addEventListener('packswift:draft-restored',syncPets);syncPets();
 const nationality=group('Nationality'),old=$('passport-country'),select=el('select');select.id='passport-nationality';select.required=old.required;select.setAttribute('aria-label','Nationality');select.append(new Option('Select nationality',''));
 const names=new Intl.DisplayNames(['en'],{type:'region'}),countries=[];for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=names.of(code);if(name!==code&&!['XA','XB','ZZ','EU','UN','EZ'].includes(code))countries.push(name);} [...new Set(countries)].sort().forEach(name=>select.append(new Option(name,name)));nationality.append(select);
 function syncNationality(){if(old.value&&![...select.options].some(o=>o.value===old.value))select.append(new Option(old.value,old.value));select.value=old.value;}
 select.onchange=()=>{old.value=select.value;old.dispatchEvent(new Event('input',{bubbles:true}));};window.addEventListener('packswift:planner-loaded',syncNationality);window.addEventListener('packswift:draft-restored',syncNationality);syncNationality();
 const entry=group('Entry Mode'),entrySelect=$('entry-mode');entrySelect.replaceChildren(new Option('Air','air'),new Option('Car','land'),new Option('Train','train'));entrySelect.setAttribute('aria-label','Entry Mode');entry.append(entrySelect);
 const budget=group('Expected Budget');budget.append(form.querySelector('.studio-money'));$('budget').setAttribute('aria-label','Expected budget amount');$('budget').placeholder='Amount';
 group('Travel Purpose').append($('travel-purpose'));$('travel-purpose').setAttribute('aria-label','Travel Purpose');
 const places=group('Must-have Places'),search=form.querySelector('.place-search');search.querySelector('label').textContent='Must-have Places';search.querySelector('label').className='sketch-sr-only';$('global-place-search').placeholder='Search places';places.append(search);
 const searchStatus=search.querySelector('[role="status"]');function compactStatus(){searchStatus.hidden=searchStatus.textContent==='Type at least 2 characters.';search.querySelector('.place-search-attribution').hidden=!$('global-place-search').value.trim()&&!search.querySelector('.searched-place-row');}new MutationObserver(compactStatus).observe(search,{childList:true,subtree:true,characterData:true});compactStatus();
 const prefs=group('Itinerary Preferences'),mode=el('select');mode.id='sketch-itinerary-mode';mode.setAttribute('aria-label','Itinerary Preferences');[['auto','Plan It For Me'],['collaborative','Plan Together'],['manual','I’ll Plan It']].forEach(([v,t])=>mode.append(new Option(t,v)));prefs.append(mode);
 function syncMode(){try{mode.value=JSON.parse($('itinerary-preferences-state').value).planningMode||'auto';}catch{mode.value='auto';}}
 mode.onchange=()=>{const radio=form.querySelector(`[name="itinerary-mode-choice"][value="${mode.value}"]`);radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));};
 window.addEventListener('packswift:planner-loaded',syncMode);window.addEventListener('packswift:draft-restored',syncMode);syncMode();
 // Non-displayed legacy fields stay in the same form so saved trips round-trip intact.
 const storage=el('div');storage.hidden=true;[...form.childNodes].filter(n=>n.nodeType===1&&![title,fields,$('planner-feedback')].includes(n)).forEach(n=>storage.append(n));form.append(storage,$('planner-feedback'));
 const dashboard=document.querySelector('.studio-dashboard'),heading=el('h2','Live Preview');dashboard.prepend(heading);$('studio-save').textContent='Save Trip';
})();
