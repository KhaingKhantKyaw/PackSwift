// Deterministic UI fixtures, separate from real-provider verification.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/activity-recommendations',route=>route.fulfill({json:{activities:Array.from({length:6},(_,n)=>({id:'test-card-'+n,title:n%2?'Long restaurant name with vegetarian food and regional specialties for layout verification':'Short name '+n,categories:['food'],types:['restaurant'],tripType:'in_city',imageUrl:n<2?'/images/destination-bangkok.jpg':n===4?'/api/activities/photo/test-failure':'',ticket:n===0?'Verified test price':null,travelContext:'Test location and travel details. '.repeat(12)})),demand:{tripDays:8,usableDays:6,targetPerDay:3},notices:[]}}));
 await page.route('**/api/activities/photo/test-failure',route=>route.fulfill({status:502,json:{code:'PHOTO_CONFIGURATION'}}));
 await page.goto((process.env.PLANNER_TEST_URL||'http://127.0.0.1:3000')+'/trip-planner?destination=Hanoi');await page.waitForSelector('.calendar-day');
 await page.evaluate(()=>{for(const[id,value]of Object.entries({'origin-search':'Bangkok','start-date':'2026-12-03','end-date':'2026-12-10','passport-country':'Thailand',budget:'30000'}))document.getElementById(id).value=value;document.querySelector('[data-step-button="4"]').click();});
 await page.locator('#studio-find').click();await page.waitForSelector('.activity-card');
 await page.locator('.activity-card').first().scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.activity-media').dataset.state==='ready');
 for(const [width,height]of[[1440,900],[1366,768],[1280,800],[1024,768],[768,1024],[390,844]]){
  await page.setViewportSize({width,height});
  for(const theme of ['light','dark']){
   await page.evaluate(t=>{PackSwift.setThemePreference(t);document.querySelectorAll('.activity-card details').forEach(d=>d.open=true);},theme);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   const bad=await page.locator('.activity-card').evaluateAll(cards=>cards.filter(c=>{const a=c.querySelector('.activity-actions').getBoundingClientRect(),r=c.getBoundingClientRect();return a.bottom>r.bottom+1||a.left<r.left||a.right>r.right+1;}).length);assert.equal(bad,0,`${width} ${theme} clipped actions`);
   const boxes=await page.locator('.activity-card').evaluateAll(cards=>cards.map(c=>{const r=c.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right};}));
   for(let n=1;n<boxes.length;n++)if(boxes[n].top>boxes[n-1].top+1)assert.ok(boxes[n].top>=boxes[n-1].bottom);
   await page.locator('#studio-places').screenshot({path:`/tmp/activity-cards-${width}-${theme}.png`});
  }
 }
 await page.locator('.activity-card').first().getByRole('button',{name:/Add to Trip/}).click();
 assert.equal(await page.locator('.activity-card').first().getByRole('button',{name:/Added/}).isDisabled(),true);
 await page.locator('.activity-card').nth(1).getByRole('button',{name:/Skip/}).click();assert.equal(await page.locator('.activity-card').count(),5);
 await page.locator('.activity-card').nth(3).scrollIntoViewIfNeeded();
 await page.waitForSelector('.activity-media[data-state="configuration"]');
 assert.equal(await page.locator('.activity-media[data-state="configuration"]').count(),1);
 assert.match(await page.locator('#studio-places').innerText(),/Price information unavailable/);
 assert.deepEqual(errors,[]);console.log('PASS: real-sized split panel, loaded/missing/failed photos, long names, expanded details, Add/Skip, six widths, both themes, no overlap or clipped actions.');
}finally{await browser.close();}
