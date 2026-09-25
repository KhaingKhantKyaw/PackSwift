(() => {
  let busy=false;
  async function gate(action,preview={}){
    if(await window.PackSwift.authReady)return true;
    if(busy)return false;busy=true;
    const form=document.getElementById('trip-planner-form');
    const dialog=document.createElement('dialog');dialog.className='trip-auth-dialog';dialog.setAttribute('aria-label','Save your trip and continue');
    const title=document.createElement('h2');title.textContent='Your trip is worth keeping.';
    const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Saving your choices for 20 minutes…';
    const close=document.createElement('button');close.type='button';close.className='draft-close';close.textContent='×';close.setAttribute('aria-label','Close sign-in prompt');close.onclick=()=>dialog.close();dialog.append(close,title,status);document.body.append(dialog);dialog.showModal();
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    try{
      const fields=[...form.elements].filter(el=>el.name&&['INPUT','SELECT','TEXTAREA'].includes(el.tagName)).map(el=>({name:el.name,value:el.value,checked:el.checked,type:el.type}));
      const response=await fetch('/api/trip-drafts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload:{fields,preview}})});const result=await response.json();if(!response.ok)throw Error(result.message);
      status.textContent='Your choices are saved for 20 minutes. Log in or create an account to continue where you left off.';
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
      for(const saved of result.payload.fields||[]){for(const el of form.elements){if(el.name!==saved.name)continue;if(el.type==='radio'||el.type==='checkbox'){if(el.value===saved.value)el.checked=Boolean(saved.checked);}else el.value=saved.value;}}
      window.dispatchEvent(new CustomEvent('packswift:draft-restored',{detail:{action:result.action,preview:result.payload.preview}}));
      history.replaceState(null,'','/trip-planner');
    }catch(error){feedback.textContent=error.message;}
  }
  window.PackSwiftDraft={gate,resume};
})();
