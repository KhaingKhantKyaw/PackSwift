import test from 'node:test';import assert from 'node:assert/strict';
import '../public/js/destination-currency.js';import '../public/js/trip-context.js';import '../public/js/canonical-itinerary.js';
import {buildLiveReview} from '../src/services/live-review.js';import {recommendActivities} from '../src/services/activity-recommendations.js';import {normalizeGooglePlace} from '../src/services/google-places-service.js';
const c=globalThis.PackSwiftCanonical,context=globalThis.PackSwiftTripContext;
const base={origin:'Yangon',destination:'Bangkok',startDate:'2026-12-03',endDate:'2026-12-10',adults:2,children:0,budget:30000,currency:'THB',pace:'balanced',notes:'Culture, food, beaches',dietaryStyle:'halal',planningGoal:'best-value'};
test('unknown is not zero; allocations are not expenses; currencies remain explicit',()=>{
 const r=buildLiveReview(base),b=context.budgetSummary(base,r);assert.equal(b.complete,false);assert.equal(b.categories.find(c=>c.key==='Stay').minimum,null);assert.equal(b.categories.find(c=>c.key==='Transport').minimum,null);assert.equal(b.allocation.status,'ALLOCATED');assert.equal(b.minimum,b.categories.filter(c=>c.minimum!==null).reduce((n,c)=>n+c.minimum,0));assert.ok(b.categories.every(c=>c.currency==='THB'));assert.doesNotMatch(r.budget.status,/workable|affordable/);
 const known=context.budgetSummary({...base,costCurrency:'THB',costStay:'0',costTransport:'5000'},r);assert.equal(known.categories[1].status,'USER_ENTERED');assert.equal(known.categories[1].amount,0);assert.equal(known.categories[0].amount,5000);
 assert.equal(context.budgetSummary({...base,costCurrency:'USD',costStay:'500'},r).categories[1].status,'UNKNOWN');
});
test('all three dietary preferences change provider food queries without certification claims',async()=>{
 for(const dietaryStyle of ['halal','vegetarian','vegan']){const queries=[];const result=await recommendActivities({...base,dietaryStyle},{configured:true,search:async q=>{queries.push(q.searchQuery);return {activities:[{providerPlaceId:'food',title:'Food venue',types:['restaurant'],coordinates:{latitude:13.7563,longitude:100.5018},rating:4}]};}});assert.ok(queries.some(q=>q.includes(dietaryStyle+' restaurants')));const place=result.activities.find(p=>p.providerPlaceId==='food');assert.equal(place.dietary.status,'POSSIBLE_MATCH');assert.match(place.dietary.message,/verify with venue/);assert.match(result.notices.join(' '),/not verified certification/);}
});
test('provider failure remains an explicit partial error, not a fake successful empty response',async()=>{
 const result=await recommendActivities(base,{configured:true,search:async()=>{throw Error('unavailable');}});assert.equal(result.dataStatus,'partial_error');assert.equal(result.partial,true);assert.match(result.notices.join(' '),/failed/);
});
test('typical start and reported hours constrain suggestions; user edits remain intact',()=>{
 const place={id:'museum',title:'Museum',suggestedStayMin:90,openingPeriods:[{open:{day:5,hour:12},close:{day:5,hour:18}}]};
 const plan=c.reconcile([place],null,8,{preferredDayStart:'10:00',preferredDayEnd:'20:00'},'2026-12-03');assert.equal(plan.items[0].day,2);assert.equal(plan.items[0].startTime,'12:00');assert.equal(plan.items[0].timeStatus,'TENTATIVE');
 plan.items[0].userModified=true;plan.items[0].startTime='13:00';assert.equal(c.reconcile([place],plan,8,{preferredDayStart:'15:00'},'2026-12-03').items[0].startTime,'13:00');
 const late=c.reconcile([{id:'park'}],null,8,{preferredDayStart:'11:30'},'2026-12-03');assert.equal(late.items[0].startTime,'11:30');assert.match(late.items[0].scheduleNote,/unknown/);
 const closed=c.reconcile([place],null,8,{preferredDayStart:'19:00'},'2026-12-03');assert.equal(closed.items[0].day,null);
});
test('missing provider prices and ratings are not synthesized',()=>{const p=normalizeGooglePlace({id:'a',displayName:{text:'Place'},types:[]},{destination:'Tokyo'});assert.equal(p.costUsd,null);assert.equal(p.rating,null);assert.equal(p.costStatus,'UNKNOWN');});
test('domestic and unknown contexts are not determined by mode',()=>{assert.equal(context.routeContext({origin:'Bangkok',destination:'Chiang Mai'}).routeType,'domestic');assert.equal(context.routeContext({tripType:'local',origin:'Unmapped location'}).routeType,'unknown');});
