// Opt-in local DB verification. Creates isolated users and removes only those users afterwards.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {getDatabasePool} from '../src/config/database.js';
const base=process.env.PHASE1_TEST_URL;
if(!base)throw Error('Set PHASE1_TEST_URL to the local test server.');
const created=[];
async function call(path,{cookie='',method='GET',body}={}){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};}
try{
 const name='phase1_'+randomUUID().slice(0,8);
 const user=await call('/api/auth/signup',{method:'POST',body:{fullName:'Phase One Test',username:name,email:name+'@example.com',password:'Temporary!Test123'}});assert.equal(user.status,201);created.push(user.data.user.id);
 const other=await call('/api/auth/signup',{method:'POST',body:{fullName:'Other Test',username:name+'_b',email:name+'_b@example.com',password:'Temporary!Test123'}});assert.equal(other.status,201);created.push(other.data.user.id);
 const fields=[{id:'destination-search',name:'destination',type:'text',value:'Bangkok'},{id:'passport-country',name:'passportCountry',type:'text',value:'Myanmar'},{id:'budget',name:'budget',type:'number',value:'28400'}];
 const draft=await call('/api/trip-drafts',{method:'POST',body:{action:'board',payload:{fields}}});assert.equal(draft.status,201);
 const restored=await call('/api/trip-drafts/restore',{method:'POST',cookie:user.cookie+'; '+draft.cookie});assert.deepEqual(restored.data.payload.fields,fields);
 const saved=await call('/api/trips/analyze',{method:'POST',cookie:user.cookie,body:{origin:'Yangon',destination:'Bangkok',startDate:'2026-12-16',endDate:'2027-01-03',adults:1,children:0,travelers:1,budget:28400,currency:'THB',tripPurpose:'culture',pace:'balanced',tripScope:'international'}});assert.equal(saved.status,201,JSON.stringify(saved.data));assert.equal(saved.data.persistence.saved,true);const id=saved.data.persistence.tripId;
 assert.equal((await call(`/api/trips/${id}/details`,{method:'PUT',cookie:user.cookie,body:{fields,selected:[],rejected:[]}})).status,200);
 let s=await call(`/api/trips/${id}/workspace`,{cookie:user.cookie});assert.equal(s.status,200);assert.equal(s.data.details.nights,18);assert.equal(s.data.details.nationality,'Myanmar');assert.equal(s.data.details.budget,28400);
 assert.equal((await call(`/api/trips/${id}/workspace`)).status,401);
 assert.equal((await call(`/api/trips/${id}/workspace`,{cookie:other.cookie})).status,404);
 const update=async body=>{const r=await call(`/api/trips/${id}/workspace`,{method:'PATCH',cookie:user.cookie,body:{revision:s.data.workspace.revision||0,...body}});assert.equal(r.status,200,JSON.stringify(r.data));s=r;};
 await update({action:'requirement',key:'passport',reviewed:true});
 assert.equal((await call(`/api/trips/${id}/workspace`,{method:'PATCH',cookie:user.cookie,body:{revision:0,action:'requirement',key:'entry',reviewed:true}})).status,409);
 await update({action:'itinerary',items:[{day:2,title:'User edited activity',startTime:'09:30'}]});
 await update({action:'review-itinerary'});
 assert.ok(s.data.packing.length>0);const itemId=s.data.packing[0].id;
 await update({action:'packing',itemId,state:'need'});assert.ok(s.data.workspace.needs.includes(itemId));
 await update({action:'packing',itemId,state:'have'});
 const reloaded=await call(`/api/trips/${id}/workspace`,{cookie:user.cookie});assert.equal(reloaded.data.timeline[0].title,'User edited activity');assert.equal(reloaded.data.packing.find(p=>p.id===itemId).completed,true);assert.ok(reloaded.data.workspace.requirements.passport);
 const list=await call('/api/trips',{cookie:user.cookie});assert.ok(list.data.trips.some(t=>t.tripId===id));
 for(const suffix of ['', '/requirements','/itinerary','/packing'])assert.equal((await fetch(base+`/trips/${id}${suffix}`)).status,200);
 const second=await call('/api/trips/analyze',{method:'POST',cookie:user.cookie,body:{origin:'Yangon',destination:'Bangkok',startDate:'2026-12-16',endDate:'2027-01-03',adults:1,children:0,travelers:1,budget:28400,currency:'THB',tripPurpose:'culture',pace:'balanced',tripScope:'international'}});assert.equal(second.status,201);const secondId=second.data.persistence.tripId;
 assert.equal((await call(`/api/trips/${id}`,{method:'DELETE'})).status,401);
 assert.equal((await call(`/api/trips/${id}`,{method:'DELETE',cookie:other.cookie})).status,404);
 assert.equal((await call(`/api/trips/${id}/workspace`,{cookie:user.cookie})).status,200);
 assert.equal((await call(`/api/trips/${id}`,{method:'DELETE',cookie:user.cookie})).status,200);
 assert.equal((await call(`/api/trips/${id}/workspace`,{cookie:user.cookie})).status,404);
 assert.equal((await call(`/api/trips/${secondId}/workspace`,{cookie:user.cookie})).status,200);
 const [packingRows]=await getDatabasePool().execute('SELECT id FROM packing_lists WHERE id=?',[itemId]);assert.equal(packingRows.length,0);
 assert.equal((await call(`/api/auth/me`,{cookie:user.cookie})).status,200);
 const local=await call('/api/trips/analyze',{method:'POST',cookie:user.cookie,body:{tripType:'local',destination:'Bangkok',startDate:'2026-12-16',endDate:'2026-12-20',adults:2,children:0,travelers:2,budget:30000,currency:'THB',tripPurpose:'culture',pace:'balanced'}});
 assert.equal(local.status,201,JSON.stringify(local.data));
 const localId=local.data.persistence.tripId;
 const localReload=await call(`/api/trips/${localId}/workspace`,{cookie:user.cookie});
 assert.equal(localReload.data.details.tripType,'local');assert.equal(localReload.data.details.destination,'Bangkok');assert.equal(localReload.data.details.nights,4);
 assert.ok(!localReload.data.packing.some(p=>/Passport and travel documents/.test(p.name||p.itemName||p.item_name||'')));
 console.log('PASS: draft restoration, save/edit, local-trip persistence, deletion ownership, cascading cleanup, other trip and user preserved.');
}finally{const pool=getDatabasePool();for(const id of created){await pool.execute('DELETE FROM trip_sessions WHERE user_id=?',[id]);await pool.execute('DELETE FROM users WHERE id=?',[id]);}await pool.end();}
