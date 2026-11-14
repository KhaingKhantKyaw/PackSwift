import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],saved=[];let briefingCalls=0;
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/auth/me')return route.fulfill({json:{user:null}});
  if(url.pathname==='/api/v1/trips/live-review'){briefingCalls++;return route.fulfill({json:{itinerary:[]}});}
  if(url.pathname==='/api/trip-forecast')return route.fulfill({json:{status:'outside-horizon',daily:[]}});
  if(url.pathname==='/api/trips/draft'){saved.push(route.request().postDataJSON());return route.fulfill({json:{tripId:'guidance-test',budgetStatus:'unfinished'}});}
  if(url.pathname==='/api/trips/guidance-test')return route.fulfill({json:{trip:{preferences:{detailPlanning:saved.at(-1)},packingProgress:[]}}});
  if(url.pathname.includes('popular-activities'))return route.fulfill({json:{items:[]}});
  if(url.pathname.startsWith('/api/places'))return route.fulfill({json:[]});
  return route.fulfill({json:{}});
 });
 const base=process.env.BASE_URL||'http://127.0.0.1:3000';
 await page.goto(base+'/trip-planner');await page.waitForSelector('.travel-guidance-panel');await page.waitForTimeout(600);
 const experience=page.locator('.travel-guidance-panel');
 assert.equal(await experience.getByRole('radio',{checked:true}).count(),0,'No experience selected by default');
 assert.ok(await experience.evaluate(n=>n.nextElementSibling.classList.contains('trip-comfort-controls')),'Experience directly precedes comfort');
 const set=async(name,value)=>page.evaluate(({name,value})=>{const field=document.querySelector('[name="'+name+'"]');field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));},{name,value});
 for(const [name,value]of Object.entries({origin:'Yangon',destination:'Bangkok',startDate:'2027-01-01',endDate:'2027-01-06',adults:'2',travelStyle:'Balanced'}))await set(name,value);
 await page.waitForTimeout(800);
 const packing=page.locator('[data-preview-section="Packing List"]'),itinerary=page.locator('[data-preview-section="Itinerary"]');
 const original=await page.evaluate(()=>({pace:document.querySelector('[name="pace"]').value,style:document.querySelector('[name="travelStyle"]').value,plan:document.getElementById('itinerary-plan-state').value,packing:document.getElementById('packing-snapshot').value}));
 const calls=briefingCalls;
 await experience.getByRole('radio',{name:/This is my first trip/}).click();
 assert.equal(await page.evaluate(()=>PackSwiftTravelGuidance.getMode()),'detailed');
 await experience.getByRole('button',{name:'Quick view',exact:true}).click();
 await experience.getByRole('radio',{name:/I've travelled before/}).click();
 assert.equal(await page.evaluate(()=>PackSwiftTravelGuidance.getMode()),'quick');
 await experience.getByRole('radio',{name:/This is my first trip/}).click();
 assert.equal(await page.evaluate(()=>PackSwiftTravelGuidance.getMode()),'quick','Explicit override retained');
 await experience.getByRole('button',{name:'Use experience default'}).click();
 assert.equal(await page.evaluate(()=>PackSwiftTravelGuidance.getMode()),'detailed');
 await page.waitForTimeout(500);assert.equal(briefingCalls,calls,'Guidance never triggers provider briefing requests');
 assert.deepEqual(await page.evaluate(()=>({pace:document.querySelector('[name="pace"]').value,style:document.querySelector('[name="travelStyle"]').value,plan:document.getElementById('itinerary-plan-state').value,packing:document.getElementById('packing-snapshot').value})),original,'Guidance does not alter actual trip decisions');
 assert.match(await packing.locator('summary').first().innerText(),/Packing & Trip Essentials/);
 await packing.getByRole('tab',{name:'How to pack'}).click();assert.equal(await packing.locator('.packing-tip[open]').count()>2,true);
 await packing.getByRole('button',{name:'Switch to Quick view'}).click();assert.equal(await packing.locator('.packing-tip[open]').count(),0);
 assert.equal(await experience.getByRole('button',{name:'Quick view',exact:true}).getAttribute('aria-pressed'),'true');
 await packing.getByRole('tab',{name:'Before you go'}).click();
 const check=packing.getByRole('checkbox',{name:'Check bookings and key times'});await check.check();
 assert.match(await packing.locator('.preparation-progress').innerText(),/1 \/ 5/);
 assert.match(await packing.locator('.packing-progress-text').innerText(),/^0 \/ /);
 await packing.getByRole('tab',{name:'What to pack'}).click();
 await packing.getByRole('checkbox',{name:'Packed Passport',exact:true}).check();
 await packing.getByRole('button',{name:'Remove Passport',exact:true}).click();
 await packing.getByRole('button',{name:'Undo removal',exact:true}).click();
 assert.equal(await packing.getByRole('checkbox',{name:'Packed Passport',exact:true}).isChecked(),true);
 const custom=packing.getByRole('textbox',{name:'New item in Documents & Money'});await custom.fill('Extra document pouch');await custom.press('Enter');
 assert.equal(await packing.getByRole('textbox',{name:'Item name: Extra document pouch'}).count(),1);
 await packing.getByRole('tab',{name:'What to pack'}).focus();await page.keyboard.press('ArrowRight');
 assert.equal(await packing.getByRole('tab',{name:'How to pack'}).getAttribute('aria-selected'),'true');
 await page.reload();await page.waitForSelector('.travel-guidance-panel');await page.waitForTimeout(800);
 assert.equal(await page.evaluate(()=>PackSwiftTravelGuidance.read().experience),'first');
 assert.equal(await page.evaluate(()=>PackSwiftTravelGuidance.getMode()),'quick');
 await packing.getByRole('tab',{name:'Before you go'}).click();assert.equal(await check.isChecked(),true,'Preparation restored from guest tab draft');
 await set('endDate','2027-01-07');assert.equal(await check.isChecked(),false,'Relevant check reopens for changed dates');
 assert.match(await packing.innerText(),/Trip details changed/);await check.check();
 await page.evaluate(()=>{PackSwift.authReady=Promise.resolve({id:7});document.getElementById('studio-save').click();});
 await page.waitForFunction(()=>document.getElementById('studio-save-status').textContent.includes('Draft saved'));
 assert.equal(saved.length,1);assert.ok(saved[0].fields.find(f=>f.name==='travelGuidance').value.includes('bookings'));
 await page.goto(base+'/trip-planner?trip_id=guidance-test');await page.waitForSelector('.travel-guidance-panel');await page.waitForTimeout(700);
 await packing.getByRole('tab',{name:'Before you go'}).click();assert.equal(await check.isChecked(),true,'Preparation restored from saved trip');
 for(const width of [1600,1100,390]){
  await page.setViewportSize({width,height:1000});await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'No page overflow at '+width);
  const a=await packing.boundingBox(),b=await itinerary.boundingBox();assert.ok(Math.abs(a.height-b.height)<2,'Packing and itinerary remain equal height at '+width);
  assert.ok(await packing.evaluate(n=>n.scrollWidth<=n.clientWidth+1),'Packing contents stay inside the panel at '+width);
  for(const tab of ['What to pack','How to pack','Before you go']){await packing.getByRole('tab',{name:tab}).click();const after=await packing.boundingBox();assert.ok(Math.abs(a.height-after.height)<2,'Tabs never grow the outer panel');}
 }
 const weatherCheck=packing.getByRole('checkbox',{name:'Review the weather near departure'});await weatherCheck.scrollIntoViewIfNeeded();
 const beforeScroll=await packing.evaluate(n=>({panel:n.scrollTop,page:window.scrollY}));await weatherCheck.check();
 const afterScroll=await packing.evaluate(n=>({panel:n.scrollTop,page:window.scrollY}));assert.ok(Math.abs(beforeScroll.panel-afterScroll.panel)<2&&Math.abs(beforeScroll.page-afterScroll.page)<2,'Checking preparation keeps the reader in place');
 for(const theme of ['dark','light']){
  await page.evaluate(value=>PackSwift.setThemePreference(value),theme);await page.waitForTimeout(400);assert.equal(await packing.isVisible(),true);
  const ratios=await page.evaluate(()=>{
   const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number);
   const lum=values=>values.map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;}).reduce((total,value,index)=>total+value*[.2126,.7152,.0722][index],0);
   return ['.travel-guidance-choice[aria-checked="true"]','.travel-guidance-levels button[aria-pressed="true"]','.packing-tabs button[aria-selected="true"]'].map(selector=>{const style=getComputedStyle(document.querySelector(selector)),a=lum(rgb(style.color)),b=lum(rgb(style.backgroundColor));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
  });
  assert.ok(ratios.every(r=>r>=4.5),'Guidance controls meet 4.5:1 text contrast in '+theme+': '+ratios.join(','));
 }
 await page.setViewportSize({width:1440,height:1000});await experience.scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/packswift-travel-experience.png'});
 await packing.scrollIntoViewIfNeeded();await packing.evaluate(n=>n.scrollTop=0);await page.screenshot({path:'/tmp/packswift-trip-essentials.png'});
 assert.deepEqual(errors,[]);console.log('PASS: experience, shared guidance, unchanged trip decisions, tabs, packing CRUD, separate preparation, guest/saved restore, context invalidation, keyboard, responsive equal panels and themes');
}finally{await browser.close();}
