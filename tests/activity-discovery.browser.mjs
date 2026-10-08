import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/activity-recommendations',async route=>{const i=route.request().postDataJSON();requests.push(i);const activities=Array.from({length:49},(_,n)=>({id:'fixture-'+n,placeId:'fixture-'+n,title:(n<6?'Coastal escape ':'Cultural attraction ')+n,categories:[n<6?'beach':'culture'],matchedInterests:n<6?['beaches']:[],matchedCategories:n<6?['beach']:[],tripType:n<6?'day_trip':'in_city',suggestedStayMin:n<6?480:90,travelContext:'Test travel context',imageUrl:'/images/packswift1.jpg'}));await route.fulfill({json:{activities,demand:{tripDays:15,usableDays:13,targetPerDay:3,recommendationTarget:49},notices:[]}});});
 await page.goto((process.env.PLANNER_TEST_URL||'http://127.0.0.1:3000')+'/trip-planner?destination=Bangkok');await page.waitForSelector('.calendar-day');
 await page.locator('#origin-search').fill('Yangon');
 await page.evaluate(()=>{document.querySelector('#start-date').value='2026-12-01';document.querySelector('#end-date').value='2026-12-15';document.querySelector('#trip-planner-form').dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#studio-next').click();await page.locator('#passport-country').fill('Myanmar');await page.locator('#studio-next').click();await page.locator('#budget').fill('30000');await page.locator('#studio-next').click();await page.locator('#trip-notes').fill('beaches');await page.locator('#studio-next').click();await page.locator('#studio-find').click();await page.waitForSelector('.activity-card');
 assert.equal(requests.at(-1).notes,'beaches');assert.equal(requests.at(-1).endDate,'2026-12-15');assert.equal(await page.locator('.activity-card').count(),20);
 assert.match(await page.locator('.activity-group').first().innerText(),/MATCHED TO YOUR INTERESTS/);
 const cards=page.locator('.activity-pair').first().locator('.activity-card');const a=await cards.nth(0).boundingBox(),b=await cards.nth(1).boundingBox();assert.equal(a.width,b.width);assert.ok(Math.abs(a.y-b.y)<2);assert.ok(a.height/a.width<1.7,JSON.stringify(a));
 await page.getByRole('button',{name:/Show more activities/}).click();assert.equal(await page.locator('.activity-card').count(),40);
 await page.getByRole('button',{name:'+ Add to Trip: Coastal escape 0',exact:true}).click();await page.locator('#studio-next').click();assert.equal(await page.locator('.preference-place').count(),1);
 await page.locator('#pace').selectOption('packed');await page.waitForTimeout(700);assert.equal(requests.at(-1).pace,'packed');await page.locator('[data-step-button="4"]').click();
 await page.screenshot({path:'/tmp/packswift-activities-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});
 assert.equal(await page.locator('.activity-pair').first().evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 console.log('PASS: notes payload, demand, pagination, matched groups, paired cards, selected preferences, pace invalidation, mobile layout.');
}finally{await browser.close();}
