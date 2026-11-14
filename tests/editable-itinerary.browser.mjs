import assert from 'node:assert/strict';
import express from 'express';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import '../public/js/itinerary-plan-model.js';

// Self-hosted real UI with simulated planning/provider data: no paid API calls.
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const model=globalThis.PackSwiftItineraryPlanModel;
const app=express(),publicPath=fileURLToPath(new URL('../public',import.meta.url));
app.use(express.static(publicPath));
app.get('/trip-planner',(request,response)=>response.sendFile(publicPath+'/trip-planner.html'));
app.get('/trips/:id/itinerary',(request,response)=>response.sendFile(publicPath+'/saved-trip-workspace.html'));
const server=app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
let browser;

function fixture(input){
 const total=Math.round((Date.parse(input.endDate)-Date.parse(input.startDate))/86400000)+1;
 return model.normalize({version:1,contextKey:model.context(input),destination:input.destination,startDate:input.startDate,endDate:input.endDate,currency:input.currency||'USD',generatedAt:new Date().toISOString(),constraints:model.preferences(input),assumptions:['Simulated planning allowances for browser testing.'],warnings:[],dataWarnings:[],unscheduled:[],
  days:Array.from({length:total},(_,i)=>({day:i+1,date:new Date(Date.parse(input.startDate)+i*86400000).toISOString().slice(0,10),title:'Test day '+(i+1),warnings:[],stops:[
   {id:'day-'+(i+1)+'-museum',placeId:'test-museum-'+(i+1),provider:'google',name:'Test museum '+(i+1),kind:'activity',startTime:'10:00',durationMinutes:60,locked:false,costAmount:null,currency:input.currency||'USD',coordinates:{latitude:13.73+i*.01,longitude:100.51},warnings:[],dataWarnings:[]},
   {id:'day-'+(i+1)+'-lunch',name:'Lunch break '+(i+1),kind:'meal',startTime:'12:00',durationMinutes:60,locked:false,custom:true,costAmount:null,currency:input.currency||'USD',warnings:[],dataWarnings:[]}
  ]}))});
}

try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],builds=[],hydrations=[],saves=[],unexpectedWrites=[],workspaces=[];
 const tripId='00000000-0000-4000-8000-000000000071';
 let signedIn=false,rebuildCount=0;
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://**/*',route=>route.abort());
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/auth/me')return route.fulfill({json:{user:signedIn?{id:7,name:'Test traveler'}:null}});
  if(url.pathname==='/api/itinerary-plan'){
   const body=route.request().postDataJSON();builds.push(body);
   let plan=fixture(body.input);
   if(body.previousPlan){
    plan=structuredClone(body.previousPlan);plan.contextKey=model.context(body.input);
    const changed=plan.days.find(day=>day.day===(body.rebuildDay||1));
    const flexible=changed.stops.find(stop=>!stop.locked);
    if(flexible)flexible.name='Rebuilt flexible stop '+(++rebuildCount);
   }
   return route.fulfill({json:{plan,warnings:[]}});
  }
  if(url.pathname==='/api/itinerary-plan/hydrate'){
   const body=route.request().postDataJSON();hydrations.push(body);
   const plan=structuredClone(body.plan);
   for(const day of plan.days)for(const stop of day.stops)if(stop.provider==='google'){
    if(!stop.userEditedName)stop.name='Refreshed test museum '+day.day;
    stop.coordinates={latitude:13.73+day.day*.01,longitude:100.51};delete stop.needsRefresh;
   }
   return route.fulfill({json:{plan,warnings:[]}});
  }
  if(url.pathname==='/api/trips/draft'){
   const body=route.request().postDataJSON();saves.push(body);
   return route.fulfill({json:{saved:true,tripId,budgetStatus:'unfinished'}});
  }
  if(url.pathname==='/api/trips/'+tripId)return route.fulfill({json:{trip:{id:tripId,preferences:{detailPlanning:saves.at(-1)},packingProgress:[]}}});
  if(url.pathname==='/api/trips/'+tripId+'/workspace'){
   workspaces.push(route.request().method());
   const editablePlan=JSON.parse(saves.at(-1).fields.find(field=>field.name==='itineraryPlan').value);
   return route.fulfill({json:{details:{origin:'Yangon',destination:'Bangkok',start:'2027-01-01',end:'2027-01-03',nights:2,adults:2,children:0,style:'Balanced',currency:'USD',budget:null},editablePlan,editableStopCount:editablePlan.days.flatMap(day=>day.stops).length,workspace:{revision:0},timeline:[{day:1,title:'Legacy itinerary must not appear',startTime:'08:00'}],selectedSchedule:{days:[{day:1,activities:[{title:'Legacy selection schedule must not appear'}]}],unscheduled:[]},packing:[]}});
  }
  if(url.pathname.endsWith('/popular-activities'))return route.fulfill({json:{items:[],nextPageToken:null}});
  if(url.pathname==='/api/trip-forecast')return route.fulfill({json:{status:'unavailable',daily:[],coveredDays:0,totalDays:3}});
  if(url.pathname==='/api/v1/trips/live-review')return route.fulfill({json:{itinerary:[]}});
  if(url.pathname.startsWith('/api/places'))return route.fulfill({json:[]});
  if(route.request().method()!=='GET')unexpectedWrites.push(url.pathname);
  return route.fulfill({json:{}});
 });
 const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base+'/trip-planner');
 await page.waitForSelector('.planner-horizontal');
 await page.waitForFunction(()=>window.PackSwiftItineraryEditor&&window.PackSwiftItineraryPlanModel);
 const set=async(name,value)=>page.evaluate(({name,value})=>{
  const field=document.querySelector('[name="'+name+'"]');field.value=value;
  field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));
 },{name,value});
 for(const [name,value]of Object.entries({origin:'Yangon',destination:'Bangkok',startDate:'2027-01-01',endDate:'2027-01-03',adults:'2',children:'0',travelPurposes:'["Culture, History & Heritage"]',travelStyle:'Balanced'}))await set(name,value);
 const editor=page.locator('.itinerary-editor');
 await editor.getByRole('button',{name:'Build my itinerary',exact:true}).waitFor();
 const persisted=()=>page.locator('#itinerary-plan-state').inputValue();
 const read=()=>page.evaluate(()=>PackSwiftItineraryEditor.getPlan());
 const stop=id=>editor.locator('[data-stop-id="'+id+'"]');
 assert.equal(builds.length,0,'Entering details must not generate or replace the itinerary automatically');
 await editor.getByRole('button',{name:'Build my itinerary',exact:true}).click();
 await stop('day-1-museum').waitFor();
 assert.equal(builds.length,1);assert.deepEqual(builds[0].selected,[],'Building from destination/preferences works without preselected places');
 assert.equal(await page.locator('#itinerary-plan-state').count(),1,'A single authoritative saved-plan field exists');
 const initial=await read(),initialStored=await persisted();
 assert.equal(initial.days.length,3);assert.equal(initial.days[0].stops[0].name,'Test museum 1');
 assert.match(initialStored,/Saved place/,'Provider details are stripped from persisted state, not user edits');
 const itineraryPanel=page.locator('[data-preview-section="Itinerary"]');
 await itineraryPanel.getByRole('button',{name:'Expand Itinerary',exact:true}).click();
 await itineraryPanel.scrollIntoViewIfNeeded();
 await itineraryPanel.evaluate(node=>{node.scrollTop=0;});
 await page.screenshot({path:'/tmp/packswift-itinerary-desktop.png'});
 await itineraryPanel.getByRole('button',{name:'Expand Itinerary',exact:true}).press('Escape');

 await stop('day-1-museum').getByRole('button',{name:'Edit',exact:true}).click();
 let dialog=page.getByRole('dialog');
 await dialog.getByLabel('Stop name',{exact:true}).fill('My personal museum visit');
 await dialog.getByLabel('Start time (local)',{exact:true}).fill('10:30');
 await dialog.getByLabel('Duration (minutes)',{exact:true}).fill('90');
 await dialog.getByLabel('Notes (optional)',{exact:true}).fill('Ask for step-free access before the visit.');
 await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
 await page.waitForFunction(()=>PackSwiftItineraryEditor.getPlan().days[0].stops[0].name==='My personal museum visit');
 let edited=await read();assert.equal(edited.days[0].stops[0].startTime,'10:30');assert.equal(edited.days[0].stops[0].durationMinutes,90);
 assert.match(await persisted(),/My personal museum visit/);assert.match(await persisted(),/step-free/);
 await editor.getByRole('button',{name:'Undo last change',exact:true}).click();
 assert.deepEqual((await read()).days,initial.days,'Undo restores the previous day contents');

 await stop('day-1-museum').getByRole('button',{name:'Edit',exact:true}).click();dialog=page.getByRole('dialog');
 await dialog.getByLabel('Stop name',{exact:true}).fill('My fixed museum visit');
 await dialog.getByLabel('Start time (local)',{exact:true}).fill('10:45');
 await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
 await stop('day-1-museum').getByRole('button',{name:'Keep fixed',exact:true}).click();
 const fixed=await read();assert.equal(fixed.days[0].stops[0].locked,true);
 for(const action of ['Edit','Move / day','Replace','Remove']){
  const before=await persisted();
  await stop('day-1-museum').getByRole('button',{name:action,exact:true}).click();
  dialog=page.getByRole('dialog',{name:'Unlock this fixed stop?'});await dialog.waitFor();
  await dialog.getByRole('button',{name:'Keep fixed',exact:true}).click();
  assert.equal(await persisted(),before,'Locked '+action+' leaves the plan untouched without explicit unlocking');
 }
 assert.equal(await page.evaluate(()=>{try{PackSwiftItineraryPlanModel.edit(PackSwiftItineraryEditor.getPlan(),{type:'remove',id:'day-1-museum'});return false;}catch{return true;}}),true,'Model also rejects edits to locked stops');

 const beforeRebuild=await persisted(),beforeDays=(await read()).days;
 await editor.getByRole('button',{name:'Rebuild Day 1',exact:true}).click();
 dialog=page.getByRole('dialog',{name:'Review rebuilt Day 1'});await dialog.waitFor();
 assert.equal(await persisted(),beforeRebuild,'Rebuild does not replace anything until confirmed');
 assert.match(await dialog.innerText(),/Rebuilt flexible stop 1/);
 await dialog.getByRole('button',{name:'Keep current itinerary',exact:true}).click();
 assert.equal(await persisted(),beforeRebuild,'Cancelling the preview preserves the exact saved state');
 await editor.getByRole('button',{name:'Rebuild Day 1',exact:true}).click();
 dialog=page.getByRole('dialog',{name:'Review rebuilt Day 1'});await dialog.waitFor();
 await dialog.getByRole('button',{name:'Accept rebuilt day',exact:true}).click();
 const rebuilt=await read();assert.equal(rebuilt.days[0].stops[1].name,'Rebuilt flexible stop 2');
 assert.deepEqual(rebuilt.days[0].stops[0],beforeDays[0].stops[0],'Fixed stop survives accepted rebuilding');
 assert.deepEqual(rebuilt.days.slice(1),beforeDays.slice(1),'Rebuilding one day leaves other days unchanged');
 assert.equal(builds.at(-1).rebuildDay,1);assert.equal(builds.at(-1).previousPlan.days[0].stops[0].locked,true);

 // Exercise actual day tabs and responsive dialogs, not only the model.
 await editor.getByRole('tab',{name:/Day 1/}).focus();await page.keyboard.press('ArrowRight');
 assert.equal(await editor.getByRole('tab',{name:/Day 2/}).getAttribute('aria-selected'),'true');
 await page.keyboard.press('Home');assert.equal(await editor.getByRole('tab',{name:/Day 1/}).getAttribute('aria-selected'),'true');
 for(const width of [1100,390]){
  await page.setViewportSize({width,height:900});
  await editor.getByRole('button',{name:'+ Personal stop',exact:true}).click();dialog=page.getByRole('dialog');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'No page overflow at '+width);
  const bounds=await dialog.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1,'Editor dialog fits viewport at '+width);
  assert.equal(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth+1),true,'No dialog horizontal overflow at '+width);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 }
 await itineraryPanel.scrollIntoViewIfNeeded();await itineraryPanel.evaluate(node=>{node.scrollTop=0;});
 await page.screenshot({path:'/tmp/packswift-itinerary-mobile.png'});
 await page.evaluate(()=>PackSwift.setThemePreference('dark'));
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 const contrasts=await editor.evaluate(root=>{
  const rgb=value=>(value.match(/[\d.]+/g)||[]).map(Number);
  const luminance=values=>values.slice(0,3).map(value=>{const n=value/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
  return ['h3','.itinerary-editor-meta','.itinerary-editor-primary','.itinerary-editor-time'].map(selector=>{
   const node=root.querySelector(selector),color=getComputedStyle(node).color;
   let parent=node,background='rgb(255, 255, 255)';
   while(parent){const value=getComputedStyle(parent).backgroundColor,parts=rgb(value);if(parts.length===3||parts[3]===1){background=value;break;}parent=parent.parentElement;}
   const a=luminance(rgb(color)),b=luminance(rgb(background));
   return {selector,color,background,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  });
 });
 for(const contrast of contrasts)assert.ok(contrast.ratio>=4.5,'Dark-mode text contrast >=4.5: '+JSON.stringify(contrast));
 await page.evaluate(()=>PackSwift.setThemePreference('light'));

 signedIn=true;
 await page.evaluate(()=>{PackSwift.authReady=Promise.resolve({id:7});document.getElementById('studio-save').click();});
 await page.waitForFunction(()=>document.getElementById('studio-save-status').textContent.includes('Draft saved'));
 assert.equal(saves.length,1);const savedField=saves[0].fields.find(field=>field.name==='itineraryPlan');
 assert.ok(savedField?.value,'Save planning includes the editable itinerary hidden field');
 assert.equal(JSON.parse(savedField.value).days[0].stops[0].locked,true);
 assert.equal(JSON.parse(savedField.value).days[0].stops[0].name,'My fixed museum visit');
 await page.goto(base+'/trip-planner?trip_id='+tripId);
 await page.waitForFunction(()=>window.PackSwiftItineraryEditor?.getPlan()?.days[0].stops[0].name==='My fixed museum visit');
 await page.waitForFunction(()=>document.querySelector('.itinerary-editor')?.textContent.includes('My fixed museum visit'));
 assert.equal(hydrations.length,1,'Saved provider details are refreshed through the hydration endpoint');
 const restored=await read();assert.equal(restored.days[0].stops[0].locked,true);assert.equal(restored.days[1].stops[0].name,'Refreshed test museum 2');
 assert.equal(restored.days[0].stops[1].name,'Rebuilt flexible stop 2');
 assert.equal(builds.length,3,'Restoring a saved plan never silently generates another itinerary');
 assert.equal(await page.locator('#itinerary-plan-state').count(),1);
 await page.goto(base+'/trips/'+tripId+'/itinerary');
 const workspace=page.locator('#saved-trip-content');
 await workspace.getByRole('heading',{name:'My fixed museum visit',exact:true}).waitFor();
 const savedStop=workspace.locator('.saved-itinerary-stop').filter({has:page.getByRole('heading',{name:'My fixed museum visit',exact:true})});
 assert.match(await savedStop.innerText(),/10:45 · 60 min · Fixed/,'Saved workspace displays the edited stop time and fixed state');
 await workspace.getByRole('heading',{name:'Rebuilt flexible stop 2',exact:true}).waitFor();
 assert.equal(await workspace.getByRole('link',{name:'Edit this itinerary',exact:true}).getAttribute('href'),'/trip-planner?trip_id='+tripId+'&view=preview');
 assert.equal(await workspace.getByRole('button',{name:/Regenerate/}).count(),0,'Editable saved plans never expose legacy regeneration controls');
 assert.doesNotMatch(await workspace.innerText(),/Legacy itinerary|Legacy selection schedule/,'The editable plan is the saved workspace source of truth');
 assert.deepEqual(workspaces,['GET']);assert.equal(hydrations.length,2,'Saved workspace hydrates provider details without regenerating');
 assert.equal(builds.length,3);assert.deepEqual(unexpectedWrites,[]);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Saved workspace fits a 390px viewport');
 assert.deepEqual(errors,[]);
 console.log('PASS: explicit generation without selections, edit/undo, fixed-stop protection, rebuild preview cancel/accept, saved-state hydration, saved workspace source of truth, keyboard day tabs, mobile layout and dark-mode contrast');
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
