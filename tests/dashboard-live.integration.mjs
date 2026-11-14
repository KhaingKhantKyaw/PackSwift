// Explicitly local only. Creates one disposable test identity; never uses a real user's login.
import '../src/config/load-env.js';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {getDatabasePool} from '../src/config/database.js';
const base=process.env.DASHBOARD_TEST_URL;
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base||''))throw Error('Set DASHBOARD_TEST_URL to an explicitly local server.');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH}),db=getDatabasePool();
const username='dash'+randomUUID().replaceAll('-','').slice(0,14),password='Temporary!Test123';
let id;
try {
 const context=await browser.newContext();
 const call=(ctx,path,method='GET',data)=>ctx.request.fetch(base+path,{method,headers:{Origin:base},...(data?{data}:{})});
 const created=await call(context,'/api/auth/signup','POST',{fullName:'Dashboard Test',username,email:username+'@example.com',password});
 assert.equal(created.status(),201,'Local test signup must succeed');
 id=(await created.json()).user.id;
 const initial=await call(context,'/api/profile/dashboard');assert.equal(initial.status(),200);
 const body=(await initial.json()).dashboard;
 const response=await call(context,'/api/profile/dashboard','PUT',{...body,currency:'JPY',experience:'first'});assert.equal(response.status(),200);
 const independent=await browser.newContext();
 const login=await call(independent,'/api/auth/login','POST',{identity:username,password});assert.equal(login.status(),200);
 const restored=await call(independent,'/api/profile/dashboard');const saved=(await restored.json()).dashboard;
 assert.equal(saved.currency,'JPY');assert.equal(saved.experience,'first');assert.equal(saved.revision,1);
 const page=await independent.newPage();await page.goto(base+'/profile');await page.locator('#user-dashboard:not([hidden])').waitFor();await page.getByRole('link',{name:'Plan my first trip',exact:true}).waitFor();
 const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
 const values={origin:'Yangon',destination:'Bangkok',startDate:day(30),endDate:day(34),adults:'1',children:'0',currency:'THB',
  packingSnapshot:JSON.stringify([{id:'test-umbrella',name:'Test umbrella',category:'Weather',quantity:1,packed:false}]),
  activityChoices:JSON.stringify({version:1,destinations:[{destination:'Bangkok',updatedAt:Date.now(),choices:[{id:'test-market',title:'Test market',vote:'up'}]}]})};
 const createdTrip=await call(context,'/api/trips/draft','POST',{fields:Object.entries(values).map(([name,value])=>({name,value,type:'text'})),selected:[]});assert.equal(createdTrip.status(),201);
 const tripId=(await createdTrip.json()).tripId;
 const workspacePath='/api/trips/'+tripId+'/workspace?hydrate=0';
 let trip=await (await call(context,workspacePath)).json();assert.equal(trip.likedActivities[0].title,'Test market');
 const packed=await call(context,workspacePath,'PATCH',{action:'packing',itemId:trip.packing[0].id,state:'have',revision:trip.workspace.revision});assert.equal(packed.status(),200);trip=await packed.json();assert.equal(trip.packing[0].completed,true);
 const removed=await call(context,workspacePath,'PATCH',{action:'activity-choice',id:'test-market',revision:trip.workspace.revision});assert.equal(removed.status(),200);assert.equal((await removed.json()).likedActivities.length,0);
 trip=await (await call(context,workspacePath)).json();
 const costs=await call(context,workspacePath,'PATCH',{action:'costs',costs:{flights:1000,stay:2000,daily:300},revision:trip.workspace.revision});assert.equal(costs.status(),200);trip=await costs.json();assert.equal(trip.details.budget,4500);
 const itinerary=await call(context,workspacePath,'PATCH',{action:'itinerary',items:[{day:1,title:'Custom museum visit',startTime:'10:00'}],revision:trip.workspace.revision});assert.equal(itinerary.status(),200);trip=await itinerary.json();assert.equal(trip.timeline[0].title,'Custom museum visit');
 const addPacking=await call(context,workspacePath,'PATCH',{action:'packing-add',name:'Personal charger',category:'Electronics',quantity:1,revision:trip.workspace.revision});assert.equal(addPacking.status(),200);trip=await addPacking.json();const charger=trip.packing.find(p=>p.itemName==='Personal charger');assert.ok(charger);
 const editPacking=await call(context,workspacePath,'PATCH',{action:'packing-edit',itemId:charger.id,name:'Personal charger',category:'Electronics',quantity:2,revision:trip.workspace.revision});assert.equal(editPacking.status(),200);trip=await editPacking.json();assert.equal(trip.packing.find(p=>p.id===charger.id).quantity,2);
 const removePacking=await call(context,workspacePath,'PATCH',{action:'packing-remove',itemId:charger.id,revision:trip.workspace.revision});assert.equal(removePacking.status(),200);assert.ok(!(await removePacking.json()).packing.some(p=>p.id===charger.id));
 await page.goto(base+'/trips/'+tripId+'?tab=itinerary');await page.getByText('Custom museum visit',{exact:true}).waitFor();await page.locator('#trip-hub-nav').getByRole('link',{name:'Budget',exact:true}).click();await page.getByText('THB 4,500.00',{exact:true}).waitFor();
 const guest=await browser.newContext();assert.equal((await call(guest,'/api/profile/dashboard')).status(),401);
 const [rows]=await db.execute('SELECT preferences FROM user_profile_preferences WHERE user_id=?',[id]);
 const prefs=typeof rows[0].preferences==='string'?JSON.parse(rows[0].preferences):rows[0].preferences;assert.equal(prefs.dashboard.currency,'JPY');
 console.log('Real local account/database verification passed: independent login, trip workspace, saved costs and itinerary, packing add/edit/remove/progress, interests and guest denial.');
} finally {
 await browser.close();
 if(id){await db.execute('DELETE FROM trip_sessions WHERE user_id=?',[id]);await db.execute('DELETE FROM user_profile_preferences WHERE user_id=?',[id]);await db.execute('DELETE FROM users WHERE id=? AND username=?',[id,username]);}
 await db.end();
}
