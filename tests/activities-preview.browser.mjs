import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
 page.on('pageerror',error=>errors.push(error.message));
 let failNext=false;
 await page.route('**/api/places/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/popular-activities')){
   const q=Object.fromEntries(url.searchParams);requests.push(q);
   if(failNext){failNext=false;return route.fulfill({status:503,json:{message:'Please try again.'}});}
   const city=q.destination,kind=q.purpose==='Food, Drink & Culinary'?'Market':'Boutique',offset=Number(q.variant)*8+(q.pageToken?4:0);
   const item=n=>({id:`${city}-${kind}-${n}`,name:`${city} ${kind} ${n}`,rating:n===3?null:4.8,ratingCount:n===3?null:100,imageUrl:'/api/activities/photo/test-market',imageAuthors:[{name:'Test photographer',url:'https://example.com/credit'}]});
   const items=Array.from({length:4},(_,i)=>item(offset+i+1));if(q.pageToken)items.unshift(item(1));
   return route.fulfill({json:{items,nextPageToken:q.pageToken?null:'page-two'}});
  }
  return route.fulfill({json:[]});
 });
 await page.route('**/api/activities/photo/**',route=>route.fulfill({path:new URL('../public/images/planner-wat-arun.jpg',import.meta.url).pathname,contentType:'image/jpeg'}));
 await page.route('**/api/v1/trips/live-review',route=>route.fulfill({json:{itinerary:[]}}));
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:3000')+'/trip-planner');
 await page.waitForSelector('.planner-horizontal');
 const setField=(name,value)=>page.evaluate(({name,value})=>{const e=document.querySelector(`[name="${name}"]`);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},{name,value});
 const setPreferences=async(style='Balanced')=>{await setField('travelPurposes',JSON.stringify(['Food, Drink & Culinary','Shopping & Fashion']));await setField('travelStyle',style);};
 await setField('destination','Bangkok');
 const panel=page.locator('[data-preview-section="Activities"]'),heading=name=>panel.getByRole('heading',{name,exact:true});
 await page.waitForTimeout(800);assert.equal(requests.length,0,'No generic search before selecting interests');
 await setPreferences();await heading('Bangkok Market 1').waitFor();
 assert.match(await panel.innerText(),/100 reviews/);assert.match(await panel.innerText(),/Rating unavailable/);
 assert.deepEqual(requests.slice(0,2).map(q=>q.purpose).sort(),['Food, Drink & Culinary','Shopping & Fashion'].sort());
 assert.ok(requests.every(q=>q.style==='Balanced'));
 assert.deepEqual(await panel.locator('.activity-preview-body h3').allTextContents(),['Bangkok Market 1','Bangkok Boutique 1','Bangkok Market 2','Bangkok Boutique 2','Bangkok Market 3','Bangkok Boutique 3']);
 const up=panel.getByRole('button',{name:'Interested in Bangkok Market 1',exact:true});
 await up.click();assert.equal(await up.getAttribute('aria-pressed'),'true');
 await panel.getByRole('button',{name:'Not interested in Bangkok Market 1',exact:true}).click();
 assert.equal(await up.count(),0);assert.equal(await panel.locator('.activity-preview-card').count(),6);
 await panel.getByRole('button',{name:'Undo last dismissal'}).click();assert.equal(await up.count(),1);await up.click();
 await panel.getByRole('button',{name:'Not interested in Bangkok Boutique 1',exact:true}).click();
 await panel.evaluate(e=>e.scrollTop=e.scrollHeight);
 await page.waitForFunction(()=>document.querySelectorAll('.activity-preview-card').length>6);
 await panel.evaluate(e=>e.scrollTop=e.scrollHeight);
 await page.waitForFunction(()=>document.querySelectorAll('.activity-preview-card').length>10);
 assert.ok(requests.some(q=>q.pageToken==='page-two'));
 const ids=await panel.locator('[data-activity-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.activityId));
 assert.equal(new Set(ids).size,ids.length);assert.ok(!ids.includes('Bangkok-Boutique-1'));
 await setPreferences('Pocket Friendly');await heading('Bangkok Market 1').waitFor();
 assert.ok(requests.some(q=>q.style==='Pocket Friendly'));assert.equal(await up.getAttribute('aria-pressed'),'true');assert.equal(await heading('Bangkok Boutique 1').count(),0);
 await setField('destination','Hanoi');await heading('Hanoi Market 1').waitFor();
 assert.equal(await panel.getByRole('button',{name:'Interested in Hanoi Market 1',exact:true}).getAttribute('aria-pressed'),'false');
 await setField('destination','Bangkok');await heading('Bangkok Market 1').waitFor();assert.equal(await up.getAttribute('aria-pressed'),'true');
 failNext=true;await setPreferences('Ultimate Luxury');await panel.getByRole('button',{name:'Try again',exact:true}).waitFor();await panel.getByRole('button',{name:'Try again',exact:true}).click();await heading('Bangkok Market 1').waitFor();
 // Votes must still pass through the existing login and saved-trip flow.
 let captured;
 await page.route('**/api/trip-drafts',route=>{captured=route.request().postDataJSON();return route.fulfill({status:201,json:{expiresIn:1200}});});
 await page.evaluate(()=>{for(const [id,value]of [['origin-search','Yangon'],['start-date','2027-01-01'],['end-date','2027-01-06'],['budget','10000']]){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}document.getElementById('studio-save').click();});
 await page.getByRole('link',{name:'Log in',exact:true}).waitFor();assert.ok(captured.payload.fields.some(f=>f.name==='activityChoices'&&f.value.includes('Bangkok-Market-1')));await page.getByRole('button',{name:'Close sign-in prompt'}).click();
 await page.reload();await page.waitForSelector('.planner-horizontal');await setField('destination','Bangkok');await setPreferences();await heading('Bangkok Market 1').waitFor();
 assert.equal(await up.getAttribute('aria-pressed'),'true');assert.equal(await heading('Bangkok Boutique 1').count(),0,'Dismissals survive reload');
 await page.evaluate(fields=>{PackSwiftDraft.restoreFields(document.getElementById('trip-planner-form'),fields);window.dispatchEvent(new Event('packswift:planner-loaded'));},captured.payload.fields);
 await heading('Bangkok Market 1').waitFor();assert.equal(await page.locator('.selected-thumbnails figure').count(),0);
 let savedDetails;const tripId='00000000-0000-4000-8000-000000000001';
 await page.route('**/api/trips/analyze',route=>route.fulfill({status:201,json:{persistence:{saved:true,tripId}}}));
 await page.route('**/api/trips/'+tripId+'/details',route=>{savedDetails=route.request().postDataJSON();return route.fulfill({json:{success:true}});});
 await page.evaluate(()=>{PackSwift.authReady=Promise.resolve({id:1});document.getElementById('studio-save').click();});await page.waitForFunction(()=>document.getElementById('studio-save-status').textContent.includes('Trip saved'));
 assert.ok(savedDetails.fields.some(f=>f.name==='activityChoices'&&f.value.includes('Bangkok-Market-1')));
 await page.route('**/api/trips/'+tripId,route=>route.fulfill({json:{trip:{preferences:{detailPlanning:savedDetails}}}}));
 await page.reload();await heading('Bangkok Market 1').waitFor();assert.equal(await up.getAttribute('aria-pressed'),'true');
 for(let i=0;i<20;i++){
  await panel.evaluate(e=>e.scrollTop=e.scrollHeight);await page.waitForTimeout(150);
  const more=panel.getByRole('button',{name:'More activities',exact:true});if(await more.isVisible()&&await more.isEnabled())await more.click();
  if((await panel.locator('.activities-provider-status').innerText()).includes('reached'))break;
 }
 assert.match(await panel.locator('.activities-provider-status').innerText(),/reached the available matches/);
 const endCalls=requests.length;await panel.evaluate(e=>e.scrollTop=e.scrollHeight);await page.waitForTimeout(300);assert.equal(requests.length,endCalls);
 await panel.evaluate(e=>e.scrollTop=0);await panel.scrollIntoViewIfNeeded();if(process.env.SCREENSHOT_PATH)await page.screenshot({path:process.env.SCREENSHOT_PATH});
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);const bounds=await panel.boundingBox();assert.ok(bounds.height<=721);for(const card of await panel.locator('.activity-preview-card').all()){const b=await card.boundingBox();assert.ok(b.width<bounds.width);}}
 await page.evaluate(()=>PackSwift.setThemePreference('dark'));assert.equal(await up.getAttribute('aria-pressed'),'true');assert.deepEqual(errors,[]);
 console.log('PASS: all-purpose/style matching, replacement, undo, cursor scrolling, deduplication, retry, exhaustion, login/save restoration and responsive containment');
}finally{await browser.close();}
