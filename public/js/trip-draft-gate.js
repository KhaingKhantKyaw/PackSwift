(() => {
  let busy=false;
  function captureFields(form){
    return [...form.elements].filter(el=>el.name&&!el.dataset?.preferenceTransient&&['INPUT','SELECT','TEXTAREA'].includes(el.tagName)).map(el=>({id:el.id||null,name:el.name,value:el.value,checked:el.checked,type:el.type,disabled:el.disabled}));
  }
  function restoreFields(form,fields){
    const controls=[...form.elements];const used=new Map();
    for(const record of fields||[]){
      const saved={...record};
      if(saved.name==='tripType'&&saved.value==='worldwide')saved.value='anywhere';
      const matches=controls.filter(el=>el.name===saved.name&&(!saved.type||el.type===saved.type));
      // Old drafts have no IDs. Match by input type and occurrence, never by name alone.
      const key=`${saved.name}:${saved.type}`;const index=used.get(key)||0;
      const target=saved.id?controls.find(el=>el.id===saved.id&&el.name===saved.name):
        ['radio','checkbox'].includes(saved.type)?matches.find(el=>el.value===saved.value):matches[index];
      used.set(key,index+1);if(!target)continue;
      if(target.type==='radio'||target.type==='checkbox')target.checked=Boolean(saved.checked);else target.value=saved.value;
      if(typeof saved.disabled==='boolean')target.disabled=saved.disabled;
    }
    const destination=controls.find(el=>el.id==='destination-search');
    const origin=controls.find(el=>el.id==='origin-search');
    if(form.elements.tripType?.value==='local'&&origin&&!origin.value&&destination)origin.value=destination.value;
    if(destination)destination.dataset.internationalValue=destination.value;
  }
  async function gate(action,preview={}){
    if(await window.PackSwift.authReady)return true;
    if(busy)return false;busy=true;
    const form=document.getElementById('trip-planner-form');
    const dialog=document.createElement('dialog');dialog.className='trip-auth-dialog';dialog.setAttribute('aria-label','Save your trip and continue');
    const emblem=document.createElement('div');emblem.className='draft-emblem';emblem.textContent='✦';emblem.setAttribute('aria-hidden','true');
    const title=document.createElement('h2');title.textContent='Your next chapter starts here.';
    const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Saving your choices for 20 minutes…';
    const close=document.createElement('button');close.type='button';close.className='draft-close';close.textContent='×';close.setAttribute('aria-label','Close sign-in prompt');close.onclick=()=>dialog.close();dialog.append(close,title,status);document.body.append(dialog);dialog.showModal();
    dialog.insertBefore(emblem,title);
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    try{
      const fields=captureFields(form);
      const response=await fetch('/api/trip-drafts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload:{fields,preview}})});const result=await response.json();if(!response.ok)throw Error(result.message);
      status.textContent='Your trip is held for 20 minutes. Log in or create an account to keep planning — your choices will be waiting.';
      for(const [label,path] of [['Log in','/login'],['Create account','/signup']]){const link=document.createElement('a');link.className='button '+(path==='/login'?'button-primary':'button-secondary');link.textContent=label;link.href=`${path}?redirect=${encodeURIComponent('/trip-planner?resume_draft=1')}`;dialog.append(link);}
    }catch(error){status.textContent=error.message||'Unable to save your choices. Please try again.';}finally{busy=false;}
    return false;
  }
  async function resume(){
    if(!new URLSearchParams(location.search).has('resume_draft'))return;
    if(!await window.PackSwift.authReady){location.assign('/login?redirect='+encodeURIComponent('/trip-planner?resume_draft=1'));return;}
    const feedback=document.getElementById('planner-feedback');
    try{
      const response=await fetch('/api/trip-drafts/restore',{method:'POST'});const result=await response.json();if(!response.ok)throw Error(result.message);
      const form=document.getElementById('trip-planner-form');
      window.PackSwiftRestoringDraft=true;
      restoreFields(form,result.payload.fields);
      window.dispatchEvent(new Event('packswift:pets-restored'));
      window.dispatchEvent(new CustomEvent('packswift:draft-restored',{detail:{action:result.action,preview:result.payload.preview}}));
      window.refreshDynamicBudget?.();
      history.replaceState(null,'','/trip-planner');
    }catch(error){feedback.textContent=error.message;}finally{window.PackSwiftRestoringDraft=false;}
  }
  window.PackSwiftDraft={gate,resume,captureFields,restoreFields};
})();
