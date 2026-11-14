(()=>{
  const api=PackSwiftEmergencyDirectory,container=document.querySelector('#public-emergency-directory'),button=document.querySelector('#download-emergency-contacts'),status=document.querySelector('#directory-download-status');
  let current=null;
  api.mount(container,{country:new URLSearchParams(location.search).get('country')||'',onResult:r=>{current=r;button.disabled=!r?.contacts.length;status.textContent=r?.contacts.length?'Includes local dialing notes, sources and review date.':'';}});
  button.onclick=()=>{
    if(!current?.contacts.length)return;
    const text=[current.name,'Review status: '+current.status,'Source reviewed: '+current.verifiedAt,current.scope||'',...current.contacts.map(c=>c.service+': '+c.number+'\n'+c.dialing),'Official source: '+current.source,'Short codes are for local use. Verify before travel; this is not a live service-status check.'].join('\n');
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='packswift-'+current.code+'-emergency-contacts.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
})();
