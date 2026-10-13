import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLiveReview} from '../src/services/live-review.js';
const input={origin:'Yangon',destination:'Bangkok',startDate:'2026-12-16',endDate:'2027-01-03',adults:1,children:0,planningGoal:'make-possible',passportCountry:'Myanmar',budget:25000};
test('cross-year review has 18 nights and 19 dated days with honest totals',()=>{
  const result=buildLiveReview(input);
  assert.equal(result.tripSummary.nights,18);assert.equal(result.itinerary.length,19);
  assert.equal(result.itinerary.at(-1).date,'2027-01-03');assert.equal(result.budget.currency,'THB');
  assert.equal(result.budget.total.minimum,result.budget.categories.reduce((n,c)=>n+c.minimum,0));
  assert.ok(result.budget.excluded.includes('Return flights'));
  assert.match(result.alerts[0].message,/verified/);
});
test('traveller counts scale estimates and invalid dates are rejected',()=>{
  assert.ok(buildLiveReview({...input,adults:2}).budget.total.minimum>buildLiveReview(input).budget.total.minimum);
  assert.throws(()=>buildLiveReview({...input,startDate:'2026-02-30'}),RangeError);
  assert.throws(()=>buildLiveReview({...input,adults:0}),RangeError);
});
