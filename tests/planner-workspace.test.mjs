import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/js/trip-context.js';
import '../public/js/destination-currency.js';
import {buildLiveReview} from '../src/services/live-review.js';
const {displayDate,entryStatus,budgetSummary}=globalThis.PackSwiftTripContext;
const input={tripType:'worldwide',origin:'Yangon',destination:'Bangkok',startDate:'2026-12-16',endDate:'2026-12-20',adults:2,children:1,planningGoal:'best-value',currency:'THB',budget:30000};
test('Phase 1: ISO date display and data-driven currency selection',()=>{
 assert.equal(displayDate('2026-12-16'),'16/12/26');assert.equal(displayDate('2027-01-03'),'03/01/27');
 for(const [city,code]of Object.entries({Bangkok:'THB',Hanoi:'VND',Yangon:'MMK',Singapore:'SGD',Tokyo:'JPY',Seoul:'KRW',London:'GBP',Paris:'EUR','New York City':'USD'}))assert.equal(PackSwiftCurrency.resolve(city).code,code);
 assert.equal(PackSwiftCurrency.resolve('Da Nang, Vietnam').code,'VND');assert.equal(buildLiveReview(input).tripSummary.nights,4);
});
test('Phase 2: unknown, expired or mismatched rules cannot declare visa-free',()=>{
 const c={passportCountry:'MM',destinationCountry:'SG',entryMode:'air',days:10};
 const rule={passport_country:'MM',destination_country:'SG',visa_type:'visa_free',max_stay_days:14,conditions:{entry_mode:'air'},verificationStatus:'verified',sourceUrl:'https://example.test/rule',lastUpdated:'2026-01-01',validUntil:'2099-01-01'};
 assert.equal(entryStatus(c).status,'VERIFICATION_REQUIRED');assert.equal(entryStatus(c,rule).status,'VISA_FREE');assert.equal(entryStatus({...c,days:15},rule).status,'OVERSTAY_RISK');
 for(const altered of [{validUntil:'invalid'},{validUntil:'2000-01-01'},{max_stay_days:null},{sourceUrl:'javascript:alert(1)'},{passport_country:'TH'}])assert.equal(entryStatus(c,{...rule,...altered}).status,'VERIFICATION_REQUIRED');
 assert.equal(entryStatus({tripType:'local'}).status,'LOCAL');
});
test('Phase 3: review reflects dates, destination and all travellers',()=>{
 const r=buildLiveReview({...input,destination:'Hanoi',startDate:'2026-12-03',endDate:'2026-12-10',adults:1,children:0,currency:'VND'});
 assert.equal(r.tripSummary.nights,7);assert.equal(r.tripSummary.destination,'Hanoi');assert.equal(r.budget.currency,'VND');assert.equal(r.tripSummary.adults,1);
});
test('Phase 4: unknown flights stay unknown, low budgets never allocate negatives',()=>{
 for(const amount of [0,1,100,30000]){const i={...input,budget:amount};const b=budgetSummary(i,buildLiveReview(i));assert.equal(b.flight,null);assert.ok(b.spending.every(r=>r.amount>=0));assert.ok(b.spending.reduce((n,r)=>n+r.amount,0)<=Math.max(0,amount-(b.base||0)));if(amount===1)assert.ok(b.shortfall>0);}
 const i={...input,tripType:'local',origin:'Bangkok'},r=buildLiveReview(i),b=budgetSummary(i,r);assert.equal(b.flight,0);assert.equal(b.complete,true);assert.ok(!r.itinerary.some(d=>/immigration|airport/i.test(d.guidance)));assert.ok(!r.packingRecommendations.includes('Passport and entry documents'));
 const unknown=budgetSummary({...input,currency:'USD'},buildLiveReview(input));assert.equal(unknown.base,null);assert.equal(unknown.remaining,null);
});
test('budget strategies and stay style change benchmark recommendations',()=>{
 const cost=changes=>buildLiveReview({...input,...changes}).budget.total.minimum;
 assert.ok(cost({planningGoal:'make-possible'})<cost({planningGoal:'best-value'}));
 assert.ok(cost({planningGoal:'best-value'})<cost({planningGoal:'comfort-first'}));
 assert.ok(cost({accommodationStyle:'hostel'})<cost({accommodationStyle:'luxury'}));
});
