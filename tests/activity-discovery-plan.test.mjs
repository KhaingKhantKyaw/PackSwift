import test from 'node:test';
import assert from 'node:assert/strict';
import {activityTopics,activityStyles,activitySearchQuery,rankActivities} from '../src/services/activity-discovery-plan.js';

test('all purposes and styles produce three distinct related discovery queries',()=>{
 assert.equal(Object.keys(activityTopics).length,10);
 for(const purpose of Object.keys(activityTopics))for(const style of Object.keys(activityStyles)){
  const queries=[0,1,2].map(variant=>activitySearchQuery('Hanoi',purpose,style,variant));
  assert.equal(new Set(queries).size,3);
  queries.forEach(query=>{assert.ok(query.endsWith('in Hanoi'));assert.ok(query.startsWith(activityStyles[style]));});
 }
 assert.match(activitySearchQuery('Hanoi','Shopping & Fashion','Balanced'),/shopping markets and boutiques/);
 assert.match(activitySearchQuery('Hanoi','Food, Drink & Culinary','Balanced'),/local food markets and street food/);
});
test('invalid purposes, styles and variants are rejected',()=>{
 for(const args of [['Hanoi','unknown','Balanced'],['Hanoi','Nature & Outdoor','unknown'],['Hanoi','Nature & Outdoor','Balanced',3],['Hanoi','__proto__','Balanced']])assert.throws(()=>activitySearchQuery(...args),{status:422});
});
test('style ranking favors known affordable or premium options without inventing prices',()=>{
 const items=[{id:'premium',priceLevel:'PRICE_LEVEL_VERY_EXPENSIVE',rating:4.9,ratingCount:1000},{id:'free',priceLevel:'PRICE_LEVEL_FREE',rating:4.6,ratingCount:50},{id:'unknown',priceLevel:null,rating:4.7,ratingCount:100}];
 assert.equal(rankActivities(items,'Pocket Friendly')[0].id,'free');
 assert.equal(rankActivities(items,'Balanced')[0].id,'free');
 assert.equal(rankActivities(items,'Ultimate Luxury')[0].id,'premium');
 assert.equal(items[0].id,'premium','Ranking does not mutate the source');
 assert.equal(rankActivities(items,'Balanced').find(item=>item.id==='unknown').priceLevel,null);
});
