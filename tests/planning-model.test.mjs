import test from 'node:test';import assert from 'node:assert/strict';import '../public/js/planning-model.js';
const m=globalThis.PackSwiftPlanningModel;
test('unknown costs produce partial total',()=>{const r=m.budget({flights:100,stay:200});assert.equal(r.low,300);assert.equal(r.complete,false);assert.equal(r.missing.length,5);});
test('zero is explicitly valid and reserve is separate',()=>{const r=m.budget(Object.fromEntries([...m.costKeys.map(k=>[k,0]),['reserve',50],['maximum',40]]));assert.equal(r.complete,true);assert.equal(r.high,50);assert.equal(r.overLimit,true);});
test('invalid and negative costs stay missing',()=>{assert.equal(m.budget({flights:-1,stay:'bad'}).rows.length,0);});
test('empty profile has no invented personality',()=>assert.deepEqual(m.personality({}),[]));
await import('../public/js/place-search-model.js');
test('walking comfort limits daily stop count independently of spending style',()=>{
 const places=Array.from({length:6},(_,i)=>({id:String(i),title:'Place '+i,tripType:'in_city',coordinates:{latitude:13,longitude:100}}));
 const result=globalThis.PackSwiftPlaceSearchModel.schedule(places,3,{dailyPace:'packed',walking:'short',travelStyle:'Balanced'});
 assert.ok(result.days.every(d=>d.activities.length<=2));
});
