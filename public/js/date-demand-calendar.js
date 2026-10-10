/* Compact ISO-backed range picker and existing planner control bindings. */
(() => {
 const $=id=>document.getElementById(id),form=$('trip-planner-form');if(!form)return;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const start=$('start-date'),end=$('end-date'),dateBox=start.closest('.studio-pair');
 dateBox.hidden=true;start.type='hidden';end.type='hidden';
 const calendar=node('section');calendar.className='compact-trip-calendar';dateBox.after(calendar);
 let month=new Date();month=new Date(Date.UTC(month.getFullYear(),month.getMonth(),1));let choosingEnd=false;
 const iso=date=>date.toISOString().slice(0,10);
 const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 const notify=()=>form.dispatchEvent(new Event('input',{bubbles:true}));
 function draw(){calendar.replaceChildren();const header=node('div');header.className='calendar-month';
 for(const [label,delta]of [['←',-1],['→',1]]){const b=node('button',label);b.type='button';b.setAttribute('aria-label',delta<0?'Previous month':'Next month');b.onclick=()=>{month=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+delta,1));draw();window.PackSwiftPlannerMotion?.animate(calendar.querySelector('.calendar-grid'),[{opacity:.4,transform:'translateX('+delta*8+'px)'},{opacity:1,transform:'none'}],240);calendar.querySelector('[aria-label="'+(delta<0?'Previous month':'Next month')+'"]').focus({preventScroll:true});};header.append(b);}
 header.insertBefore(node('strong',month.toLocaleDateString('en',{month:'long',year:'numeric',timeZone:'UTC'})),header.lastChild);calendar.append(header,node('p',choosingEnd?'Choose an end date after the start date.':'Choose a start date, then an end date.'));
 const grid=node('div');grid.className='calendar-grid';['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d=>grid.append(node('small',d)));
 for(let j=0;j<(month.getUTCDay()+6)%7;j++)grid.append(node('span'));
 const count=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,0)).getUTCDate();
 for(let day=1;day<=count;day++){const date=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),day)),value=iso(date),weekend=[0,6].includes(date.getUTCDay()),band=weekend?'peak':[1,5].includes(date.getUTCDay())?'moderate':'low';const b=node('button');b.append(node('span',String(day)));b.type='button';b.className='calendar-day '+band;b.dataset.date=value;b.disabled=value<today();const selected=value===start.value||value===end.value;b.setAttribute('aria-label',date.toLocaleDateString('en',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'})+', '+(value===start.value?'selected start date':value===end.value?'selected end date':b.disabled?'unavailable':'available')+', '+band+' illustrative demand');b.setAttribute('aria-pressed',String(selected));if(value===today()){b.classList.add('today');b.setAttribute('aria-current','date');}if(selected)b.classList.add('endpoint');else if(value>start.value&&value<end.value)b.classList.add('in-range');if(value===start.value)b.classList.add('range-start');if(value===end.value)b.classList.add('range-end');if(start.value&&end.value)b.classList.add('has-range');
 b.onpointerenter=b.onfocus=()=>{if(choosingEnd)grid.querySelectorAll('[data-date]').forEach(c=>c.classList.toggle('range-hover',c.dataset.date>=start.value&&c.dataset.date<=value));};
 b.onclick=()=>{if(!choosingEnd||!start.value||value<=start.value){start.value=value;end.value='';choosingEnd=true;}else{end.value=value;choosingEnd=false;}notify();draw();calendar.querySelector('[data-date="'+value+'"]').focus({preventScroll:true});};grid.append(b);}
 while(grid.children.length<49)grid.append(node('span'));
 grid.onpointerleave=()=>grid.querySelectorAll('.range-hover').forEach(c=>c.classList.remove('range-hover'));
 const legend=node('div');legend.className='calendar-legend';for(const [type,label]of[['low','Low'],['moderate','Moderate'],['peak','Peak']]){const item=node('span',label);item.className=type;legend.append(item);}const disclaimer=node('small','Weekday illustration only — not live prices, holidays or measured crowds.');disclaimer.className='calendar-disclaimer';calendar.append(grid,legend,disclaimer);
 const short=value=>new Date(value+'T00:00:00Z').toLocaleDateString('en',{month:'short',day:'numeric',timeZone:'UTC'});
 const summary=node('div');summary.className='calendar-selection';summary.setAttribute('role','status');summary.append(node('strong',start.value?short(start.value)+' → '+(end.value?short(end.value):'Select return date'):'Select your travel dates'),node('small',end.value?Math.round((Date.parse(end.value)-Date.parse(start.value))/86400000)+' nights':'Choose a start date, then an end date.'));calendar.append(summary);const clear=node('button','Clear Dates');clear.className='calendar-clear';clear.type='button';clear.disabled=!start.value&&!end.value;clear.onclick=()=>{start.value='';end.value='';choosingEnd=false;notify();draw();};calendar.append(clear);}
 for(const id of ['adults','children']){const input=$(id),wrapper=node('div');wrapper.className='traveller-stepper';input.before(wrapper);const minus=node('button','−'),plus=node('button','+');for(const [b,delta]of [[minus,-1],[plus,1]]){b.type='button';b.setAttribute('aria-label',(delta<0?'Decrease ':'Increase ')+id);b.onclick=()=>{input.value=Math.max(Number(input.min),Math.min(Number(input.max),Number(input.value||input.min)+delta));sync();notify();};}
 wrapper.append(minus,input,plus);function sync(){minus.disabled=Number(input.value)<=Number(input.min);plus.disabled=Number(input.value)>=Number(input.max);}input.addEventListener('input',sync);sync();}
 $('adults').max=12;$('children').max=8;
 const currency=$('currency');for(const code of Object.keys(PackSwiftCurrency.currencies)){if(![...currency.options].some(o=>o.value===code)){const o=node('option',code);o.value=code;currency.append(o);}}
 const note=node('p');note.className='studio-note';currency.closest('.studio-money').after(note);let previous=currency.value;
 function currencyChange(code){if(code===previous)return;if($('budget').value){$('budget').value='';note.textContent='Currency changed from '+previous+' to '+code+'. Re-enter your budget; no conversion has been applied.';}currency.value=code;previous=code;notify();}
 $('destination-search').addEventListener('change',()=>currencyChange(PackSwiftCurrency.resolve($('destination-search').value).code));
 currency.addEventListener('change',()=>currencyChange(currency.value));
 function mode(){const local=form.elements.tripType.value==='local';$('origin-search').hidden=false;$('origin-label').hidden=false;$('origin-search').required=true;$('origin-label').textContent=local?'Local City':'Origin City';$('destination-search').hidden=local;$('destination-search').required=!local;form.querySelector('label[for="destination-search"]').hidden=local;$('trip-scope').value=local?'local':'anywhere';}
 form.addEventListener('change',e=>{if(e.target.name==='tripType'){mode();notify();}});
 function restored(){mode();previous=currency.value;const params=new URLSearchParams(location.search);if(!params.has('trip_id')&&!params.has('resume_draft')&&!$('budget').value&&$('destination-search').value)currencyChange(PackSwiftCurrency.resolve($('destination-search').value).code);if(start.value)month=new Date(start.value.slice(0,7)+'-01T00:00:00Z');draw();}
 window.addEventListener('packswift:planner-loaded',restored);window.addEventListener('packswift:draft-restored',restored);restored();
})();
