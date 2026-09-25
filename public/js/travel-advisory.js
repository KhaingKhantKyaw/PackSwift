(() => {
  const panel=document.querySelector('.result-panel');if(!panel)return;
  const box=document.createElement('section');box.className='travel-advisory';box.hidden=true;box.setAttribute('aria-live','polite');panel.prepend(box);
  let timer,controller,current='';
  const text=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;return el;};
  function render(data){
    const icons={critical:'⛔',high:'⚠',caution:'△',information:'ⓘ',unknown:'?'};
    box.dataset.level=data.severity;box.replaceChildren(text('strong',`${icons[data.severity]||'?'} ${data.country?data.country+' · ':''}${data.title}`),text('p',data.message||'Check the official advisory for details.'));
    if(data.regionalNotice)box.append(text('p',data.regionalNotice));
    const link=text('a','Read official travel advice ↗');link.href=data.url;link.target='_blank';link.rel='noopener noreferrer';box.append(link);
    box.append(text('small',data.checkedAt?`Source: ${data.source} · Retrieved ${new Date(data.checkedAt).toLocaleString()}${data.sourceUpdatedAt?' · Source updated '+new Date(data.sourceUpdatedAt).toLocaleDateString():''}`:'Current advisory could not be retrieved.'));
    box.append(text('small',data.disclaimer||'Unknown does not mean safe. Check your own government’s travel advice.'));
  }
  function update(event){
    const destination=String(event.detail?.destination||'').trim();if(destination===current)return;current=destination;clearTimeout(timer);controller?.abort();
    box.hidden=!destination;if(!destination)return;box.dataset.level='unknown';box.replaceChildren(text('p','Checking official destination travel advice…'));
    timer=setTimeout(async()=>{const request=new AbortController();controller=request;try{const response=await fetch('/api/travel-advisory?destination='+encodeURIComponent(destination),{signal:request.signal});if(!response.ok)throw Error();const data=await response.json();if(!request.signal.aborted&&destination===current)render(data);}catch(error){if(error.name!=='AbortError')render({severity:'unknown',title:'Travel safety not verified',message:'The advisory service is unavailable. Review official advice before booking.',url:'https://www.gov.uk/foreign-travel-advice'});}},450);
  }
  window.addEventListener('packswift:preview-thinking',update);window.addEventListener('packswift:preview-incomplete',update);
})();
