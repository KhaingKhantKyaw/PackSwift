import test from 'node:test';
import assert from 'node:assert/strict';
import {updateTripCosts,editTripStop} from '../src/services/trip-hub-edits.js';
import {tripCostBreakdown,validateWorkspaceChange} from '../src/services/trip-workspace.js';
const details={origin:'Yangon',destination:'Bangkok',start:'2027-01-01',end:'2027-01-02',adults:2,children:0,currency:'THB',nights:1};
test('saved costs use total flights + stay + daily for each calendar day',()=>{
 const preferences={workspace:{revision:3},unrelated:'keep'};
 assert.equal(updateTripCosts(preferences,details,{flights:1000,stay:500,daily:200}),1900);
 assert.equal(preferences.unrelated,'keep');assert.equal(preferences.workspace.revision,3);
 assert.deepEqual(tripCostBreakdown({preferences}),{flights:1000,stay:500,daily:200});
 assert.equal(updateTripCosts(preferences,details,{flights:0,stay:null,daily:200}),null);
 assert.equal(preferences.budgetStatus,'unfinished');
 assert.throws(()=>updateTripCosts(preferences,details,{flights:-1,stay:0,daily:0}));
});
const plan=()=>({version:1,contextKey:'saved',destination:'Bangkok',startDate:details.start,endDate:details.end,currency:'THB',generatedAt:'2026-11-14T00:00:00Z',days:[{day:1,date:details.start,title:'Day 1',stops:[{id:'museum',name:'Museum',kind:'activity',startTime:'10:00',durationMinutes:60,locked:false}]},{day:2,date:details.end,title:'Day 2',stops:[]}]});
test('stop edits preserve the saved itinerary and can move an activity atomically',()=>{
 const p={detailPlanning:{fields:[{name:'itineraryPlan',value:JSON.stringify(plan())},{name:'other',value:'keep'}]}};
 const next=editTripStop(p,details,{type:'update',id:'museum',day:2,values:{name:'New museum',startTime:'11:00',durationMinutes:90,notes:'Rest after'}});
 assert.equal(next.days[0].stops.length,0);assert.equal(next.days[1].stops[0].name,'New museum');
 assert.equal(p.detailPlanning.fields[1].value,'keep');
 assert.throws(()=>editTripStop(p,{...details,end:'2027-02-01'},{type:'remove',id:'museum'}));
});
test('locked stops cannot be silently edited or removed',()=>{
 const saved=plan();saved.days[0].stops[0].locked=true;const p={detailPlanning:{fields:[{name:'itineraryPlan',value:JSON.stringify(saved)}]}};
 assert.throws(()=>editTripStop(p,details,{type:'remove',id:'museum'}));
 editTripStop(p,details,{type:'lock',id:'museum',locked:false});assert.equal(editTripStop(p,details,{type:'remove',id:'museum'}).days[0].stops.length,0);
});
test('workspace rejects unknown cost values and generation masquerading as an edit',()=>{
 assert.throws(()=>validateWorkspaceChange({revision:0,action:'costs',costs:{flights:'100',stay:0,daily:0}}));
 assert.throws(()=>validateWorkspaceChange({revision:0,action:'edit-stop',change:{type:'regenerate'}}));
});
