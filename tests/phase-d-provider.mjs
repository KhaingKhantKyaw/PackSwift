import assert from 'node:assert/strict';
import '../public/js/canonical-itinerary.js';
const base=process.env.QA_TEST_URL||'http://127.0.0.1:3000';
async function get(path){const r=await fetch(base+path);assert.equal(r.status,200,'Live place provider response');return r.json();}
const results=await get('/api/places/search?'+new URLSearchParams({q:'Hua Hin Beach Thailand',destination:'Bangkok'}));
assert.ok(results.length,'Real Hua Hin search result required');
const p=await get('/api/places/'+encodeURIComponent(results[0].id)+'?destination=Bangkok');
assert.equal(p.countryCode,'TH');assert.equal(p.tripType,'day_trip');assert.ok(p.distanceFromDestination>100);
const c=globalThis.PackSwiftCanonical,plan=c.suggest([p],null,8,{tripPace:'balanced'},'2026-12-03');
assert.equal(plan.items.length,1);assert.notEqual(plan.items[0].day,null);assert.ok(c.conflicts(plan).some(w=>w.code==='LOGISTICS'&&w.message.includes('not calculated')));
console.log('PASS real provider: '+p.title+' classified as day trip; outbound/return warning; no fabricated transfer time.');
const selected=[];
for(const query of ['Grand Palace Bangkok','Wat Pho Bangkok','Wat Arun Bangkok','Dream World Thailand']){const matches=await get('/api/places/search?'+new URLSearchParams({q:query,destination:'Bangkok'}));assert.ok(matches.length,query);selected.push(await get('/api/places/'+encodeURIComponent(matches[0].id)+'?destination=Bangkok'));}
const arranged=c.suggest(selected,null,8,{tripPace:'balanced',arrivalAt:'2026-12-03T15:00',arrivalBufferMin:120,departureAt:'2026-12-10T10:00',departureBufferMin:180},'2026-12-03');
const day=p=>arranged.items.find(i=>i.selectedPlaceId===c.identity(p)).day;
assert.ok(c.distance(selected[0],selected[1])<3);assert.ok(c.distance(selected[0],selected[2])<3);assert.ok(c.distance(selected[0],selected[3])>25);assert.notEqual(day(selected[0]),day(selected[3]));assert.equal(arranged.items.length,4);assert.ok(arranged.items.every(i=>i.day!==8));
console.log('PASS real Bangkok selected places: Old Town proximity, distant Dream World separation, arrival/departure constraints.');
