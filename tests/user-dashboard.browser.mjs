import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import express from 'express';
import {validateDashboardState} from '../src/services/dashboard-state.js';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const app=express();app.use(express.static(fileURLToPath(new URL('../public/',import.meta.url)),{extensions:['html']}));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base='http://127.0.0.1:'+server.address().port;
const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
let state={revision:0,currency:'THB',expenses:[],stories:[],contacts:[],entryChecks:[]},fail=false,guest=false;
const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
let packed=false,liked=true,revision=0;
const trips=[{tripId:first,details:{destination:'Bangkok',country:'Thailand',origin:'Yangon',start:day(1),end:day(5),adults:2,children:0,nights:4,currency:'THB',budget:20000,tripType:'worldwide'},progress:{sections:[]}},
 {tripId:second,details:{destination:'Tokyo',country:'Japan',origin:'Bangkok',start:'2027-04-01',end:'2027-04-05',adults:1,children:0,nights:4,currency:'JPY',budget:null},progress:{sections:[]}}];
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.origin!==base)return route.abort();if(!u.pathname.startsWith('/api/'))return route.continue();
  const path=u.pathname,method=route.request().method();let json={};
  if(path==='/api/auth/me')json={user:guest?null:{id:1,fullName:'Alex Traveler',username:'alex123',email:'alex@example.com'}};
  else if(path==='/api/profile/preferences')json={preferences:{nationality:'Myanmar',currency:'THB',wishlist:[{name:'Wat Arun',detail:'Bangkok'}],packingPresets:[]}};
  else if(path==='/api/profile/dashboard'){
    if(method==='PUT'){if(fail)return route.fulfill({status:409,json:{error:'Dashboard changed in another tab. Reload before saving.'}});const next=validateDashboardState(route.request().postDataJSON());next.revision++;state=next;}
    json={dashboard:state};
  }else if(path==='/api/trips')json={trips};
  else if(path.endsWith('/workspace')){if(method==='PATCH'){const change=route.request().postDataJSON();assert.equal(change.revision,revision);revision++;if(change.action==='packing')packed=change.state==='have';if(change.action==='activity-choice')liked=false;}json={workspace:{requirements:{},revision},packing:[{id:1,itemName:'Passport copy',completed:true},{id:2,itemName:'Umbrella',completed:packed}],likedActivities:liked?[{id:'place1',title:'Food market'}]:[],timeline:[{day:1,title:'Museum',startTime:'10:00'}]};}
  else if(path==='/api/trip-forecast')json={status:'partial',daily:[{date:day(1),lowC:24,highC:32,rainProbability:70}],coveredDays:1,totalDays:5,checkedAt:new Date().toISOString()};
  else if(path==='/api/trips/currency-rate')json={rate:34,updated:'14 Nov 2026'};
  return route.fulfill({json});
 });
 await page.goto(base+'/profile');await page.locator('#user-dashboard:not([hidden])').waitFor();
 await page.getByText('1 / 2 packing items ready',{exact:true}).waitFor();
 await page.getByText(/Partial forecast/).waitFor();await page.getByText(/Suggested wear: light layers/).waitFor();
 assert.match(await page.locator('#dashboard-trip').innerText(),/Bangkok/);
 assert.equal(await page.getByRole('link',{name:'Continue planning →',exact:true}).getAttribute('href'),'/trip-planner?trip_id='+first);
 assert.equal(await page.getByRole('link',{name:'Call Tourist police 1155',exact:true}).getAttribute('href'),'tel:1155');
 const f=page.locator('#dashboard-budget form');await f.locator('..').locator('summary').click();
 const pending=page.locator('#dashboard-experiences form');await pending.locator('..').locator('summary').click();await pending.locator('[name=title]').fill('Unfinished draft');await pending.locator('[name=body]').fill('Do not lose this note');
 await f.locator('[name=amount]').fill('250');await f.locator('[name=note]').fill('Lunch <script>bad()</script>');await f.getByRole('button',{name:'Save expense'}).click();
 await page.getByText('Saved to your account.',{exact:true}).waitFor();assert.equal(state.expenses[0].amount,250);
 assert.equal(await page.locator('#dashboard-experiences [name=title]').inputValue(),'Unfinished draft','Saving expense preserves another form');
 assert.equal(await page.locator('#dashboard-experiences [name=body]').inputValue(),'Do not lose this note');
 await page.getByRole('button',{name:'Calculate combined estimate',exact:true}).click();await page.getByText('Estimated total: THB 250.00',{exact:true}).waitFor();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save offline trip',exact:true}).click();const file=await download;const fs=await import('node:fs/promises');const offline=await fs.readFile(await file.path(),'utf8');assert.match(offline,/Museum/);assert.match(offline,/Umbrella/);assert.match(offline,/Food market/);assert.doesNotMatch(offline,/Do not lose this note/);
 await page.getByRole('checkbox',{name:'Packed Umbrella',exact:true}).check();await page.getByText('2 / 2 packing items ready',{exact:true}).waitFor();assert.equal(await page.locator('#dashboard-experiences [name=title]').inputValue(),'Unfinished draft');
 assert.match(await page.locator('#dashboard-budget').innerText(),/Lunch <script>/);
 await page.reload();await page.getByText('Lunch <script>bad()</script>',{exact:false}).waitFor();
 const entry=page.locator('#dashboard-entry form');await entry.locator('..').locator('summary').click();
 await entry.locator('[name=purpose]').fill('Tourism');await entry.locator('[name=source]').fill('https://www.thaievisa.go.th/');await entry.locator('[name=reviewed]').check();await entry.getByRole('button',{name:'Save entry check'}).click();
 await page.getByText('Reviewed by you · not travel clearance',{exact:true}).waitFor();assert.equal(state.entryChecks[0].passportCountry,'Myanmar');
 const story=page.locator('#dashboard-experiences form');await story.locator('..').locator('summary').click();await story.locator('[name=title]').fill('My first trip');await story.locator('[name=body]').fill('Use a transit card.');await story.getByRole('button',{name:'Save private draft'}).click();
 await page.getByText('My first trip · Private draft',{exact:true}).waitFor();
 await page.locator('#dashboard-trip [name=experience]').selectOption('My first trip');await page.getByText('Saved to your account.',{exact:true}).waitFor();assert.equal(state.experience,'first');
 await page.locator('#dashboard-trip [name=trip]').selectOption(second);await page.getByRole('link',{name:'Call Police 110',exact:true}).waitFor();assert.doesNotMatch(await page.locator('#dashboard-budget').innerText(),/Lunch/);
 await page.locator('#dashboard-trip [name=trip]').selectOption(first);
 fail=true;const expense=page.locator('#dashboard-budget form');await expense.locator('..').locator('summary').click();await expense.locator('[name=amount]').fill('99');await expense.getByRole('button',{name:'Save expense'}).click();await page.getByText(/Your changes have not been saved/).waitFor();assert.equal(state.expenses.length,1);assert.equal(await expense.locator('[name=amount]').inputValue(),'99');fail=false;
 await page.reload();await page.getByText('2 / 2 packing items ready',{exact:true}).waitFor();
 for(const width of [1440,768,390])for(const mode of ['light','dark']){
   await page.setViewportSize({width,height:1000});await page.evaluate(t=>PackSwift.setThemePreference(t),mode);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,width+' '+mode+' overflow');
   if(width===1440){
     await page.addStyleTag({content:'html{scroll-behavior:auto!important}*{transition:none!important;animation:none!important}'});
     await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForFunction(()=>scrollY===0);
     await page.screenshot({path:'/tmp/packswift-dashboard-'+mode+'-top.png'});
     await page.screenshot({path:'/tmp/packswift-dashboard-'+mode+'.png',fullPage:true});
   }
 }
 assert.deepEqual(errors,[]);
 guest=true;await page.reload();await page.locator('#profile-guest:not([hidden])').waitFor();assert.equal(await page.locator('#profile-content').isVisible(),false);
 console.log('Dashboard browser checks passed: account persistence, expenses, entry review, private experiences, trip isolation, failure recovery, both themes, mobile and guest gate.');
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
