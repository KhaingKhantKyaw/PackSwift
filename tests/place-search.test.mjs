import test from 'node:test';import assert from 'node:assert/strict';
import {PlaceSearchService,placeReference,hydrateSelected} from '../src/services/place-search-service.js';
const model=globalThis.PackSwiftPlaceSearchModel;
const fixture={id:'test-place-12345',displayName:{text:'Test Beach'},formattedAddress:'Test address',location:{latitude:12.57,longitude:99.95},types:['beach'],addressComponents:[{types:['country'],shortText:'TH',longText:'Thailand'}],rating:4.5,userRatingCount:200};
test('autocomplete uses bias not boundary and passes session token',async()=>{let request;const service=new PlaceSearchService({apiKey:'test-only',fetchImpl:async(url,options)=>{request={url,...options};return {ok:true,json:async()=>({suggestions:[{placePrediction:{placeId:fixture.id,structuredFormat:{mainText:{text:'Test Beach'},secondaryText:{text:'Thailand'}},types:['beach']}}]})};}});const r=await service.autocomplete({query:'test beach',destination:'Bangkok',sessionToken:'test-session'});const b=JSON.parse(request.body);assert.ok(b.locationBias);assert.equal(b.locationRestriction,undefined);assert.equal(b.sessionToken,'test-session');assert.equal(r[0].id,fixture.id);});
test('details normalizes real fields, classifies day trips and only keeps references for persistence',async()=>{const service=new PlaceSearchService({apiKey:'test-only',fetchImpl:async()=>({ok:true,json:async()=>fixture})});const p=await service.details({id:fixture.id,destination:'Bangkok'});assert.equal(p.tripType,'day_trip');assert.equal(p.rating,4.5);assert.equal(p.estimatedCost,null);const saved=placeReference(p);assert.equal(saved.providerPlaceId,fixture.id);assert.equal(saved.rating,undefined);assert.equal(saved.coordinates,undefined);assert.equal(saved.title,'Saved place');assert.equal((await hydrateSelected([saved],'Bangkok',service))[0].title,'Test Beach');});
test('restaurant becomes a dining stop; hotels are not activities',async()=>{const service=new PlaceSearchService({apiKey:'test-only',fetchImpl:async()=>({ok:true,json:async()=>({...fixture,types:['restaurant']})})});assert.equal((await service.details({id:fixture.id,destination:'Bangkok'})).activityType,'dining');service.fetch=async()=>({ok:true,json:async()=>({...fixture,types:['hotel']})});await assert.rejects(()=>service.details({id:fixture.id,destination:'Bangkok'}),/Accommodation/);});
test('preferred day reserves full day and long distance remains explicit unscheduled side trip',()=>{const selected=[{id:'beach',title:'Beach',tripType:'day_trip'},{id:'local',title:'Local',tripType:'in_city'},{id:'far',title:'Far',tripType:'long_distance'}];const p=model.schedule(selected,7,{activityPreferences:[{activityId:'beach',preferredDay:5,priority:'must_visit'}]});assert.equal(p.days[4].activities[0].id,'beach');assert.equal(p.days[4].activities.length,1);assert.equal(p.days[4].activities[0].planningBlocks.length,4);assert.equal(p.unscheduled[0].id,'far');assert.equal(p.unpricedTransfers,2);});
test('failed refresh preserves ID without stale provider data',async()=>{const r=await hydrateSelected([{...fixture,title:'Stale provider title',providerPlaceId:fixture.id,source:'user_search'}],'Bangkok',{details:async()=>{throw Error('unavailable');}});assert.equal(r[0].providerPlaceId,fixture.id);assert.equal(r[0].needsRefresh,true);assert.equal(r[0].title,'Saved place');});
test('provider failures are sanitized',async()=>{const service=new PlaceSearchService({apiKey:'test-only',fetchImpl:async()=>({ok:false,status:403})});await assert.rejects(()=>service.textSearch({query:'place'}),/temporarily unavailable/);});
test('provider status and error code survive internally without leaking credentials',async()=>{
 for(const status of [400,401,403,404,429,500,503]){
  const service=new PlaceSearchService({apiKey:'secret-test-key',fetchImpl:async()=>({ok:false,status,json:async()=>({error:{status:'TEST_ERROR',message:'Rejected secret-test-key'}})})});
  await assert.rejects(()=>service.textSearch({query:'place'}),e=>{
   assert.equal(e.status,503);assert.equal(e.diagnostic.providerStatus,status);assert.equal(e.diagnostic.code,'TEST_ERROR');
   assert.equal(e.diagnostic.message,'Rejected [REDACTED]');assert.ok(!JSON.stringify(e).includes('secret-test-key'));return true;
  });
 }
});
test('configuration, network, timeout and malformed responses have distinct diagnostics',async()=>{
 const scenarios=[
  [{apiKey:''},'MISSING_API_KEY'],
  [{apiKey:'test',fetchImpl:async()=>{throw Error('secret raw connection error');}},'NETWORK_ERROR'],
  [{apiKey:'test',fetchImpl:async()=>{throw Object.assign(Error('raw'),{name:'TimeoutError'});}},'TIMEOUT'],
  [{apiKey:'test',fetchImpl:async()=>({status:502,ok:false,json:async()=>{throw Error('bad body');}})},'INVALID_RESPONSE']
 ];
 for(const [options,code] of scenarios)await assert.rejects(()=>new PlaceSearchService(options).textSearch({query:'place'}),e=>e.diagnostic.code===code);
});
