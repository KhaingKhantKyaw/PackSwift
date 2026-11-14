import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 let release,requested=false;
 const item=n=>({id:'activity-'+n,name:n>6?'A very long cooking experience name with many words that wraps across several lines in a narrow card':'Food market '+n,purpose:'Food, Drink & Culinary',rating:4.8,ratingCount:100,imageUrl:'',imageAuthors:n>6?[{name:'A very long photographer attribution',url:'https://example.com/one'},{name:'A second photographer',url:'https://example.com/two'}]:[]});
 await page.route('**/api/places/**',async route=>{
  const q=new URL(route.request().url()).searchParams;
  if(!route.request().url().includes('/popular-activities'))return route.fulfill({json:[]});
  if(!q.get('pageToken'))return route.fulfill({json:{items:Array.from({length:6},(_,i)=>item(i+1)),nextPageToken:'7'}});
  requested=true;await new Promise(resolve=>release=resolve);const n=Number(q.get('pageToken'));
  return route.fulfill({json:{items:[item(n)],nextPageToken:String(n+1)}});
 });
 await page.route('**/api/v1/trips/live-review',route=>route.fulfill({json:{itinerary:[]}}));
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:3000')+'/trip-planner');
 await page.waitForSelector('.planner-horizontal');
 await page.evaluate(()=>{
  for(const [name,value]of [['destination','Hanoi'],['travelPurposes',JSON.stringify(['Food, Drink & Culinary'])],['travelStyle','Balanced']]){
   const input=document.querySelector(`[name="${name}"]`);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
  }
 });
 const panel=page.locator('[data-preview-section="Activities"]');
 await panel.locator('[data-activity-id="activity-4"]').waitFor();
 const target=panel.locator('[data-activity-id="activity-4"]'),button=target.locator('[data-vote="down"]');
 await button.scrollIntoViewIfNeeded();
 const box=await target.boundingBox(),buttonBox=await button.boundingBox();
 const scroll=await panel.evaluate(e=>({top:e.scrollTop,pageY:window.scrollY}));
 const nextBox=await panel.locator('[data-activity-id="activity-5"]').boundingBox();
 // Real pointer input, not programmatic click. Slow provider response leaves a stable slot.
 await page.mouse.click(buttonBox.x+buttonBox.width/2,buttonBox.y+buttonBox.height/2);
 await target.locator('.activity-replacement-status').waitFor();assert.equal(requested,true);
 assert.ok(Math.abs((await target.boundingBox()).height-box.height)<=1);
 assert.ok(Math.abs((await panel.evaluate(e=>e.scrollTop))-scroll.top)<=1);
 release();await panel.locator('[data-activity-id="activity-7"]').waitFor();await page.waitForTimeout(220);
 const replacement=panel.locator('[data-activity-id="activity-7"]'),newBox=await replacement.boundingBox(),newButtonBox=await replacement.locator('[data-vote="down"]').boundingBox();
 assert.ok(Math.abs(newBox.y-box.y)<=1,`Replacement top remains in place: ${JSON.stringify({before:box,after:newBox,scroll,now:await panel.evaluate(e=>({top:e.scrollTop,pageY:window.scrollY}))})}`);
 assert.ok(Math.abs(newBox.height-box.height)<=1,'Long title and credits do not change slot height');
 assert.ok(Math.abs(newButtonBox.y-buttonBox.y)<=1,'Action stays under the pointer');
 assert.ok(Math.abs((await panel.locator('[data-activity-id="activity-5"]').boundingBox()).y-nextBox.y)<=1,'Following card does not move');
 assert.deepEqual(await panel.evaluate(e=>({top:e.scrollTop,pageY:window.scrollY})),scroll);
 // User moves focus while the next replacement is loading: leave it where they put it.
 requested=false;await replacement.locator('[data-vote="down"]').click();await replacement.locator('.activity-replacement-status').waitFor();
 await page.evaluate(()=>document.getElementById('destination-search').focus({preventScroll:true}));
 assert.equal(requested,true);release();await panel.locator('[data-activity-id="activity-8"]').waitFor();
 assert.equal(await page.evaluate(()=>document.activeElement.id),'destination-search');
 // Reduced motion still completes the replacement without an animation dependency.
 await page.emulateMedia({reducedMotion:'reduce'});
 const reduced=panel.locator('[data-activity-id="activity-8"]');await reduced.locator('[data-vote="down"]').click();await reduced.locator('.activity-replacement-status').waitFor();release();await panel.locator('[data-activity-id="activity-9"]').waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: stable scroll, pointer target and neighbours; delayed replacements, long text, focus handoff and reduced motion');
}finally{await browser.close();}
