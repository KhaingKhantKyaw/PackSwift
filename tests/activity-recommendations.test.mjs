import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/js/activity-recommendation-model.js';
import {recommendActivities} from '../src/services/activity-recommendations.js';
const m=globalThis.PackSwiftActivities;
const input={destination:'Bangkok',startDate:'2026-12-01',endDate:'2026-12-15',pace:'balanced',notes:'beaches',tripPurpose:'culture'};
test('demand scales with calendar days and pace',()=>{
 assert.deepEqual(m.calculateActivityDemand(input),{tripDays:15,usableDays:13,targetPerDay:3,requiredSlots:39,recommendationTarget:49});
 assert.equal(m.calculateActivityDemand({...input,pace:'packed'}).recommendationTarget,65);
 assert.equal(m.calculateActivityDemand({...input,pace:'relaxed'}).recommendationTarget,33);
 assert.equal(m.calculateActivityDemand({...input,endDate:'2026-12-04',pace:'relaxed'}).recommendationTarget,8);
 assert.equal(m.calculateActivityDemand({...input,arrivalDepartureAllowance:0}).usableDays,15);
});
test('synonyms retain original interest and normalize semantic categories',()=>{
 for(const term of ['beaches','sea','coast','seaside'])assert.ok(m.parseInterests(term)[0].categories.includes('beach'));
 assert.equal(m.parseInterests('beaches')[0].original,'beaches');
 assert.ok(m.parseInterests('night markets')[0].categories.includes('food'));
});
test('explicit coverage expands geographically and inventory reaches duration target',async()=>{
 let index=0;const calls=[];
 const search=async request=>{calls.push(request);const beach=request.searchQuery.startsWith('beach');if(beach&&request.searchQuery.includes(' in '))return {activities:[]};
 return {activities:Array.from({length:20},()=>({providerPlaceId:'fixture-'+index,title:(beach?'Beach ':'Museum ')+index++,types:[beach?'beach':'museum'],coordinates:{latitude:beach?12.95:13.75,longitude:100.5},hasPhoto:false})),nextPageToken:request.pageToken?null:'second'};};
 const r=await recommendActivities(input,{configured:true,search});
 assert.equal(r.activities.length,49);assert.ok(r.coverage[0].count>=3);
 assert.ok(calls.some(c=>c.searchQuery.includes('beach near')));
 assert.ok(r.activities[0].matchedInterests.includes('beaches'));
 assert.ok(r.activities.find(p=>p.title.startsWith('Beach')).tripType==='day_trip');
 assert.ok(r.activities.every(p=>p.id&&p.categories&&p.travelContext));
 assert.ok(calls.some(c=>c.pageToken));
});
test('unavailable provider never invents extra attractions',async()=>{
 const r=await recommendActivities(input,{configured:false});
 assert.ok(r.activities.some(p=>p.categories.includes('beach')));assert.ok(r.partial);
 assert.ok(!r.activities.some(p=>p.isSample));assert.ok(r.notices.some(n=>n.includes('not invented')));
});
test('semantic grouping keeps similar places together, independent of input order',()=>{
 const places=[{id:'1',title:'Dream World',categories:['theme_park']},{id:'2',title:'Grand Palace',categories:['culture']},{id:'3',title:'Siam Amazing Park',categories:['theme_park']},{id:'4',title:'Wat Arun',categories:['culture']}];
 const groups=m.groupActivities(places);assert.deepEqual(groups.find(g=>g.id==='theme_park').places.map(p=>p.id),['1','3']);assert.ok(m.similarity(places[0],places[2])>m.similarity(places[0],places[1]));
});
test('far away and unlocated provider results are excluded',async()=>{
 const r=await recommendActivities(input,{configured:true,search:async()=>({activities:[{providerPlaceId:'far',title:'Beach far away',coordinates:{latitude:0,longitude:0}},{providerPlaceId:'unknown',title:'Beach without location'}]})});
 assert.ok(!r.activities.some(p=>['far','unknown'].includes(p.id)));
});
