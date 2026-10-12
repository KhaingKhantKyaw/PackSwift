import test from 'node:test';import assert from 'node:assert/strict';
import '../public/js/canonical-itinerary.js';
const c=globalThis.PackSwiftCanonical;
test('recommendation and search sources share IDs and a single itinerary',()=>{
 const p=c.reconcile([{placeId:'a',title:'A',source:'Google Places'},{placeId:'b',title:'B',source:'user_search'},{placeId:'a',title:'A',source:'user_search'}],null,8);
 assert.equal(p.selectedPlaces.length,2);assert.equal(p.items.length,2);assert.deepEqual(c.rows(p).map(p=>p.title),['A','B']);
});
test('reconcile preserves exact edits and removes orphaned references',()=>{
 let p=c.reconcile([{id:'a',title:'A'},{id:'b',title:'B'}],null,8);p.items[0]={...p.items[0],day:3,startTime:'11:30',notes:'Meet here',userModified:true};p.items.reverse();
 const restored=c.reconcile(p.selectedPlaces,JSON.parse(JSON.stringify(p)),8);assert.deepEqual(restored.items.map(i=>[i.id,i.day,i.startTime,i.notes]),p.items.map(i=>[i.id,i.day,i.startTime,i.notes]));
 assert.equal(c.reconcile([p.selectedPlaces[0]],p,8).items.length,1);
});
test('custom equal names retain separate identities; empty selection stays empty',()=>{
 assert.equal(c.reconcile([{id:'custom:a',title:'Lunch',source:'custom'},{id:'custom:b',title:'Lunch',source:'custom'}],null,3).items.length,2);
 assert.equal(c.reconcile([],null,8).items.length,0);
});
test('invalid shortened dates reject instead of silently moving user edits',()=>{
 const p=c.reconcile([{id:'a',title:'A'}],null,8);p.items[0].day=7;assert.throws(()=>c.reconcile(p.selectedPlaces,p,3),RangeError);
});
test('pace changes recalculate unedited assignments and preserve manual edits',()=>{
 const selected=Array.from({length:8},(_,n)=>({id:'p'+n,title:'Place '+n}));
 let p=c.reconcile(selected,null,4,{tripPace:'packed'});p.items[0]={...p.items[0],day:3,notes:'Keep this',startTime:'12:00',userModified:true};
 p=c.reconcile(selected,p,4,{tripPace:'relaxed'});assert.equal(p.items[0].day,3);assert.equal(p.items[0].notes,'Keep this');
 for(let day=1;day<=4;day++)assert.ok(p.items.filter(i=>i.day===day).length<=2);
});
test('overflow remains selected but unassigned; day trips reserve the day',()=>{
 const selected=[{id:'daytrip',tripType:'day_trip'},...Array.from({length:8},(_,n)=>({id:'p'+n}))];
 const p=c.reconcile(selected,null,2,{tripPace:'balanced'});assert.equal(p.items.length,9);
 const day=p.items[0].day;assert.equal(p.items.filter(i=>i.day===day).length,1);assert.ok(p.items.some(i=>i.day===null));
});
test('legacy normalization retains edited title/time and stable legacy identity',()=>{
 const p=c.legacy([],[{id:73,day:2,title:'My edited lunch',startTime:'12:30',description:'Meet Jo'}],3,{});
 assert.equal(p.items[0].id,'legacy-item:73');assert.equal(p.items[0].notes,'Meet Jo');assert.equal(c.rows(p)[0].title,'My edited lunch');
});
