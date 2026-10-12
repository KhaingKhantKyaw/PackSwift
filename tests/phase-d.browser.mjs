import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {getDatabasePool} from '../src/config/database.js';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QA_TEST_URL||'http://127.0.0.1:3000';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});let userId;
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'America/Los_Angeles',reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));const username='phased_'+randomUUID().slice(0,8);
 const r=await context.request.post(base+'/api/auth/signup',{data:{fullName:'Phase D QA',username,email:username+'@example.com',password:'Temporary!Test123'}});assert.equal(r.status(),201);userId=(await r.json()).user.id;
 await page.goto(base+'/trip-planner?destination=Bangkok');await page.waitForSelector('#trip-planner-form[aria-busy="false"]');
 for(let n=0;n<18&&!await page.locator('[data-date="2026-12-03"]').count();n++)await page.getByRole('button',{name:'Next month',exact:true}).click();
 await page.locator('[data-date="2026-12-03"]').click();await page.locator('[data-date="2026-12-10"]').click();await page.locator('#studio-next').click();await page.locator('#studio-next').click();
 await page.getByText('Stay & travel details · optional',{exact:true}).click();
 await page.locator('[name="hotelName"]').fill('Grand Hyatt Erawan Bangkok');await page.getByRole('button',{name:'Find hotel location',exact:true}).click();await page.getByRole('button',{name:/Grand Hyatt Erawan Bangkok ·/}).first().click();await page.waitForFunction(()=>document.querySelector('[name="hotelLatitude"]').value!=='');
 for(const [name,value]of Object.entries({hotelName:'QA stay',hotelAddress:'User entered test address',hotelLatitude:'13.75',hotelLongitude:'100.49',arrivalAt:'2026-12-03T15:00',departureAt:'2026-12-10T10:00',arrivalTimezone:'Asia/Bangkok',departureTimezone:'Asia/Bangkok',hotelCheckIn:'2026-12-03T17:00'}))await page.locator(`[name="${name}"]`).fill(value);
 await page.locator('[name="travelMode"]').selectOption('public_transport');
 for(const title of ['Visit A','Free time']){await page.getByPlaceholder('e.g. Free time').fill(title);await page.getByRole('button',{name:'Add custom stop',exact:true}).click();await page.getByLabel('Day for '+title,{exact:true}).selectOption('3');await page.getByLabel('Time for '+title,{exact:true}).fill('10:00');await page.getByLabel('Visit duration for '+title,{exact:true}).fill('120');await page.getByLabel('Visit duration for '+title,{exact:true}).press('Tab');await page.locator('.stage-stop').filter({has:page.getByRole('heading',{name:title,exact:true})}).getByRole('button',{name:'Lock day & time',exact:true}).click();}
 await page.getByLabel('Priority for Visit A',{exact:true}).selectOption('must_visit');
 await page.getByRole('button',{name:'Suggest a Better Schedule',exact:true}).click();assert.ok(await page.getByRole('dialog').isVisible());assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Cancel');await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByRole('button',{name:'Suggest a Better Schedule',exact:true}).click();await page.getByRole('button',{name:'Apply suggestion',exact:true}).click();assert.equal(await page.getByLabel('Day for Visit A',{exact:true}).inputValue(),'3');assert.equal(await page.getByLabel('Time for Visit A',{exact:true}).inputValue(),'10:00');assert.equal(await page.getByLabel('Visit duration for Visit A',{exact:true}).inputValue(),'120');
 await page.getByRole('button',{name:'Undo suggestion',exact:true}).click();
 assert.ok((await page.locator('.stage-warnings').allTextContents()).join(' ').includes('Blocking conflict'));
 for(const [width,height]of [[1440,900],[1366,768],[1280,800],[1024,768],[768,1024],[390,844],[375,812]]){await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+width);assert.ok(await page.getByLabel('Visit duration for Visit A',{exact:true}).isVisible());}
 await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'/tmp/packswift-phase-d.png'});
 await page.locator('#studio-next').click();await page.waitForURL(/\/trips\/[a-f0-9-]+$/,{timeout:60000});const id=page.url().split('/').at(-1);
 let ws=await (await context.request.get(base+'/api/trips/'+id+'/workspace')).json();assert.equal(ws.details.start,'2026-12-03');assert.equal(ws.itineraryPreferences.arrivalAt,'2026-12-03T15:00');assert.equal(ws.itineraryPreferences.accommodation.latitude,13.75);assert.equal(ws.itineraryPreferences.travelMode,'public_transport');assert.ok(ws.itineraryWarnings.some(w=>w.code==='OVERLAP'&&w.severity==='BLOCKING'));
 const a=ws.itinerary.items.find(i=>i.priority==='must_visit');assert.equal(a.day,3);assert.equal(a.startTime,'10:00');assert.equal(a.durationMin,120);assert.equal(a.durationSource,'USER');assert.equal(a.locked,true);
 // Backend legacy regeneration must also honor locks, even if invoked directly.
 const regenerated=await context.request.patch(base+'/api/trips/'+id+'/workspace',{data:{action:'regenerate',revision:ws.workspace.revision}});assert.equal(regenerated.status(),200);ws=await regenerated.json();assert.equal(ws.itinerary.items.find(i=>i.id===a.id).startTime,'10:00');
 await page.goto(base+'/trips');await page.locator(`a[href="/trips/${id}"]`).first().click();await page.goto(base+'/trip-planner?trip_id='+id+'&step=itinerary-preferences');await page.waitForSelector('#trip-planner-form[aria-busy="false"]');assert.equal(await page.getByLabel('Time for Visit A',{exact:true}).inputValue(),'10:00');assert.equal(await page.locator('[name="hotelAddress"]').inputValue(),'User entered test address');assert.equal(await page.locator('[name="arrivalTimezone"]').inputValue(),'Asia/Bangkok');assert.deepEqual(errors,[]);
 console.log('PASS Phase D: local dates in another timezone; context save/restore; locks/duration/priority; overlap warning; confirmation Escape/focus; undo; seven widths; backend regeneration; My Trips; clean console');
}finally{await browser.close();const db=getDatabasePool();if(userId){await db.execute('DELETE FROM trip_sessions WHERE user_id=?',[userId]);await db.execute('DELETE FROM users WHERE id=?',[userId]);}await db.end();}
