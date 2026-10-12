import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/js/canonical-itinerary.js';
import '../public/js/itinerary-preferences-model.js';
const c=globalThis.PackSwiftCanonical;
const start='2026-12-03';
const place=(id,latitude=13.75,longitude=100.49,extra={})=>({id,title:id,coordinates:{latitude,longitude},...extra});
test('calendar dates are independent of host timezone',()=>{assert.equal(c.dateFor(start,8),'2026-12-10');assert.equal(c.dateFor('2026-12-31',2),'2027-01-01');});
test('arrival and departure buffers constrain suggestions including explicit preferences',()=>{
 const prefs={arrivalAt:start+'T15:00',arrivalBufferMin:120,departureAt:'2026-12-04T10:00',departureBufferMin:180};
 const p=c.reconcile([place('a')],null,2,prefs,start);assert.equal(p.items[0].day,1);assert.equal(p.items[0].startTime,'17:00');
 const blocked=c.reconcile([place('a')],null,2,{...prefs,activityPreferences:[{activityId:'a',preferredDay:1,preferredTimePeriod:'specific',specificTime:'09:00'}]},start);assert.equal(blocked.items[0].day,null);
});
test('nearby Old Town fixtures cluster; long theme park occupies another day',()=>{
 const places=[place('Grand Palace',13.75,100.49),place('Dream World',14,100.67,{suggestedStayMin:360}),place('Wat Pho',13.746,100.492),place('Wat Arun',13.743,100.488)];
 const p=c.suggest(places,null,8,{tripPace:'balanced'},start),day=id=>p.items.find(i=>i.selectedPlaceId===id).day;
 assert.equal(day('Grand Palace'),day('Wat Pho'));assert.equal(day('Grand Palace'),day('Wat Arun'));assert.notEqual(day('Dream World'),day('Grand Palace'));assert.ok(c.distance(places[0],places[1])>25);
});
test('locks, manual duration and custom free time survive explicit suggestion',()=>{
 let p=c.reconcile([place('a'),{id:'custom:rest',source:'custom',title:'Free time'}],null,8,{},start);
 Object.assign(p.items[0],{day:3,startTime:'10:00',durationMin:120,durationSource:'USER',locked:true,userModified:true});p.items[1].userModified=true;
 const before=structuredClone(p.items);p=c.suggest(p.selectedPlaces,p,8,{tripPace:'packed'},start);assert.deepEqual(p.items,before);
});
test('Phase D does not rearrange existing flexible activities on preference changes',()=>{
 const p=c.suggest([place('a'),place('b')],null,4,{},start);assert.deepEqual(c.reconcile(p.selectedPlaces,p,4,{preferredDayStart:'12:00'},start).items,p.items);
});
test('weekly overnight, split periods and explicit holiday closure',()=>{
 const p=place('late',13,100,{openingPeriods:[{open:{day:4,hour:22},close:{day:5,hour:2}}]});assert.deepEqual(c.openingWindows(p,'2026-12-04').windows,[[0,120]]);
 p.openingPeriods=[{open:{day:4,hour:9},close:{day:4,hour:12}},{open:{day:4,hour:14},close:{day:4,hour:18}}];assert.equal(c.openingWindows(p,start).windows.length,2);
 p.openingExceptions={[start]:{closed:true}};assert.deepEqual(c.openingWindows(p,start).windows,[]);
});
test('unknown hours and travel remain informational, not fabricated',()=>{
 const p=c.reconcile([place('a'),place('b')],null,2,{},start),w=c.conflicts(p);
 assert.ok(w.some(w=>w.code==='HOURS_UNKNOWN'&&w.severity==='INFO'));assert.ok(w.some(w=>w.code==='TRANSFER'&&w.message.includes('not calculated')));assert.ok(w.some(w=>w.code==='ACCOMMODATION'));
});
test('overlapping locked items remain and get blocking actionable warnings',()=>{
 const p=c.reconcile([place('a'),place('b')],null,4,{},start);p.items.forEach(i=>Object.assign(i,{day:3,startTime:'10:00',locked:true,userModified:true}));
 const next=c.suggest(p.selectedPlaces,p,4,{},start),w=c.conflicts(next).find(w=>w.code==='OVERLAP');assert.equal(next.items.length,2);assert.equal(w.severity,'BLOCKING');assert.ok(w.action);
});
test('opening-hour conflicts are reported without deleting user activities',()=>{
 const p=c.reconcile([place('a',13,100,{openingPeriods:[{open:{day:4,hour:9},close:{day:4,hour:17}}]})],null,1,{},start);Object.assign(p.items[0],{day:1,startTime:'18:30',userModified:true});assert.ok(c.conflicts(p).some(w=>w.code==='HOURS'));assert.equal(p.items.length,1);
});
test('day trip reserves its day; overnight stays unassigned for review',()=>{
 const p=c.suggest([place('beach',12.57,99.95,{tripType:'day_trip'}),place('overnight',12,99,{tripType:'overnight_option'}),place('city')],null,4,{},start);assert.equal(p.items.find(i=>i.selectedPlaceId==='overnight').day,null);const beach=p.items.find(i=>i.selectedPlaceId==='beach');assert.equal(p.items.filter(i=>i.day===beach.day).length,1);assert.ok(c.conflicts(p).some(w=>w.code==='LOGISTICS'));
});
test('priority, metadata and accepted decisions round-trip without derived warning storage',()=>{
 const p=c.suggest([place('optional'),place('must')],null,1,{tripPace:'relaxed',activityPreferences:[{activityId:'must',priority:'must_visit'}]},start);assert.equal(p.items[0].selectedPlaceId,'must');p.items[0].acceptedWarnings=['known'];const restored=JSON.parse(JSON.stringify(p));assert.deepEqual(c.reconcile(restored.selectedPlaces,restored,1,{},start).items,restored.items);
});
test('invalid duration and timezone are rejected',()=>{const p=c.reconcile([place('a')],null,1,{},start);p.items[0].durationMin=-1;assert.throws(()=>c.validate(p,1));const m=globalThis.PackSwiftItineraryPreferenceModel;assert.ok(m.validate(m.normalize({arrivalTimezone:'Invalid/Zone'}),4).length);});
