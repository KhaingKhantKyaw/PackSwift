import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/js/dashboard-tools.js';
import {dashboardCurrencyRate} from '../src/services/dashboard-currency.js';
import {validateWorkspaceChange} from '../src/services/trip-workspace.js';
const tools=globalThis.PackSwiftDashboardTools;
test('offline export includes saved plans and original expenses but excludes passport and private stories',()=>{
 const text=tools.summary({trip:{details:{destination:'Tokyo',origin:'Bangkok',start:'2027-01-01',end:'2027-01-03',currency:'THB',budget:2000,passport:'PRIVATE-PASSPORT'}},workspace:{editablePlan:{days:[{day:1,date:'2027-01-01',stops:[{name:'Museum',startTime:'10:00',notes:'Take a break'}]}]},packing:[{itemName:'Umbrella',quantity:1,category:'Weather',completed:true}],likedActivities:[{title:'Cooking class'}]},expenses:[{date:'2027-01-01',category:'Food',currency:'JPY',amount:500,scope:'Personal'}],contacts:[{name:'Hotel',phone:'1234'}]});
 for(const value of ['Museum','10:00','[x] Umbrella','JPY 500','Cooking class','Hotel: 1234'])assert.ok(text.includes(value));
 assert.ok(!text.includes('PRIVATE-PASSPORT'));
});
test('currency conversion uses validated USD snapshots and their oldest timestamp',async()=>{
 const r=await dashboardCurrencyRate('THB','JPY',{provider:async c=>({rate:c==='THB'?35:150,updatedAt:c==='THB'?'2026-11-13T00:00:00Z':'2026-11-14T00:00:00Z'})});
 assert.equal(r.rate,150/35);assert.equal(r.updated,'2026-11-13T00:00:00Z');
 assert.equal((await dashboardCurrencyRate('THB','THB',{provider:()=>{throw Error();}})).rate,1);
 await assert.rejects(()=>dashboardCurrencyRate('XXX','JPY',{provider:async()=>{throw Error('Unavailable');}}));
 await assert.rejects(()=>dashboardCurrencyRate('THB','JPY',{provider:async()=>({rate:NaN})}));
 await assert.rejects(()=>dashboardCurrencyRate('../bad','JPY'),RangeError);
});
test('activity removal needs a revision and a bounded saved identifier',()=>{
 assert.equal(validateWorkspaceChange({action:'activity-choice',revision:0,id:'saved-place'}).id,'saved-place');
 assert.throws(()=>validateWorkspaceChange({action:'activity-choice',revision:0,id:''}));
});
