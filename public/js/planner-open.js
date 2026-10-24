(() => {
 function start(){
  const form=document.getElementById('trip-planner-form');if(!form||document.querySelector('.planner-open-hero'))return;
  const hero=document.createElement('section');hero.className='planner-open-hero';
  const copy=document.createElement('div'),title=document.createElement('h1'),summary=document.createElement('p');copy.append(title,summary);hero.append(copy);form.before(hero);
  const nav=document.createElement('nav');nav.className='planner-open-nav';nav.setAttribute('aria-label','Planning sections');form.after(nav);
  const names=['Overview','Flight & Stay','Transportation','Itinerary','Packing List'];
  names.forEach((name,i)=>{const a=document.createElement('a');a.href='#planning-section-'+i;a.textContent=name;a.onclick=e=>{const section=[...document.querySelectorAll('[data-preview-section]')].find(s=>s.dataset.previewSection===name);if(!section||section.hidden){e.preventDefault();return;}section.open=true;};nav.append(a);});
  function update(){const destination=form.elements.destination?.value||'';title.textContent=destination?'Your '+destination.split(',')[0]+' trip':'Your next trip';summary.textContent=[form.elements.origin?.value,destination,form.elements.startDate?.value&&form.elements.endDate?.value?form.elements.startDate.value+' – '+form.elements.endDate.value:''].filter(Boolean).join(' · ')||'Your plans, all in one place.';names.forEach((name,i)=>{const section=[...document.querySelectorAll('[data-preview-section]')].find(s=>s.dataset.previewSection===name);if(section){section.id='planning-section-'+i;section.style.scrollMarginTop='110px';}nav.children[i].hidden=!section||section.hidden;});}
  form.addEventListener('input',()=>requestAnimationFrame(update));form.addEventListener('change',()=>requestAnimationFrame(update));window.addEventListener('packswift:planner-loaded',update);window.addEventListener('packswift:draft-restored',update);
  const dashboard=document.getElementById('studio-dashboard-content');if(dashboard)new MutationObserver(update).observe(dashboard,{childList:true});update();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
