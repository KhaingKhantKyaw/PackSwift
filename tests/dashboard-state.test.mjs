import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateDashboardState as validate} from '../src/services/dashboard-state.js';
import {tripCostBreakdown} from '../src/services/trip-workspace.js';
const empty=()=>({revision:0,experience:'',currency:'THB',expenses:[],contacts:[],stories:[],entryChecks:[]});
const expense=()=>({id:randomUUID(),tripId:randomUUID(),amount:50,currency:'THB',date:'2026-11-14',category:'Food',scope:'Personal',note:'Lunch'});
test('dashboard saves only recognized private fields',()=>assert.deepEqual(validate({...empty(),userId:999}),empty()));
test('expenses keep currency and whole shared amount',()=>{const s=empty();s.expenses=[{...expense(),scope:'Shared total'}];assert.equal(validate(s).expenses[0].amount,50);});
test('rejects invalid money, dates, duplicates and currency',()=>{
 for(const patch of [{amount:-2},{amount:Infinity},{amount:'12'},{currency:'<x>'},{date:'2026-02-30'},{category:'unknown'}]){const s=empty();s.expenses=[{...expense(),...patch}];assert.throws(()=>validate(s),RangeError);}
 const s=empty();const e=expense();s.expenses=[e,e];assert.throws(()=>validate(s));
});
test('requires an explicit source before entry review',()=>{
 const s=empty();s.entryChecks=[{id:randomUUID(),tripId:randomUUID(),passportCountry:'Myanmar',passportType:'Ordinary',residence:'Thailand',purpose:'Tourism',transit:'',notes:'Check documents',source:'',reviewed:true}];assert.throws(()=>validate(s));
 s.entryChecks[0].source='https://www.thaievisa.go.th/';assert.equal(validate(s).entryChecks[0].reviewed,true);
 s.entryChecks[0].source='javascript:alert(1)';assert.throws(()=>validate(s));
});
test('limits private drafts and rejects malformed contacts',()=>{
 const s=empty();s.stories=[{id:randomUUID(),tripId:randomUUID(),title:'My trip',body:'A useful experience',public:true}];assert.equal(validate(s).stories[0].public,undefined);
 s.contacts=[{id:randomUUID(),tripId:randomUUID(),name:'Hotel',phone:'bad',source:''}];assert.throws(()=>validate(s));
 s.contacts=[];s.stories[0].body='x'.repeat(3001);assert.throws(()=>validate(s));
});
test('revision is mandatory for lost-update protection',()=>{for(const revision of [-1,'1',undefined,1.5])assert.throws(()=>validate({...empty(),revision}));});
test('trip cost parts exclude stale route or currency inputs',()=>{
 const fields=[{name:'origin',value:'Yangon'},{name:'destination',value:'Bangkok'},{name:'currency',value:'THB'}];
 const support={costs:{flights:'2000',stay:'',daily:'500'},costCurrency:'THB',costContext:'Yangon|Bangkok|||||'};
 fields.push({name:'planningSupport',value:JSON.stringify(support)});
 const trip={preferences:{detailPlanning:{fields}}};
 assert.deepEqual(tripCostBreakdown(trip),{flights:2000,stay:null,daily:500});
 fields[0].value='Tokyo';assert.equal(tripCostBreakdown(trip),null);
});
