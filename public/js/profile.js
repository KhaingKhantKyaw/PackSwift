const $=s=>document.querySelector(s);
const textField=(name,label,placeholder='',max=160)=>'<label>'+label+'<input name="'+name+'" maxlength="'+max+'" placeholder="'+placeholder+'"></label>';
const select=(name,label,options)=>'<label>'+label+'<select name="'+name+'"><option value="">Select '+label.toLowerCase()+'</option>'+options.map(x=>'<option>'+x+'</option>').join('')+'</select></label>';
const purposes=['Relaxation & Wellness','Nature & Outdoor','Food, Drink & Culinary','Shopping & Fashion','Nightlife & Entertainment','Local Life & Socializing','Events, Festivals & Sports','Content Creation & Photography','Water & Marine Activities','Culture, History & Heritage'];
const card=(title,icon,body)=>'<section class="profile-card"><h2><span class="section-icon" aria-hidden="true">'+icon+'</span>'+title+'</h2>'+body+'</section>';
$('#profile-panels').innerHTML=
card('Personal details','♙','<div class="fields">'+textField('fullName','Name','Your name',100)+textField('homeCity','Home city','Your home city')+select('currency','Currency',['THB','USD','EUR','GBP','SGD','JPY','MMK','AUD'])+select('language','Language',['English','Thai','Burmese'])+'</div><details class="profile-expand"><summary>Account contact details</summary><div class="fields">'+textField('username','Username','',50)+textField('email','Email','',255)+'</div></details>')+
card('Travel preferences','◇','<div class="fields">'+select('travelStyle','Travel style',['Pocket friendly','Balanced','Comfort & value','Full experience','Ultimate luxury'])+select('transportation','Transportation',['Public transit','Public transit + taxi','Private transfer','Walking & cycling'])+'</div><details class="profile-expand"><summary>Travel interests <span id="interest-count"></span></summary><div class="interest-options">'+purposes.map(p=>'<label><input type="checkbox" name="interests" value="'+p+'">'+p+'</label>').join('')+'</div></details><p>Save your preferences here. Applying them to new trips will be added separately.</p>')+
card('Packing preferences','▣','<div class="fields">'+select('luggage','Luggage',['Carry-on only','Checked luggage','Backpack'])+select('laundry','Laundry frequency',['Every few days','Weekly','No laundry planned'])+'</div><label>Personal essentials</label><div class="packing-chips" id="packing-items"></div><div class="add-item-row"><input id="new-packing-item" maxlength="80" aria-label="Personal packing item" placeholder="Add a personal item"><button id="add-packing-item" type="button">＋ Add</button></div>'+textField('packingExclusions','Usually leave at home','e.g. hair dryer, travel pillow',500))+
card('Traveler details','♧',textField('nationality','Nationality (optional)','Your nationality',100)+[['Travel companions','companions','Names or nicknames'],['Accessibility needs','accessibility','Only share what you want us to remember'],['Pets','pets','Pets you travel with']].map(([title,name,placeholder])=>'<details class="profile-expand"><summary>'+title+'</summary>'+textField(name,title,placeholder,500)+'</details>').join(''));
const form=$('#profile-form');
form.querySelector('.profile-expand').open=true;
form.elements.username.minLength=3;
form.elements.username.pattern='[a-zA-Z0-9._-]+';
form.elements.username.autocomplete='username';
form.elements.email.autocomplete='email';
const identityInfo=$('#profile-name').parentElement;
const userIdLabel=document.createElement('small');userIdLabel.id='profile-user-id';identityInfo.append(userIdLabel);
const photoControls=document.createElement('div');photoControls.className='photo-controls';
photoControls.innerHTML='<label class="photo-upload">Change photo<input id="profile-photo-input" type="file" accept="image/jpeg,image/png,image/webp"></label><button id="remove-photo" type="button" hidden>Remove photo</button><span id="photo-feedback" role="status"></span>';
$('.identity-bar').after(photoControls);
function renderPhoto(picture){
  const avatar=$('#profile-initials');
  if(picture){const img=document.createElement('img');img.src=picture;img.alt='Your profile photo';avatar.replaceChildren(img);}
  else avatar.textContent=$('#profile-name').textContent.split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase();
  $('#remove-photo').hidden=!picture;
}
async function savePhoto(picture){
  const feedback=$('#photo-feedback');feedback.textContent='Saving photo…';
  try{const result=await window.PackSwift.api('/api/profile/picture',{method:'PUT',body:JSON.stringify({picture})});saved.picture=result.picture;renderPhoto(result.picture);feedback.textContent=picture?'Profile photo updated.':'Profile photo removed.';}
  catch(error){feedback.textContent=error.message;}
}
$('#profile-photo-input').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  const feedback=$('#photo-feedback');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){feedback.textContent='Choose a JPG, PNG or WebP photo under 5 MB.';e.target.value='';return;}
  e.target.disabled=true;$('#remove-photo').disabled=true;
  try{
    const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,256,256);const side=Math.min(bitmap.width,bitmap.height);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);bitmap.close();await savePhoto(canvas.toDataURL('image/jpeg',.82));
  }catch{feedback.textContent='This photo could not be opened. Try another image.';}
  finally{e.target.disabled=false;e.target.value='';$('#remove-photo').disabled=false;}
};
$('#remove-photo').onclick=async()=>{const button=$('#remove-photo');button.disabled=true;await savePhoto(null);button.disabled=false;};
const iconPaths=[
 '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2Z"/>',
 '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6Z"/>',
 '<rect x="5" y="6" width="14" height="15" rx="2"/><path d="M9 6V3h6v3M9 10v7m6-7v7"/>',
 '<circle cx="9" cy="8" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M16 5a3 3 0 0 1 0 6m3 10v-3a7 7 0 0 0-2-5"/>'
];
document.querySelectorAll('.section-icon').forEach((el,i)=>{el.innerHTML='<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+iconPaths[i]+'</svg>';});
for(const name of ['fullName','username','email'])form.elements[name].required=true;
form.elements.email.type='email';
let items=[],saved={};
const fields=['homeCity','currency','language','travelStyle','transportation','luggage','laundry','packingExclusions','nationality','companions','accessibility','pets'];
function renderItems(){const root=$('#packing-items');root.replaceChildren();items.forEach((item,i)=>{const b=document.createElement('button');b.type='button';b.textContent=item+' ×';b.setAttribute('aria-label','Remove '+item);b.onclick=()=>{items.splice(i,1);renderItems();};root.append(b);});}
function addItem(){const input=$('#new-packing-item'),v=input.value.trim();if(v&&!items.includes(v)&&items.length<50){items.push(v);input.value='';renderItems();}}
$('#add-packing-item').onclick=addItem;$('#new-packing-item').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addItem();}};
function updateCount(){$('#interest-count').textContent='· '+form.querySelectorAll('[name=interests]:checked').length+' selected';}
form.addEventListener('change',updateCount);
function identity(user){$('#profile-name').textContent=user.fullName;$('#profile-user-id').textContent='User ID: '+user.id;renderPhoto(saved.picture);}
$('#edit-profile').onclick=()=>{form.elements.fullName.focus();form.elements.fullName.scrollIntoView({block:'center',behavior:'smooth'});};
async function load(){try{const user=await window.PackSwift.authReady;if(!user){$('#profile-status').hidden=true;$('#profile-guest').hidden=false;return;}const result=await window.PackSwift.api('/api/profile/preferences');saved=result.preferences||{};identity(user);for(const n of ['fullName','username','email'])form.elements[n].value=user[n]||'';for(const n of fields)form.elements[n].value=saved[n]||'';for(const input of form.querySelectorAll('[name=interests]'))input.checked=(saved.interests||[]).includes(input.value);items=[...(saved.packingItems||[])];renderItems();updateCount();$('#profile-content').hidden=false;$('#profile-status').hidden=true;}catch(e){$('#profile-status').textContent='Unable to load profile: '+e.message;}}
form.onsubmit=async e=>{e.preventDefault();const feedback=$('#save-feedback'),button=form.querySelector('[type=submit]');button.disabled=true;feedback.textContent='Saving…';try{const account=Object.fromEntries(['fullName','username','email'].map(n=>[n,form.elements[n].value.trim()]));const result=await window.PackSwift.api('/api/auth/settings',{method:'PUT',body:JSON.stringify(account)});window.PackSwift.setCurrentUser(result.user);identity(result.user);const preferences=Object.fromEntries(fields.map(n=>[n,form.elements[n].value.trim()]));preferences.interests=[...form.querySelectorAll('[name=interests]:checked')].map(x=>x.value);preferences.packingItems=items;await window.PackSwift.api('/api/profile/preferences',{method:'PUT',body:JSON.stringify(preferences)});saved={...saved,...preferences};feedback.textContent='Profile and preferences saved.';}catch(error){feedback.textContent='Some changes may not be saved. '+error.message;}finally{button.disabled=false;}};
$('#password-form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button');b.disabled=true;try{await window.PackSwift.api('/api/auth/password',{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(f)))});f.reset();$('#password-feedback').textContent='Password updated.';}catch(error){$('#password-feedback').textContent=error.message;}finally{b.disabled=false;}};
$('#export-profile').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(saved,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='packswift-preferences.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
load();
