(() => {
 const form=document.getElementById('trip-planner-form'),grid=form.querySelector('.form-grid');
 const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 document.body.classList.add('trip-workspace');window.PackSwiftWorkspace=true;
 const header=el('header');header.className='setup-header';header.append(el('small','YOUR PERSONAL TRAVEL ASSISTANT'),el('h2','Trip Setup'),el('p','A few choices. One connected journey.'));
 const tabs=el('nav');tabs.className='setup-tabs';tabs.setAttribute('aria-label','Trip setup steps');
 const labels=['Where & when','Your travellers','Budget','Travel style'];
 const steps=labels.map((label,i)=>{const s=el('section');s.className='setup-step';s.dataset.step=i;s.append(el('h3',label));grid.append(s);return s;});
 const move=(node,index)=>{if(node)steps[index].append(node);};
 move(form.querySelector('.scope-selector'),0);move(document.getElementById('origin-search').closest('.form-field'),0);move(document.getElementById('destination-field'),0);move(form.querySelector('.demand-calendar'),0);
 move(form.querySelector('.traveller-fields'),1);const passport=document.getElementById('passport-country');move(passport.parentElement,1);passport.required=true;passport.previousElementSibling.querySelector('.label-optional')?.remove();
 move(form.querySelector('[name="travelingWithPets"]').closest('fieldset'),1);
 move(form.querySelector('.planning-goal-fieldset'),2);move(document.getElementById('budget').closest('.form-field-wide'),2);
 form.querySelectorAll('[data-deferred-planner-section]').forEach(node=>{node.hidden=false;node.removeAttribute('data-deferred-planner-section');if(node.tagName==='DETAILS')node.open=true;move(node,3);});
 // Retire the old introductory cards and empty wrappers, retaining input bindings.
 [...grid.children].forEach(node=>{if(!node.classList.contains('setup-step'))node.hidden=true;});
 form.prepend(header,tabs);
 const controls=el('div');controls.className='setup-controls';const back=el('button','← Back'),next=el('button','Continue →'),error=el('p');back.type=next.type='button';error.setAttribute('role','alert');error.className='setup-error';controls.append(back,next);form.append(error,controls);
 let active=0;
 function show(index){active=index;steps.forEach((s,i)=>s.hidden=i!==index);[...tabs.children].forEach((b,i)=>{b.setAttribute('aria-current',i===index?'step':'false');});back.hidden=index===0;next.textContent=index===3?'Choose activities →':'Continue →';error.textContent='';form.scrollTop=0;}
 labels.forEach((label,i)=>{const b=el('button',`${i+1}. ${label}`);b.type='button';b.onclick=()=>{if(i<active||valid())show(i);};tabs.append(b);});
 function valid(){
  if(active===0){const a=document.getElementById('start-date').value,b=document.getElementById('end-date').value;if(!document.getElementById('origin-search').value.trim()||!document.getElementById('destination-search').value.trim()||!a||!b||b<=a){error.textContent='Choose your route and a return date after departure.';return false;}}
  if(active===1&&!passport.value.trim()){error.textContent='Add your passport nationality for entry-check reminders.';passport.focus();return false;}
  if(active===2&&!(Number(document.getElementById('budget').value.replace(/,/g,''))>0)){error.textContent='Enter a total budget greater than zero.';return false;}
  return true;
 }
 back.onclick=()=>show(Math.max(0,active-1));next.onclick=()=>{if(!valid())return;if(active<3)show(active+1);else{const action=document.getElementById('preview-board-open');if(action.disabled){error.textContent='Wait for your trip preview to finish updating.';return;}action.click();}};
 window.addEventListener('packswift:draft-restored',()=>show(3));show(0);
 const readiness=el('fieldset');readiness.className='workspace-readiness';readiness.append(el('legend','Before you go'));
 const progress=el('progress');progress.max=10;progress.value=0;progress.setAttribute('aria-label','Preparation tasks completed');const count=el('p','0 of 10 completed');readiness.append(progress,count);
 ['Passport checked','Entry rules checked','Flight arranged','Stay arranged','Insurance reviewed','Airport transfer planned','SIM / eSIM ready','Packing complete','Money / cards ready','Emergency contacts saved'].forEach((text,i)=>{const label=el('label'),check=el('input');check.type='checkbox';check.name=`readiness_${i}`;check.value='true';label.append(check,el('span',text));readiness.append(label);});
 steps[3].append(readiness);
 const update=()=>{const total=readiness.querySelectorAll('input:checked').length;progress.value=total;count.textContent=`${total} of 10 completed · self-checked, not travel clearance`;};readiness.addEventListener('change',update);window.addEventListener('packswift:draft-restored',update);
})();
