// Uses one isolated account; cleanup never touches real users or trips.
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {getDatabasePool} from '../src/config/database.js';
const base=process.env.PLANNER_TEST_URL||'http://127.0.0.1:3211';let userId,cookie;
async function call(path,method='GET',body){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie||''},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json(),cookie:r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};}
try{
 const name='places_'+randomUUID().slice(0,8),u=await call('/api/auth/signup','POST',{fullName:'Place Search Test',username:name,email:name+'@example.com',password:'Temporary!Test123'});assert.equal(u.status,201);userId=u.data.user.id;cookie=u.cookie;
 const search=await call('/api/places/search?q=Hua%20Hin%20Beach&destination=Bangkok');assert.equal(search.status,200);assert.ok(search.data.length);
 const place=await call('/api/places/'+search.data[0].id+'?destination=Bangkok');assert.equal(place.status,200);assert.equal(place.data.tripType,'day_trip');
 const trip=await call('/api/trips/analyze','POST',{origin:'Yangon',destination:'Bangkok',startDate:'2026-12-01',endDate:'2026-12-15',adults:1,children:0,travelers:1,budget:30000,currency:'THB',tripPurpose:'culture',pace:'balanced',tripScope:'anywhere'});assert.equal(trip.status,201);const id=trip.data.persistence.tripId;
 const fields=Object.entries({origin:'Yangon',destination:'Bangkok',startDate:'2026-12-01',endDate:'2026-12-15',budget:'30000',currency:'THB',adults:'1',children:'0'}).map(([name,value])=>({name,value,type:'text'}));
 const itineraryPreferences={planningMode:'collaborative',tripPace:'balanced',activityPreferences:[{activityId:place.data.id,preferredDay:5,priority:'must_visit',preferredTimePeriod:'any'}]};
 assert.equal((await call('/api/trips/'+id+'/details','PUT',{fields,selected:[place.data],itineraryPreferences})).status,200);
 const stored=await call('/api/trips/'+id);const p=stored.data.trip.preferences.detailPlanning.selected[0];assert.equal(p.providerPlaceId,place.data.id);assert.equal(p.title,'Saved place');assert.equal(p.rating,undefined);assert.equal(p.coordinates,undefined);
 const workspace=await call('/api/trips/'+id+'/workspace');assert.equal(workspace.status,200);const day=workspace.data.selectedSchedule.days[4];assert.equal(day.activities[0].providerPlaceId,place.data.id);assert.equal(day.activities[0].priority,'must_visit');assert.equal(day.activities[0].planningBlocks.length,4);
 console.log('PASS: real place → owned trip save → reference-only DB → refresh → Day 5 schedule.');
}finally{const db=getDatabasePool();if(userId){await db.execute('DELETE FROM trip_sessions WHERE user_id=?',[userId]);await db.execute('DELETE FROM users WHERE id=?',[userId]);}await db.end();}
