// Opt-in real database + browser regression. Only isolated test accounts are deleted.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {getDatabasePool} from '../src/config/database.js';
const base=process.env.PROFILE_TEST_URL;
if(!base)throw Error('Set PROFILE_TEST_URL to the local test server.');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
const users=[];const errors=[];
try{
 const context=await browser.newContext();
 async function call(path,method='GET',body,ctx=context){const r=await ctx.request.fetch(base+path,{method,headers:{Origin:base},...(body?{data:body}:{})});return {status:r.status(),data:await r.json()};}
 async function signup(ctx){const username='sync_'+randomUUID().slice(0,8);const r=await call('/api/auth/signup','POST',{fullName:'Sync Test',username,email:username+'@example.com',password:'Temporary!Test123'},ctx);assert.equal(r.status,201);users.push(r.data.user.id);}
 await signup(context);const other=await browser.newContext();await signup(other);
 const created=await call('/api/trips/analyze','POST',{origin:'Yangon',destination:'Bangkok',startDate:'2026-12-03',endDate:'2026-12-10',adults:1,children:0,travelers:1,budget:30000,currency:'THB',tripPurpose:'culture',pace:'balanced',tripScope:'international'});
 assert.equal(created.status,201);const id=created.data.persistence.tripId;
 async function compare(){const list=(await call('/api/trips')).data.trips,profile=(await call('/api/profile')).data.profile;assert.deepEqual(profile.savedTrips,list);assert.equal(profile.inProgressTrips.length+profile.readyTrips.length,list.length);return profile;}
 let p=await compare();assert.equal(p.inProgressTrips.length,1);assert.equal(p.inProgressTrips[0].progress.percent,25);
 assert.equal((await call('/api/profile','GET',null,other)).data.profile.savedTrips.length,0);
 assert.equal((await call('/api/trips/'+id+'/workspace','GET',null,other)).status,404);
 assert.equal((await call('/api/trips/'+id,'DELETE',null,other)).status,404);
 const profilePage=await context.newPage(),tripsPage=await context.newPage();for(const page of [profilePage,tripsPage])page.on('pageerror',e=>errors.push(e.message));
 await profilePage.goto(base+'/profile');await profilePage.waitForFunction(()=>document.querySelector('#in-progress-trip-count').textContent==='1 in progress');
 assert.match(await profilePage.locator('#profile-trips').innerText(),/Bangkok.*25% planned/s);
 if(process.env.PROFILE_VISUAL_TEST){
  for(const [width,height] of [[1440,900],[1366,768],[1280,800],[768,1024],[390,844]]){
   await profilePage.setViewportSize({width,height});
   for(const theme of ['light','dark']){
    await profilePage.evaluate(theme=>PackSwift.setThemePreference(theme),theme);
    await profilePage.evaluate(()=>document.fonts.ready);
    assert.equal(await profilePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width} ${theme} overflow`);
    assert.equal(await profilePage.locator(`[data-theme-option="${theme}"]`).getAttribute('aria-pressed'),'true');
    await profilePage.screenshot({path:`/tmp/packswift-profile-${width}-${theme}.png`,fullPage:true});
   }
  }
  await profilePage.setViewportSize({width:1440,height:900});
 }
 await tripsPage.goto(base+'/trips');await tripsPage.getByRole('link',{name:'Continue Planning',exact:true}).waitFor();
 assert.match(await tripsPage.locator('#saved-trip-content').innerText(),/25% planned/);
 assert.equal(await tripsPage.getByRole('link',{name:'Edit Trip',exact:true}).getAttribute('href'),'/trip-planner?trip_id='+id);
 await tripsPage.getByRole('link',{name:'Continue Planning',exact:true}).click();await tripsPage.getByRole('heading',{name:'Your Bangkok Trip'}).waitFor();
 // Same API used by the existing edit form; it must update, not create a copy.
 await tripsPage.evaluate(async({id})=>{await PackSwift.api('/api/trips/'+id+'/details',{method:'PUT',body:JSON.stringify({fields:[{name:'origin',type:'text',value:'Mandalay'}],selected:[]})});},{id});
 await profilePage.waitForFunction(()=>document.querySelector('#profile-trips').textContent.includes('Mandalay'));
 p=await compare();assert.equal(p.savedTrips.length,1);assert.equal(p.savedTrips[0].tripId,id);
 let workspace=(await call('/api/trips/'+id+'/workspace')).data;
 async function update(change){const r=await call('/api/trips/'+id+'/workspace','PATCH',{revision:workspace.workspace.revision||0,...change});assert.equal(r.status,200);workspace=r.data;}
 for(const key of ['passport','entry','arrival','onward','accommodation','insurance'])await update({action:'requirement',key,reviewed:true});
 await update({action:'review-itinerary'});
 assert.ok(workspace.packing.length);for(const item of workspace.packing)await update({action:'packing',itemId:item.id,state:'have'});
 p=await compare();assert.equal(p.readyTrips.length,1);assert.equal(p.readyTrips[0].progress.percent,100);assert.equal(p.inProgressTrips.length,0);
 await profilePage.reload();await profilePage.waitForFunction(()=>document.querySelector('#ready-trip-count').textContent==='1 trip ready');
 await tripsPage.goto(base+'/trips');await tripsPage.waitForFunction(()=>document.querySelector('#saved-trip-content').textContent.includes('100% planned'));
 // Errors are not empty collections, and loading must not show a false zero.
 await profilePage.route('**/api/profile',async route=>{await new Promise(r=>setTimeout(r,300));await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Test database unavailable'})});});
 await profilePage.reload();await profilePage.waitForFunction(()=>document.querySelector('#profile-load-status').textContent.includes("couldn't load"));
 assert.equal(await profilePage.locator('#in-progress-trip-count').textContent(),'Unavailable');assert.equal(await profilePage.locator('#profile-trips').textContent(),'');
 await profilePage.unroute('**/api/profile');await profilePage.getByRole('button',{name:'Try again',exact:true}).click();await profilePage.waitForFunction(()=>document.querySelector('#ready-trip-count').textContent==='1 trip ready');
 await tripsPage.getByRole('button',{name:'Remove Bangkok trip',exact:true}).click();await tripsPage.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();assert.equal((await compare()).savedTrips.length,1);
 await tripsPage.getByRole('button',{name:'Remove Bangkok trip',exact:true}).click();await tripsPage.getByRole('dialog').getByRole('button',{name:'Remove Trip',exact:true}).click();
 await tripsPage.getByRole('heading',{name:'No trips planned yet'}).waitFor();await profilePage.waitForFunction(()=>document.querySelector('#ready-trip-count').textContent==='0 trips ready');
 assert.equal((await compare()).savedTrips.length,0);await profilePage.reload();await profilePage.waitForFunction(()=>document.querySelector('#in-progress-trip-count').textContent==='0 in progress');
 assert.deepEqual(errors,[]);
 console.log('PASS: create, canonical Profile/My Trips equality, ownership isolation, Continue Planning, same-ID edit, cross-tab update/delete, 25%→100% readiness, direct URLs, reload, error/retry and confirmed removal.');
}finally{await browser.close();const db=getDatabasePool();for(const userId of users){await db.execute('DELETE FROM trip_sessions WHERE user_id=?',[userId]);await db.execute('DELETE FROM users WHERE id=?',[userId]);}await db.end();}
