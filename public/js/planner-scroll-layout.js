(()=>{
 const root=document.getElementById('studio-dashboard-content');if(!root)return;
 const groups={itinerary:['Itinerary'],activities:['Activities'],bookings:['Flight & Stay'],packing:['Packing List']};
 let active=location.hash==='#preview-flight-stay'?'bookings':location.hash==='#workspace-packing'?'packing':'itinerary';
 const nav=document.createElement('nav');nav.className='planner-section-nav';nav.setAttribute('aria-label','Trip planning sections');
 const hint=document.createElement('p');hint.className='planner-section-hint';hint.setAttribute('role','status');
 root.before(nav,hint);
 for(const [id,label]of [['itinerary','Itinerary'],['activities','Activities'],['bookings','Flights & stays'],['packing','Packing & tips']]){
  const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.section=id;b.onclick=()=>show(id,true);nav.append(b);
 }
 function sync(){
  const panels=[...root.querySelectorAll('.reference-preview-card[data-preview-section]')];
  nav.hidden=!panels.some(p=>!p.hidden);let visible=0;
  for(const panel of panels){const selected=groups[active].includes(panel.dataset.previewSection);panel.dataset.flowHidden=String(!selected);if(selected&&!panel.hidden)visible++;}
  for(const b of nav.children)b.setAttribute('aria-pressed',String(b.dataset.section===active));
  hint.hidden=nav.hidden||visible>0;
  hint.textContent=active==='bookings'?'Add your origin, destination and travel dates to search flights and stays.':active==='packing'?'Add your destination and travel dates to prepare a packing list.':active==='activities'?'Add a destination to explore activities.':'Add a destination to begin your itinerary.';
 }
 function show(id,open=false){if(!groups[id])return;active=id;sync();if(open)for(const panel of root.querySelectorAll('[data-preview-section]'))if(groups[id].includes(panel.dataset.previewSection)&&!panel.hidden)panel.open=true;}
 window.PackSwiftPlannerSections={show:title=>{const id=Object.keys(groups).find(key=>key===title||groups[key].includes(title));if(id)show(id,true);}};
 // Existing renderers retain ownership of content and trip data.
 new MutationObserver(sync).observe(root,{childList:true,subtree:true});sync();
})();
