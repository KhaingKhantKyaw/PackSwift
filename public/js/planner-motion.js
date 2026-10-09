/* Presentation only. No timers, network requests or trip state. */
window.PackSwiftPlannerMotion=(()=>{
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const running=new WeakMap();
 const ease='cubic-bezier(0.22,1,0.36,1)';
 function animate(element,frames,duration=240){
  if(!element)return;
  running.get(element)?.cancel();
  if(reduced())return;
  const animation=element.animate(frames,{duration,easing:ease});running.set(element,animation);
  animation.finished.catch(()=>{}).finally(()=>{if(running.get(element)===animation)running.delete(element);});
  return animation;
 }
 function text(element,value){if(element.textContent===String(value))return;element.textContent=value;animate(element,[{opacity:.55,transform:'translateY(3px)'},{opacity:1,transform:'none'}]);}
 let ghost,stepAnimation;
 function step(before,after,change,direction){
  ghost?.remove();stepAnimation?.cancel();
  const parent=after.parentElement,oldHeight=parent.getBoundingClientRect().height;
  if(before&&before!==after&&!reduced()){
   const rect=before.getBoundingClientRect(),host=parent.getBoundingClientRect();
   ghost=before.cloneNode(true);ghost.removeAttribute('id');ghost.removeAttribute('data-step');
   ghost.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
   ghost.querySelectorAll('[name]').forEach(n=>n.removeAttribute('name'));
   ghost.inert=true;ghost.setAttribute('aria-hidden','true');ghost.classList.add('planner-step-ghost');
   Object.assign(ghost.style,{position:'absolute',top:rect.top-host.top+'px',left:rect.left-host.left+'px',width:rect.width+'px',height:rect.height+'px',margin:'0',pointerEvents:'none',zIndex:'2'});
   parent.append(ghost);
   const leaving=ghost;animate(leaving,[{opacity:1},{opacity:0,transform:`translateX(${-direction*10}px)`}],180)?.finished.catch(()=>{}).finally(()=>leaving.remove());
  }
  change();
  if(before!==after){
   const mobile=matchMedia('(max-width:600px)').matches;
   animate(after,[{opacity:0,transform:mobile?'translateY(6px)':`translateX(${direction*10}px)`},{opacity:1,transform:'none'}],320);
   const height=parent.getBoundingClientRect().height;
   if(Math.abs(height-oldHeight)>2)stepAnimation=animate(parent,[{height:oldHeight+'px'},{height:height+'px'}],320);
   const rect=after.getBoundingClientRect();
   if(rect.top<90||rect.top>innerHeight-100)after.scrollIntoView({block:'start',behavior:reduced()?'instant':'smooth'});
  }
 }
 return{animate,text,step,reduced};
})();
