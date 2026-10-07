/* Compact ISO-backed range picker and existing planner control bindings. */
(() => {
 const $=id=>document.getElementById(id),form=$('trip-planner-form');if(!form)return;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const start=$('start-date'),end=$('end-date'),dateBox=start.closest('.studio-pair');
 dateBox.hidden=true;start.type='hidden';end.type='hidden';
 const calendar=node('section');calendar.className='compact-trip-calendar';dateBox.after(calendar);
 let month=new Date();month=new Date(Date.UTC(month.getFullYear(),month.getMonth(),1));let choosingEnd=false;
 const iso=date=>date.toISOString().slice(0,10);
 const notify=()=>form.dispatchEvent(new Event('input',{bubbles:true}));
 function draw(){calendar.replaceChildren();const header=node('div');header.className='calendar-month';
 for(const [label,delta]of [['←',-1],['→',1]]){const b=node('button',label);b.type='button';b.setAttribute('aria-label',delta<0?'Previous month':'Next month');b.onclick=()=>{month=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+delta,1));draw();};header.append(b);}
 header.insertBefore(node('strong',month.toLocaleDateString('en',{month:'long',year:'numeric',timeZone:'UTC'})),header.lastChild);calendar.append(header,node('p',choosingEnd?'Choose an end date after the start date.':'Choose a start date, then an end date.'));
 const grid=node('div');grid.className='calendar-grid';['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d=>grid.append(node('small',d)));
 for(let j=0;j<(month.getUTCDay()+6)%7;j++)grid.append(node('span'));
 const count=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,0)).getUTCDate();
 for(let day=1;day<=count;day++){const date=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),day)),value=iso(date),weekend=[0,6].includes(date.getUTCDay());const b=node('button',String(day));b.type='button';b.className='calendar-day '+(weekend?'peak':[1,5].includes(date.getUTCDay())?'moderate':'low');b.dataset.date=value;b.setAttribute('aria-label',PackSwiftTripContext.displayDate(value));b.setAttribute('aria-pressed',String(value===start.value||value===end.value));if(value===start.value||value===end.value)b.classList.add('endpoint');else if(value>start.value&&value<end.value)b.classList.add('in-range');
 b.onpointerenter=b.onfocus=()=>{if(choosingEnd)grid.querySelectorAll('[data-date]').forEach(c=>c.classList.toggle('range-hover',c.dataset.date>=start.value&&c.dataset.date<=value));};
 b.onclick=()=>{if(!choosingEnd||!start.value||value<=start.value){start.value=value;end.value='';choosingEnd=true;}else{end.value=value;choosingEnd=false;}notify();draw();};grid.append(b);}
 grid.onpointerleave=()=>grid.querySelectorAll('.range-hover').forEach(c=>c.classList.remove('range-hover'));calendar.append(grid,node('small','● Low / Budget · ● Moderate · ● Peak / Weekend'),node('small','Weekday illustration only — not live prices, holidays or measured crowds.'));
 const summary=node('p',start.value?PackSwiftTripContext.displayDate(start.value)+(end.value?' → '+PackSwiftTripContext.displayDate(end.value)+' · '+Math.round((Date.parse(end.value)-Date.parse(start.value))/86400000)+' Nights':' · Choose end date'):'No dates selected');summary.setAttribute('role','status');calendar.append(summary);const clear=node('button','Clear Dates');clear.type='button';clear.onclick=()=>{start.value='';end.value='';choosingEnd=false;notify();draw();};calendar.append(clear);}
 for(const id of ['adults','children']){const input=$(id),wrapper=node('div');wrapper.className='traveller-stepper';input.before(wrapper);const minus=node('button','−'),plus=node('button','+');for(const [b,delta]of [[minus,-1],[plus,1]]){b.type='button';b.setAttribute('aria-label',(delta<0?'Decrease ':'Increase ')+id);b.onclick=()=>{input.value=Math.max(Number(input.min),Math.min(Number(input.max),Number(input.value||input.min)+delta));sync();notify();};}
 wrapper.append(minus,input,plus);function sync(){minus.disabled=Number(input.value)<=Number(input.min);plus.disabled=Number(input.value)>=Number(input.max);}input.addEventListener('input',sync);sync();}
 $('adults').max=12;$('children').max=8;
 const currency=$('currency');for(const code of Object.keys(PackSwiftCurrency.currencies)){if(![...currency.options].some(o=>o.value===code)){const o=node('option',code);o.value=code;currency.append(o);}}
 const note=node('p');note.className='studio-note';currency.closest('.studio-money').after(note);let previous=currency.value;
 function currencyChange(code){if(code===previous)return;if($('budget').value){$('budget').value='';note.textContent='Currency changed from '+previous+' to '+code+'. Re-enter your budget; no conversion has been applied.';}currency.value=code;previous=code;notify();}
 $('destination-search').addEventListener('change',()=>currencyChange(PackSwiftCurrency.resolve($('destination-search').value).code));
 currency.addEventListener('change',()=>currencyChange(currency.value));
 function mode(){const local=form.elements.tripType.value==='local';$('origin-search').hidden=local;$('origin-label').hidden=local;$('origin-search').required=!local;$('trip-scope').value=local?'domestic':'international';form.querySelector('label[for="destination-search"]').textContent=local?'City':'Destination City';}
 form.addEventListener('change',e=>{if(e.target.name==='tripType'){mode();notify();}});
 function restored(){mode();previous=currency.value;const params=new URLSearchParams(location.search);if(!params.has('trip_id')&&!params.has('resume_draft')&&!$('budget').value&&$('destination-search').value)currencyChange(PackSwiftCurrency.resolve($('destination-search').value).code);if(start.value)month=new Date(start.value.slice(0,7)+'-01T00:00:00Z');draw();}
 window.addEventListener('packswift:planner-loaded',restored);window.addEventListener('packswift:draft-restored',restored);restored();
})();
