import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlannerDraft,savePlannerDraft,reconcilePacking,scheduleSignature} from '../src/services/planner-draft.js';
import {forecastForDates,getTripForecast} from '../src/services/trip-forecast.js';
import {parameters} from '../src/services/booking-search.js';
import '../public/js/place-search-model.js';
const values={origin:'Yangon',destination:'Bangkok',startDate:'2027-01-01',endDate:'2027-01-06',adults:'2',children:'0',childAges:'[]',currency:'USD',travelPurposes:'[]'};
const body=(extra={})=>({fields:Object.entries({...values,...extra}).map(([name,value])=>({name,value,type:'text'})),selected:[]});
test('unfinished costs save as null; an explicit complete zero estimate stays zero',()=>{
 assert.equal(normalizePlannerDraft(body({budget:'999'})).budget,null);
 const support={costs:{flights:'0',stay:'0',daily:'0'},costCurrency:'USD',costContext:['origin','destination','startDate','endDate','adults','children','childAges'].map(k=>values[k]).join('|')};
 assert.equal(normalizePlannerDraft(body({planningSupport:JSON.stringify(support)})).budget,0);
 support.costs={flights:'100',stay:'200',daily:'10'};assert.equal(normalizePlannerDraft(body({planningSupport:JSON.stringify(support)})).budget,360);
 assert.equal(normalizePlannerDraft(body({children:'1',planningSupport:JSON.stringify(support)})).budget,null);
 assert.equal(normalizePlannerDraft(body({currency:'THB',planningSupport:JSON.stringify(support)})).budget,null);
});
test('drafts enforce route, dates, group limits and ignore unchecked radios',()=>{
 assert.throws(()=>normalizePlannerDraft(body({adults:'10'})));
 assert.throws(()=>normalizePlannerDraft(body({startDate:'2027-02-30'})));
 assert.throws(()=>normalizePlannerDraft(body({destination:'unknown place xyz'})));
 const data=body();data.fields.push({name:'destination',type:'radio',value:'Unknown',checked:false});assert.equal(normalizePlannerDraft(data).destination.name,'Bangkok');
});
test('draft persistence updates canonical facts and preferences atomically, owner scoped',async()=>{
 const calls=[],connection={beginTransaction:async()=>calls.push('begin'),commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),release:()=>calls.push('release'),execute:async(sql,args)=>{calls.push({sql,args});return [sql.startsWith('SELECT')?[{id:1,preferences_json:{}}]:{affectedRows:1,insertId:1}];}};
 const result=await savePlannerDraft(7,'00000000-0000-4000-8000-000000000001',body(),{getConnection:async()=>connection});assert.equal(result.budgetStatus,'unfinished');
 const update=calls.find(c=>c.sql?.startsWith('UPDATE'));assert.match(update.sql,/start_date=\?,end_date=\?,budget_amount=\?,budget_currency=/);assert.equal(update.args.at(-1),7);assert.equal(update.args[10],null);assert.deepEqual(calls.slice(-2),['commit','release']);
});
test('missing owned trip rolls back and never writes',async()=>{
 const calls=[],connection={beginTransaction:async()=>{},commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),release:()=>{},execute:async(sql)=>{calls.push(sql);return [[]];}};
 await assert.rejects(savePlannerDraft(7,'other-user-trip',body(),{getConnection:async()=>connection}),/not found/);assert.ok(calls.includes('rollback'));assert.ok(!calls.some(x=>x.startsWith('UPDATE')));
});
test('spending style does not change activity load; manual mode waits for chosen days',()=>{
 const selected=Array.from({length:8},(_,i)=>({id:String(i),title:'Stop '+i,tripType:'in_city'}));
 const a=PackSwiftPlaceSearchModel.schedule(selected,4,{travelStyle:'Ultimate Luxury',tripPace:'packed'}),b=PackSwiftPlaceSearchModel.schedule(selected,4,{travelStyle:'Pocket Friendly',tripPace:'packed'});assert.deepEqual(a,b);
 const manual=PackSwiftPlaceSearchModel.schedule(selected,4,{planningMode:'manual',activityPreferences:[{activityId:'0',preferredDay:2}]});assert.equal(manual.days[1].activities.length,1);assert.equal(manual.unscheduled.length,7);
 const conflict=PackSwiftPlaceSearchModel.schedule(selected.slice(0,2),4,{activityPreferences:selected.slice(0,2).map(p=>({activityId:p.id,preferredDay:2,preferredTimePeriod:'specific',specificTime:'10:00'}))});assert.equal(conflict.unscheduled.length,1);assert.match(conflict.unscheduled[0].reason,/conflicts/);
});
test('forecasts cover trip dates only and never invent future weather',async()=>{
 const payload={daily:{time:['2026-11-05','2026-11-06','2026-11-07'],temperature_2m_min:[20,21,22],temperature_2m_max:[30,31,32],precipitation_probability_max:[20,80,10]}};
 const sliced=forecastForDates(payload,'2026-11-06','2026-11-10');assert.equal(sliced.daily.length,2);assert.equal(sliced.status,'partial');assert.equal(sliced.daily[0].rainProbability,80);
 const far=await getTripForecast({destination:'Bangkok',startDate:'2027-01-01',endDate:'2027-01-06'},{now:new Date('2026-11-05'),fetcher:()=>{throw Error('must not fetch');}});assert.equal(far.status,'outside-horizon');assert.deepEqual(far.daily,[]);
 const unconfigured=await getTripForecast({destination:'Bangkok',startDate:'2026-11-06',endDate:'2026-11-10'},{now:new Date('2026-11-05'),production:true,key:''});assert.equal(unconfigured.status,'not-configured');
});
test('infant age is kept distinct in UI data and mapped to the provider convention',()=>{assert.equal(parameters('hotels',{...values,startDate:'2027-12-01',endDate:'2027-12-05',children:2,childAges:[0,1]}).children_ages,'1,1');});
test('packing resaves keep IDs and newer completion unless the user deliberately changed it',()=>{
 const item={name:'Passport',category:'Documents',quantity:1,packed:false},existing=[{id:42,item_name:'Passport',category:'Documents',is_completed:true}];
 const unchanged=reconcilePacking(existing,[item],[item]);assert.equal(unchanged[0].databaseId,42);assert.equal(unchanged[0].packed,true);
 const deliberate=reconcilePacking(existing,[{...item,packed:true}],[item]);assert.equal(deliberate[0].packed,false);
 assert.deepEqual(reconcilePacking(existing,[item],[]),[]);
});
test('budget and packing-only saves preserve an existing manual itinerary',()=>{
 const original=normalizePlannerDraft(body()).details;
 const changes=normalizePlannerDraft(body({budget:'999',packingSnapshot:'[]'})).details;
 assert.equal(scheduleSignature(original),scheduleSignature(changes));
 assert.notEqual(scheduleSignature(original),scheduleSignature(normalizePlannerDraft(body({endDate:'2027-01-07'})).details));
});

function sampleEditablePlan(){return {version:1,generatedAt:'2026-11-06T00:00:00.000Z',contextKey:'test',destination:'Bangkok',startDate:values.startDate,endDate:values.endDate,currency:'USD',days:Array.from({length:6},(_,i)=>({day:i+1,date:`2027-01-0${i+1}`,stops:i?[]:[{id:'museum',placeId:'ChIJfixturemuseum123',provider:'google',name:'Provider museum name',kind:'activity',startTime:'10:30',durationMinutes:90,locked:true,custom:false,costAmount:null,currency:'USD',coordinates:{latitude:13.7,longitude:100.5},openingPeriods:[]},{id:'personal',name:'Lunch with my friend',kind:'custom',custom:true,startTime:'12:30',durationMinutes:60,locked:true,costAmount:20,currency:'USD',notes:'Meet at the entrance'}]}))};}
test('editable itinerary saves decisions without copied provider content',()=>{
 const normalized=normalizePlannerDraft(body({itineraryPlan:JSON.stringify(sampleEditablePlan())}));
 const saved=JSON.parse(normalized.details.fields.find(f=>f.name==='itineraryPlan').value),[provider,personal]=saved.days[0].stops;
 assert.equal(provider.locked,true);assert.equal(provider.startTime,'10:30');assert.equal(provider.placeId,'ChIJfixturemuseum123');assert.equal(provider.coordinates,undefined);assert.equal(provider.openingPeriods,undefined);assert.notEqual(provider.name,'Provider museum name');
 assert.equal(personal.name,'Lunch with my friend');assert.equal(personal.notes,'Meet at the entrance');assert.equal(personal.costAmount,20);
 assert.throws(()=>normalizePlannerDraft(body({itineraryPlan:'invalid'})),/could not be read/);
 const prior=normalized.details,changed=sampleEditablePlan();changed.days[0].stops[1].startTime='13:30';
 assert.notEqual(scheduleSignature(prior),scheduleSignature(normalizePlannerDraft(body({itineraryPlan:JSON.stringify(changed)})).details));
});
