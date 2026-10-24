(() => {
 const categories=['Documents & Money','Daily Essentials','Clothing','Footwear','Toiletries','Beauty & Personal Care','Health & Medication','Electronics','Weather Protection','Activity Gear','Travel Comfort','Children & Family','My Items'];
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 let host,field,context,removed;
 function read(){try{return JSON.parse(field.value)||{};}catch{return {};}}
 function save(s){field.value=JSON.stringify(s);field.dispatchEvent(new Event('input',{bubbles:true}));}
 function suggestions(i,selected){
  let personal={};try{personal=JSON.parse(i.planningSupport||'{}').preferences||{};}catch{}
  const days=Math.max(1,Math.round((Date.parse(i.endDate)-Date.parse(i.startDate))/86400000)+1||1),qty=Math.min(days,personal.laundry==='Every few days'?3:personal.laundry==='No laundry planned'?days:7),items=[];
  const add=(category,name,quantity=1,reason='Essential')=>items.push({id:category+':'+name,category,name,quantity,reason});
  add('Documents & Money',i.isInternational===false?'Personal identification':'Passport');add('Documents & Money','Tickets and booking details');add('Documents & Money','Payment cards / cash');
  add('Daily Essentials','Reusable water bottle');add('Daily Essentials','Day bag');
  add('Clothing','Lightweight tops',qty,days+' travel days · adjust for laundry');add('Clothing','Comfortable bottoms',Math.max(1,Math.ceil(qty/3)));add('Clothing','Underwear',qty);add('Clothing','Sleepwear');add('Clothing','Light layer');
  add('Footwear','Comfortable walking shoes');add('Toiletries','Toothbrush');add('Toiletries','Toothpaste');add('Toiletries','Deodorant');add('Toiletries','Shampoo / body wash');
  add('Beauty & Personal Care','Sunscreen');add('Beauty & Personal Care','Personal skincare');
  add('Health & Medication','Personal medication',1,'If needed');add('Health & Medication','Basic first-aid supplies');
  add('Electronics','Phone charger');if(i.isInternational!==false)add('Electronics','Travel adapter',1,'Check destination socket type');
  add('Weather Protection','Compact umbrella',1,'Optional precaution · forecast not verified');
  const interests=String(i.travelPurposes||i.travelPurposeCategory||'');
  const places=selected.map(p=>p.title||p.name||'').join(' ');
  if(/Water|Marine|beach|swim/i.test(interests+' '+places))add('Activity Gear','Swimwear',1,'Water activities');
  if(/Nature|Outdoor|hiking|trail/i.test(interests+' '+places))add('Activity Gear','Outdoor footwear',1,'Outdoor activities');
  if(/temple|pagoda|mosque/i.test(places))add('Clothing','Shoulder and knee covering',1,'Religious visits · confirm venue dress rules');
  if(Number(i.children)>0)add('Children & Family','Child travel essentials',Number(i.children));
  add('Travel Comfort','Eye mask / earplugs',1,'Optional');
  for(const name of personal.packingItems||[])if(!items.some(x=>x.name===name))add('My Items',name,1,'Your saved essential');
  const excluded=String(personal.packingExclusions||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  return items.filter(x=>!excluded.includes(x.name.toLowerCase()));
 }
 function draw(){
  if(!context)return;const {input,selected}=context,s=read();s.edits||={};s.dismissed||=[];s.custom||=[];
  const items=[...suggestions(input,selected),...s.custom].filter(x=>!s.dismissed.includes(x.id)).map(x=>({...x,...s.edits[x.id]}));
  const open=new Set([...host.querySelectorAll('details[open]')].map(x=>x.dataset.category));const first=!host.children.length;
  host.replaceChildren();const status=el('p',items.filter(x=>x.packed).length+' / '+items.length+' packed');status.setAttribute('role','status');host.append(status);
  host.append(el('small','Based on trip length and activities. Daily weather forecast is not connected yet.'));
  if(removed){const undo=el('button','Undo removal');undo.type='button';undo.onclick=()=>{const state=read();state.dismissed=(state.dismissed||[]).filter(id=>id!==removed);removed=null;save(state);draw();};host.append(undo);}
  for(const category of categories){
   if(category==='Children & Family'&&!Number(input.children)&&!items.some(x=>x.category===category))continue;
   const section=el('details');section.dataset.category=category;section.open=open.has(category)||(first&&['Documents & Money','Clothing'].includes(category));
   const entries=items.filter(x=>x.category===category),summary=el('summary'),icon=el('span');icon.className='packing-category-icon';icon.setAttribute('aria-hidden','true');
   const symbols={'Documents & Money':'wallet','Daily Essentials':'bag','Clothing':'bag','Footwear':'map','Toiletries':'bag','Beauty & Personal Care':'pet','Health & Medication':'people','Electronics':'sliders','Weather Protection':'globe','Activity Gear':'map','Travel Comfort':'plane','Children & Family':'people','My Items':'bag'};
   icon.append(window.PackSwiftWorkspace.icon(symbols[category]||'bag'));summary.append(icon,el('span',category),el('small',entries.filter(x=>x.packed).length+'/'+entries.length));section.append(summary);
   for(const item of entries){
    const row=el('div');row.className='packing-item';const check=el('input');check.type='checkbox';check.checked=!!item.packed;check.setAttribute('aria-label','Packed '+item.name);
    const name=el('input');name.type='text';name.value=item.name;name.maxLength=100;name.setAttribute('aria-label','Item name: '+item.name);
    const quantity=el('input');quantity.type='number';quantity.min=1;quantity.max=99;quantity.value=item.quantity;quantity.setAttribute('aria-label','Quantity for '+item.name);
    const update=()=>{const state=read();state.edits||={};state.edits[item.id]={name:name.value.trim()||item.name,quantity:Math.min(99,Math.max(1,Number(quantity.value)||1)),packed:check.checked};save(state);draw();};
    check.onchange=name.onchange=quantity.onchange=update;
    const remove=el('button','×');remove.type='button';remove.setAttribute('aria-label','Remove '+item.name);remove.onclick=()=>{const state=read();state.dismissed=[...new Set([...(state.dismissed||[]),item.id])];removed=item.id;save(state);draw();};
    row.append(check,name,quantity,remove);section.append(row);
   }
   const addRow=el('div');addRow.className='packing-add';const custom=el('input');custom.placeholder='Add an item';custom.maxLength=100;custom.setAttribute('aria-label','New item in '+category);const add=el('button','Add');add.type='button';const insert=()=>{if(!custom.value.trim())return;const state=read();state.custom||=[];state.custom.push({id:'custom:'+crypto.randomUUID(),category,name:custom.value.trim(),quantity:1});save(state);draw();};add.onclick=insert;custom.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();insert();}};addRow.append(custom,add);section.append(addRow);host.append(section);
  }
 }
 window.PackSwiftPackingPreview={mount(parent,input,selected){
  if(!field){field=document.getElementById('packing-checklist-state');if(!field){field=el('input');field.type='hidden';field.id='packing-checklist-state';field.name='packingChecklist';document.getElementById('trip-planner-form').append(field);}host=el('section');host.className='packing-checklist';window.addEventListener('packswift:draft-restored',draw);window.addEventListener('packswift:planner-loaded',draw);}
  context={input,selected};parent.replaceChildren(host);draw();
 }};
})();
