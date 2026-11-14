(() => {
  let busy=false;
  const intentKey='packswift.planner-save-intent.v1';
  function readIntent(){try{return JSON.parse(sessionStorage.getItem(intentKey));}catch{return null;}}
  function forgetIntent(id){try{if(readIntent()?.id===id)sessionStorage.removeItem(intentKey);}catch{}}
  window.addEventListener?.('pageshow',()=>{
    // Browser Back to an ordinary planner cancels the old sign-in journey as well.
    if(location.pathname==='/trip-planner'&&!new URLSearchParams(location.search).has('resume_draft'))forgetIntent(readIntent()?.id);
  });
  function captureFields(form){
    return [...form.elements].filter(el=>el.name&&!el.dataset?.preferenceTransient&&['INPUT','SELECT','TEXTAREA'].includes(el.tagName)).map(el=>({id:el.id||null,name:el.name,value:el.value,checked:el.checked,type:el.type,disabled:el.disabled}));
  }
  function restoreFields(form,fields){
    const controls=[...form.elements];const used=new Map();
    if(form.dataset&&(fields||[]).some(f=>f.name==='currency'&&f.value))form.dataset.restoredCurrency='true';
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
  // Only the active tab may hand this snapshot to sign-in; the URL holds no trip data.
  function promptToSave(form,preview){
    if(document.querySelector('dialog[data-planner-save]'))return;
    const id=crypto.randomUUID(),destination=new URLSearchParams(location.search).get('destination');
    const returnPath='/trip-planner'+(destination?'?'+new URLSearchParams({destination}):'');
    const dialog=document.createElement('dialog');dialog.className='trip-auth-dialog planner-save-dialog';
    dialog.dataset.plannerSave='';dialog.setAttribute('aria-labelledby','planner-save-title');dialog.setAttribute('aria-describedby','planner-save-description');
    const title=document.createElement('h2');title.id='planner-save-title';title.textContent='Save to My Trips';
    const description=document.createElement('p');description.id='planner-save-description';description.textContent='Sign in or create an account to save this trip and edit it later. You can keep planning without an account.';
    const status=document.createElement('p');status.setAttribute('role','status');
    const close=document.createElement('button');close.type='button';close.className='draft-close';close.textContent='×';close.setAttribute('aria-label','Close sign-in prompt');close.onclick=()=>dialog.close();
    const actions=document.createElement('div');actions.className='planner-save-actions';
    const keep=document.createElement('button');keep.type='button';keep.textContent='Keep planning';keep.onclick=()=>dialog.close();
    for(const [label,path] of [['Log in','/login'],['Create account','/signup']]){
      const link=document.createElement('a');link.className='button '+(path==='/login'?'button-primary':'button-secondary');link.textContent=label;
      link.href=path+'?redirect='+encodeURIComponent('/trip-planner?resume_draft='+id);
      link.onclick=event=>{
        event.preventDefault();
        try{
          const payload={fields:captureFields(form),preview};
          window.dispatchEvent(new Event('packswift:stash-draft'));
          sessionStorage.setItem(intentKey,JSON.stringify({id,expires:Date.now()+20*60*1000,action:'save',returnPath,payload}));
        }catch{status.textContent='Your browser could not keep this draft for sign-in. Stay on this page and allow tab storage, then try again.';return;}
        location.assign(link.href);
      };
      actions.append(link);
    }
    dialog.append(title,close,description,actions,keep,status);document.body.append(dialog);
    dialog.addEventListener('close',()=>{forgetIntent(id);dialog.remove();},{once:true});dialog.showModal();
  }
  async function gate(action,preview={}){
    if(await window.PackSwift.authReady)return true;
    if(action==='save'){promptToSave(document.getElementById('trip-planner-form'),preview);return false;}
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
    const id=new URLSearchParams(location.search).get('resume_draft');
    if(!id)return;
    if(id!=='1'){
      const intent=readIntent(),feedback=document.getElementById('studio-save-status');
      if(intent?.id!==id||intent.action!=='save'||!(intent.expires>Date.now())||!Array.isArray(intent.payload?.fields)){
        forgetIntent(id);history.replaceState(null,'','/trip-planner');
        if(feedback)feedback.textContent='This save request is no longer active. Review your plan before saving.';
        return false;
      }
      if(!await window.PackSwift.authReady){location.replace('/login?redirect='+encodeURIComponent('/trip-planner?resume_draft='+id));return true;}
      // Consume this one-time request synchronously, before any asynchronous account write.
      window.PackSwiftRestoringDraft=true;
      try{
        restoreFields(document.getElementById('trip-planner-form'),intent.payload.fields);
        forgetIntent(id);history.replaceState(null,'','/trip-planner');
        window.dispatchEvent(new Event('packswift:pets-restored'));
        window.dispatchEvent(new CustomEvent('packswift:draft-restored',{detail:{action:'save',preview:intent.payload.preview,guestSaveId:id,fields:intent.payload.fields,returnPath:intent.returnPath}}));
      }finally{window.PackSwiftRestoringDraft=false;}
      return true;
    }
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
