import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../public/js/place-search-model.js';
const places=Array.from({length:12},(_,i)=>({id:String(i),title:'Place '+i,tripType:'in_city'}));
test('interleaved places group geographically instead of selection order',()=>{const p=[0,1,2,3,4,5].map(i=>({id:String(i),title:String(i),tripType:'in_city',coordinates:{latitude:i%2?14:13,longitude:100+(i*.001)}}));const plan=PackSwiftPlaceSearchModel.schedule(p,5,{travelStyle:'Balanced'});const populated=plan.days.filter(d=>d.activities.length);assert.equal(populated.length,2);assert.ok(populated.every(d=>new Set(d.activities.map(p=>p.coordinates.latitude)).size===1));});
test('comfort and luxury limit daily activities',()=>{for(const [travelStyle,max] of [['Comfort & Value',2],['Ultimate Luxury',1],['Balanced',3]]){const plan=PackSwiftPlaceSearchModel.schedule(places,5,{travelStyle});assert.ok(plan.days.every(d=>d.activities.length<=max));assert.equal(plan.days.reduce((n,d)=>n+d.activities.length,0)+plan.unscheduled.length,12);}});
test('late arrival has no sightseeing while selections are retained',()=>{const plan=PackSwiftPlaceSearchModel.schedule(places,3,{travelStyle:'Balanced',arrivalTime:'20:00'});assert.equal(plan.days[0].activities.length,0);assert.equal(plan.days.reduce((n,d)=>n+d.activities.length,0)+plan.unscheduled.length,12);});
