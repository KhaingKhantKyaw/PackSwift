import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/js/destination-currency.js';
import '../public/js/trip-context.js';
import {buildLiveReview} from '../src/services/live-review.js';
const route=globalThis.PackSwiftTripContext.routeContext;
test('scope and border crossing are independent',()=>{
 for(const [origin,destination,expected] of [['Yangon','Mandalay',false],['Yangon','Ngapali',false],['Bangkok','Chiang Mai',false],['Bangkok','Hua Hin',false],['Yangon','Bangkok',true],['Bangkok','Hanoi',true]]){
 const r=route({origin,destination,tripType:'anywhere'});
 assert.equal(r.tripScope,'anywhere');assert.equal(r.isInternational,expected);
 }
});
test('local city requires no second destination and legacy scope still resolves',()=>{
 assert.equal(route({tripType:'local',origin:'Bangkok',destination:'Hanoi'}).destination,'Bangkok');
 assert.equal(route({tripType:'worldwide',origin:'Yangon',destination:'Mandalay'}).routeType,'domestic');
 assert.equal(route({tripType:'anywhere',origin:'Unknown town',destination:'Bangkok'}).isInternational,null);
});
test('domestic preview does not invent international formalities',()=>{
 const r=buildLiveReview({origin:'Bangkok',destination:'Chiang Mai',tripType:'anywhere',startDate:'2026-12-16',endDate:'2026-12-20',adults:1,children:0});
 assert.equal(r.alerts[0].title,'Domestic trip');
 assert.ok(!r.budget.excluded.includes('Visa fees'));
 assert.equal(r.packingRecommendations[0],'Personal identification');
 assert.ok(!r.itinerary[0].guidance.includes('immigration'));
});
