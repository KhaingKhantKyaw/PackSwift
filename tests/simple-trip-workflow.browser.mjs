import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import express from 'express';
import {pageRouter} from '../src/routes/pages.js';
import {validateDashboardState} from '../src/services/dashboard-state.js';
import {validateWorkspaceChange} from '../src/services/trip-workspace.js';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const app=express();app.use(express.static(fileURLToPath(new URL('../public/',import.meta.url)),{extensions:['html']}));app.use(pageRouter);
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
const id='11111111-1111-4111-8111-111111111111',day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
const details={destination:'Bangkok',country:'Thailand',origin:'Yangon',start:day(1),end:day(5),adults:2,children:0,nights:4,currency:'THB',budget:20000,tripType:'worldwide'};
let state={revision:0,currency:'THB',expenses:[],stories:[],contacts:[],entryChecks:[]},revision=0,guest=false,fail=false,discard=true;
let timeline=[{id:10,day:1,title:'Museum',startTime:'10:00'}],packed=false,liked=true;
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>discard?d.accept():d.dismiss());
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.origin!==base)return route.abort();if(!u.pathname.startsWith('/api/'))return route.continue();
  const path=u.pathname,method=route.request().method();let json={};
  if(path==='/api/auth/me')json={user:guest?null:{id:1,fullName:'Alex Traveler',username:'alex123',email:'alex@example.com'}};
  else if(path==='/api/profile/preferences')json={preferences:{nationality:'Myanmar',currency:'THB',wishlist:[],packingPresets:[]}};
  else if(path==='/api/profile/dashboard'){if(method==='PUT'){if(fail)return route.fulfill({status:409,json:{error:'Changed in another tab.'}});state=validateDashboardState(route.request().postDataJSON());state.revision++;}json={dashboard:state};}
  else if(path==='/api/trips')json={trips:[{tripId:id,details,progress:{sections:[]}}]};
  else if(path.endsWith('/workspace')){
   if(method==='PATCH'){const c=validateWorkspaceChange(route.request().postDataJSON());assert.equal(c.revision,revision);revision++;
    if(c.action==='packing')packed=c.state==='have';
    if(c.action==='activity-choice')liked=false;
    if(c.action==='costs'){details.budgetBreakdown=c.costs;details.budget=c.costs.flights+c.costs.stay+c.costs.daily*5;}
    if(c.action==='itinerary')timeline=c.items.map((v,i)=>({...v,id:v.id||20+i}));
   }
   json={details,workspace:{requirements:{},revision},timeline,packing:[{id:1,itemName:'Passport copy',completed:true},{id:2,itemName:'Umbrella',completed:packed}],likedActivities:liked?[{id:'place1',title:'Food market'}]:[]};
  }else if(path==='/api/trip-forecast')json={status:'partial',daily:[{date:day(1),lowC:24,highC:32,rainProbability:70}],coveredDays:1,totalDays:5,checkedAt:new Date().toISOString()};
  else if(path==='/api/trips/currency-rate')json={rate:34,updated:'14 Nov 2026'};
  return route.fulfill({json});
 });
 const tab=async name=>{await page.locator('#trip-hub-nav').getByRole('link',{name,exact:true}).click();await page.locator('#trip-hub-nav a[aria-current=page]').filter({hasText:name}).waitFor();};
 await page.goto(base+'/profile');await page.locator('#user-dashboard:not([hidden])').waitFor();
 assert.equal(await page.locator('#dashboard-budget').count(),0);assert.equal(await page.locator('#dashboard-packing').count(),0);
 await page.getByRole('link',{name:'Open trip',exact:true}).click();await page.locator('#trip-hub-title').getByText('Bangkok',{exact:true}).waitFor();
 assert.equal(await page.locator('#trip-hub-nav a').count(),5);assert.equal(await page.getByRole('link',{name:'Open saved trip',exact:true}).count(),0);
 await tab('Budget');const expense=page.locator('#dashboard-budget form').last();await expense.locator('..').locator('summary').click();await expense.locator('[name=amount]').fill('200');await expense.locator('[name=note]').fill('Unfinished lunch');
 const costs=page.locator('form[data-form-key="Edit planned costs"]');await costs.locator('..').locator('summary').click();await costs.locator('[name=flights]').fill('1000');await costs.locator('[name=stay]').fill('2000');await costs.locator('[name=daily]').fill('300');await costs.getByRole('button',{name:'Save planned costs'}).click();
 await page.getByText('THB 4,500.00',{exact:true}).waitFor();assert.equal(await expense.locator('[name=note]').inputValue(),'Unfinished lunch');
 await expense.getByRole('button',{name:'Save expense'}).click();await page.getByText('Saved to your account.',{exact:true}).waitFor();assert.equal(state.expenses[0].amount,200);
 await page.getByRole('button',{name:'Calculate combined estimate'}).click();await page.getByText('Estimated total: THB 200.00',{exact:true}).waitFor();
 await expense.locator('..').locator('summary').click();await expense.locator('[name=amount]').fill('999');
 discard=false;await tabAttempt();assert.equal(new URL(page.url()).searchParams.get('tab'),'budget');assert.equal(await expense.locator('[name=amount]').inputValue(),'999');discard=true;
 await tab('Itinerary');const editor=page.locator('form[aria-label="Edit Museum"]');await editor.locator('..').locator('summary').click();await editor.locator('[name=name]').fill('Museum & coffee');await editor.locator('[name=startTime]').fill('11:30');await editor.getByRole('button',{name:'Save changes',exact:true}).click();
 await page.getByText('Museum & coffee',{exact:true}).waitFor();assert.equal(timeline[0].startTime,'11:30');assert.equal(new URL(page.url()).pathname,'/trips/'+id);
 await page.getByRole('button',{name:'Remove interest',exact:true}).click();await page.getByText('No liked activities yet.',{exact:true}).waitFor();assert.equal(liked,false);
 await tab('Packing');await page.getByRole('checkbox',{name:'Packed Umbrella',exact:true}).check();await page.getByText('2 / 2 packed',{exact:true}).waitFor();
 await tab('Help');await page.getByText(/Partial forecast/).waitFor();await page.getByRole('link',{name:'Call Tourist police 1155',exact:true}).waitFor();
 const entry=page.locator('#dashboard-entry form');await entry.locator('..').locator('summary').click();await entry.locator('[name=purpose]').fill('Tourism');await entry.locator('[name=source]').fill('https://www.thaievisa.go.th/');await entry.locator('[name=reviewed]').check();await entry.getByRole('button',{name:'Save entry check'}).click();await page.getByText('Reviewed by you · not travel clearance',{exact:true}).waitFor();
 await tab('Overview');await page.getByText('Trip notes & experiences',{exact:true}).click();const story=page.locator('#dashboard-experiences form');await story.locator('..').locator('summary').click();await story.locator('[name=title]').fill('First trip tips');await story.locator('[name=body]').fill('Private note');await story.getByRole('button',{name:'Save private draft'}).click();await page.getByText('First trip tips · Private draft',{exact:true}).waitFor();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save offline trip'}).click();const file=await download,{readFile}=await import('node:fs/promises');const text=await readFile(await file.path(),'utf8');assert.match(text,/Museum & coffee/);assert.match(text,/Umbrella/);assert.doesNotMatch(text,/Private note/);
 await page.reload();await page.locator('#trip-hub-nav').waitFor();await tab('Budget');assert.equal(state.expenses.length,1);
 for(const width of [1440,390])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.evaluate(t=>PackSwift.setThemePreference(t),theme);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const ratios=await page.evaluate(()=>{
    const rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number),lum=s=>{const v=rgb(s).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];},contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
    const label=document.querySelector('form[data-form-key=converter] label'),input=label.querySelector('input'),button=document.querySelector('form[data-form-key=converter] button');
    return [contrast(getComputedStyle(label).color,getComputedStyle(document.body).backgroundColor),contrast(getComputedStyle(input).color,getComputedStyle(input).backgroundColor),contrast(getComputedStyle(button).color,getComputedStyle(button).backgroundColor)];
  });assert.ok(ratios.every(r=>r>=4.5),theme+' workspace label/control contrast');
  await page.screenshot({path:'/tmp/packswift-simple-trip-'+width+'-'+theme+'.png'});
 }
 await page.goto(base+'/trips/'+id+'/packing');await page.getByText('2 / 2 packed',{exact:true}).waitFor();assert.equal(new URL(page.url()).searchParams.get('tab'),'packing');
 await page.goto(base+'/trips');await page.locator('#dashboard-trips').waitFor();assert.equal(new URL(page.url()).pathname,'/profile');
 guest=true;await page.goto(base+'/trips/'+id);await page.getByRole('link',{name:'Sign in to open this trip'}).waitFor();
 assert.deepEqual(errors,[]);console.log('Simple trip workflow passed: compact dashboard, one workspace, five tabs, costs, inline itinerary edits, packing, help, private notes, preserved drafts, offline export, legacy links, guest handling and both themes/mobile.');
 async function tabAttempt(){await page.locator('#trip-hub-nav').getByRole('link',{name:'Itinerary',exact:true}).click();}
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
