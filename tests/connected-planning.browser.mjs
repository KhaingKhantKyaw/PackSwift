import assert from 'node:assert/strict';
import express from 'express';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const app=express(),publicPath=fileURLToPath(new URL('../public',import.meta.url));app.use(express.static(publicPath));app.get('/trip-planner',(req,res)=>res.sendFile(publicPath+'/trip-planner.html'));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],searches=[],saved=[];page.on('pageerror',error=>errors.push(error.message));
 const tripId='00000000-0000-4000-8000-000000000001';
 await page.route('**/api/**',async route=>{const url=new URL(route.request().url());
  if(url.pathname==='/api/auth/me')return route.fulfill({json:{user:null}});
  if(url.pathname.endsWith('/popular-activities'))return route.fulfill({json:{items:Array.from({length:10},(_,i)=>({id:'place-'+i,name:'Cooking experience '+i,rating:4.8,ratingCount:100,imageAuthors:[]})),nextPageToken:null}});
  if(url.pathname.startsWith('/api/places/place-')){const id=url.pathname.split('/').pop();return route.fulfill({json:{id,placeId:id,providerPlaceId:id,provider:'google',source:'user_search',title:'Cooking experience '+id.split('-')[1],tripType:'in_city',coordinates:{latitude:13.7,longitude:100.5}}});}
  if(url.pathname.startsWith('/api/booking-search/')){searches.push(route.request().postDataJSON());return route.fulfill({json:{items:[{title:url.pathname.endsWith('/flights')?'Test airline':'Test hotel',detail:'Test result',price:'USD 100',priceLabel:'Test only',url:'https://example.com/book'}],source:'Test provider',searchedAt:new Date().toISOString()}});}
  if(url.pathname==='/api/trip-forecast')return route.fulfill({json:{status:'partial',coveredDays:1,totalDays:6,checkedAt:new Date().toISOString(),daily:[{date:'2027-01-01',lowC:8,highC:20,rainProbability:70}]}});
  if(url.pathname==='/api/v1/trips/live-review')return route.fulfill({json:{itinerary:[]}});
  if(url.pathname==='/api/trips/draft'){saved.push(route.request().postDataJSON());return route.fulfill({json:{saved:true,tripId,budgetStatus:'unfinished'}});}
  if(url.pathname.startsWith('/api/places'))return route.fulfill({json:[]});
  return route.fulfill({json:{}});
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/trip-planner');await page.waitForSelector('.planner-horizontal');await page.waitForTimeout(300);
 const set=async(name,value)=>page.evaluate(({name,value})=>{const field=document.querySelector('[name="'+name+'"]');field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));},{name,value});
 for(const [name,value]of Object.entries({origin:'Yangon',destination:'Bangkok',startDate:'2027-01-01',endDate:'2027-01-06',adults:'2',children:'1',travelPurposes:'["Food, Drink & Culinary"]',travelStyle:'Balanced'}))await set(name,value);
 await page.locator('.traveler-child-ages select').selectOption('0');assert.equal(await page.locator('#traveler-child-ages').inputValue(),'[0]');
 assert.equal(await page.locator('.trip-comfort-controls').isVisible(),true);await page.locator('.trip-comfort-controls #pace').selectOption('relaxed');
 const activities=page.locator('[data-preview-section="Activities"]'),itinerary=page.locator('[data-preview-section="Itinerary"]');
 await activities.getByRole('button',{name:'Interested in Cooking experience 0',exact:true}).click();
 const shortlist=itinerary.locator('.itinerary-shortlist-row').filter({hasText:'Cooking experience 0'});await shortlist.waitFor();
 assert.equal(await page.locator('.selected-thumbnails figure').count(),0,'Like alone never schedules a stop');
 await shortlist.locator('select').selectOption('2');await shortlist.getByRole('button',{name:'Add to day'}).click();await page.waitForFunction(()=>document.querySelectorAll('.selected-thumbnails figure').length===1);
 assert.equal(await page.evaluate(()=>JSON.parse(document.getElementById('itinerary-preferences-state').value).activityPreferences[0].preferredDay),2);
 await activities.getByRole('button',{name:'Interested in Cooking experience 1',exact:true}).click();await activities.getByRole('button',{name:'Not interested in Cooking experience 1',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.itinerary-shortlist')?.textContent.includes('Cooking experience 1'));
 const stay=page.locator('.booking-embedded').filter({has:page.getByRole('button',{name:'Search stays',exact:true})});
 await stay.getByRole('button',{name:'Search stays',exact:true}).click();await stay.getByText('Test hotel',{exact:true}).waitFor();assert.deepEqual(searches.at(-1).childAges,[0]);
 await page.locator('.traveler-child-ages select').selectOption('5');assert.equal(await stay.getByText('Test hotel',{exact:true}).count(),0,'Age changes invalidate displayed results');
 await stay.locator('input[type="text"]').fill('Central market');await stay.getByRole('button',{name:'Search stays',exact:true}).click();await stay.getByText('Test hotel',{exact:true}).waitFor();assert.equal(searches.at(-1).stayNear,'Central market');
 await stay.locator('input[type="text"]').fill('Riverside');assert.equal(await stay.getByText('Test hotel',{exact:true}).count(),0,'Area changes clear stale results immediately');
 const packing=page.locator('[data-preview-section="Packing List"]');await page.waitForFunction(()=>document.getElementById('packing-snapshot')?.value.includes('Warm outer layer'));assert.match(await packing.innerText(),/per traveler/i);
 for(const width of [1600,1100,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'No page overflow at '+width);const cards=page.locator('#studio-dashboard-content>.reference-preview-card:visible');const a=await cards.nth(0).boundingBox(),b=await cards.nth(1).boundingBox();if(width===390)assert.ok(b.y>=a.y+a.height-1);else assert.ok(Math.abs(a.y-b.y)<2);}
 await page.setViewportSize({width:1100,height:1000});await activities.getByRole('button',{name:'Expand Activities'}).click();assert.equal(await page.locator('#studio-dashboard-content>.reference-preview-card:visible').count(),1);await activities.getByRole('button',{name:'Expand Activities'}).press('Escape');assert.equal(await page.locator('#studio-dashboard-content>.reference-preview-card:visible').count(),4);
 await page.evaluate(()=>{PackSwift.authReady=Promise.resolve({id:7});document.getElementById('studio-save').click();});await page.waitForFunction(()=>document.getElementById('studio-save-status').textContent.includes('Draft saved'));assert.equal(saved.length,1);assert.ok(saved[0].fields.some(f=>f.name==='stayNearPreferences'&&f.value.includes('Riverside')));assert.ok(saved[0].fields.some(f=>f.name==='packingSnapshot'));
 for(const theme of ['dark','light']){await page.evaluate(value=>PackSwift.setThemePreference(value),theme);assert.equal(await page.locator('html').getAttribute('data-theme'),theme);}
 assert.deepEqual(errors,[]);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'/tmp/packswift-connected-planning.png',fullPage:true});console.log('PASS: shared shortlist/day assignment, dislikes, child ages, stay-area invalidation, forecast packing, responsive panels, expand, unfinished draft save');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
