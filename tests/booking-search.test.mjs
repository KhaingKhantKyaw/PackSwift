import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parameters,normalize,searchBooking,safeLink} from '../src/services/booking-search.js';
const input={origin:'Bangkok',destination:'Tokyo',startDate:'2027-12-01',endDate:'2027-12-08',adults:2,children:0,currency:'JPY'};
test('accepts qualified city labels and style sorting',()=>{assert.equal(parameters('flights',{...input,destination:'Tokyo, Japan',travelStyle:'Pocket Friendly'}).arrival_id,'TYO');assert.equal(parameters('flights',{...input,travelStyle:'Pocket Friendly'}).sort_by,2);assert.equal(parameters('flights',{...input,travelStyle:'Comfort & Value'}).sort_by,5);assert.equal(parameters('hotels',{...input,travelStyle:'Ultimate Luxury'}).sort_by,8);assert.match(parameters('hotels',{...input,stayNear:'Ueno Park'}).q,/Ueno Park.*Tokyo/);});
test('sorts all returned flight groups before limiting results',async()=>{const result=await searchBooking('flights',{...input,travelStyle:'Pocket Friendly'},{key:'test',fetcher:async()=>({ok:true,json:async()=>({best_flights:[{price:900}],other_flights:[{price:100}]})})});assert.equal(result.items[0].price,'THB 100');});
test('maps dates, passengers and city codes',()=>{const p=parameters('flights',input);assert.equal(p.departure_id,'BKK');assert.equal(p.arrival_id,'TYO');assert.equal(p.return_date,input.endDate);assert.equal(p.adults,2);});
test('validates dates and child ages before consuming quota',()=>{assert.throws(()=>parameters('hotels',{...input,startDate:'2027-02-30'}));assert.throws(()=>parameters('hotels',{...input,children:1}));assert.equal(parameters('hotels',{...input,children:1,childAges:[5]}).children_ages,'5');});
test('safe normalized data excludes provider secrets and unsafe URLs',()=>{assert.equal(safeLink('javascript:alert(1)'),null);const result=normalize('hotels',{properties:[{name:'Hotel',total_rate:{lowest:'THB 1000'},link:'https://example.com'}],secret:'secret'},'THB');assert.equal(result.items[0].price,'THB 1,000');assert.ok(!JSON.stringify(result).includes('secret'));});
test('caches identical searches and sends key only to provider',async()=>{let calls=0;const fetcher=async url=>{calls++;assert.equal(url.searchParams.get('api_key'),'private-key');return {ok:true,json:async()=>({best_flights:[{price:123,flights:[{airline:'Example'}]}]})};};const options={key:'private-key',fetcher};await searchBooking('flights',input,options);const result=await searchBooking('flights',input,options);assert.equal(calls,1);assert.equal(result.cached,true);assert.ok(!JSON.stringify(result).includes('private-key'));});
test('missing configuration fails safely',async()=>{await assert.rejects(searchBooking('hotels',input,{key:''}),/not configured/);});
test('both searches follow origin currency, not destination or saved budget currency',()=>{
 for(const kind of ['flights','hotels']){
  assert.equal(parameters(kind,input).currency,'THB');
  assert.equal(parameters(kind,{...input,origin:'Paris',currency:'USD'}).currency,'EUR');
  assert.equal(parameters(kind,{...input,origin:'HAN'}).currency,'VND');
  assert.equal(parameters(kind,{...input,origin:'Yangon'}).currency,'USD','Unsupported MMK uses a USD quote for a separately labelled estimate');
  assert.throws(()=>parameters(kind,{...input,origin:'Unknown city'}),/recognized origin/);
 }
});
test('hotel numeric quotes use explicit ISO codes and preserve total versus nightly meaning',()=>{
 const result=normalize('hotels',{search_parameters:{currency:'THB'},properties:[{name:'Total',total_rate:{lowest:'฿1,234.50',extracted_lowest:1234.5}},{name:'Nightly',rate_per_night:{lowest:'฿500',extracted_lowest:500}},{name:'Mismatch',total_rate:{lowest:'USD 50',extracted_lowest:50}}]},'THB');
 assert.equal(result.items[0].price,'THB 1,234.5');assert.match(result.items[0].priceLabel,/stay total/);
 assert.equal(result.items[1].price,'THB 500');assert.match(result.items[1].priceLabel,/Per night/);
 assert.equal(result.items[2].amount,null);assert.match(result.items[2].price,/currency differs/);
 assert.throws(()=>normalize('flights',{search_parameters:{currency:'USD'},best_flights:[{price:100}]},'THB'),/different currency/);
});
const rate=async target=>({rate:2100,base:'USD',target,updatedAt:new Date().toISOString()});
test('unsupported origin currency has a dated estimate with the original quote',async()=>{
 for(const kind of ['flights','hotels']){
  const result=await searchBooking(kind,{...input,origin:'Yangon',startDate:'2027-12-02'},{key:'test',rateProvider:rate,fetcher:async url=>{
   assert.equal(url.searchParams.get('currency'),'USD');
   return {ok:true,json:async()=>({search_parameters:{currency:'USD'},best_flights:[{price:100}],properties:[{name:'Hotel',total_rate:{lowest:'$100',extracted_lowest:100}}]})};
  }});
  assert.equal(result.currency,'MMK');assert.equal(result.originCurrency,'MMK');assert.equal(result.items[0].price,'≈ MMK 210,000');assert.equal(result.items[0].originalPrice,'USD 100');assert.equal(result.items[0].estimated,true);assert.ok(result.conversion.updatedAt);
 }
});
test('failed or stale conversion keeps USD quotes, never falsely labels them MMK',async()=>{
 for(const [index,rateProvider]of [async()=>{throw Error('No rate');},async()=>({...(await rate('MMK')),updatedAt:'2020-01-01'})].entries()){
  const result=await searchBooking('flights',{...input,origin:'Yangon',startDate:`2027-12-0${3+index}`},{key:'test',rateProvider,fetcher:async()=>({ok:true,json:async()=>({best_flights:[{price:125}]})})});
  assert.equal(result.currency,'USD');assert.equal(result.items[0].price,'USD 125');assert.equal(result.items[0].estimated,undefined);assert.match(result.currencyNotice,/MMK conversion is unavailable/);
 }
});
test('hotel cache separates unsupported origin currencies sharing a USD provider query',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return {ok:true,json:async()=>({properties:[{name:'Hotel',total_rate:{extracted_lowest:100}}]})};};
 const route={...input,startDate:'2027-12-05'};
 const a=await searchBooking('hotels',{...route,origin:'Yangon'},{key:'test',fetcher,rateProvider:rate});
 const b=await searchBooking('hotels',{...route,origin:'Nairobi'},{key:'test',fetcher,rateProvider:async target=>({...await rate(target),rate:130})});
 assert.equal(calls,2);assert.match(a.items[0].price,/MMK/);assert.match(b.items[0].price,/KES/);
});
test('Google Flights compare link carries provider quote currency',()=>{
 const result=normalize('flights',{search_metadata:{google_flights_url:'https://www.google.com/travel/flights?curr=USD'},best_flights:[{price:100}]},'THB');
 assert.equal(new URL(result.items[0].url).searchParams.get('curr'),'THB');
});
test('route labels with diacritics, comma spacing and catalog codes work for live searches',()=>{
 const p=parameters('flights',{...input,origin:' Zürich ',destination:'  HAN , Vietnam '});
 assert.equal(p.departure_id,'ZRH');assert.equal(p.arrival_id,'HAN');assert.equal(p.currency,'CHF');
 assert.equal(parameters('hotels',{...input,origin:'Zürich'}).currency,'CHF');
 assert.throws(()=>parameters('flights',{...input,destination:'Hanoi, Thailand'}),/two different cities/);
});
test('provider reports of successful-but-empty results are not mistaken for outages',async()=>{
 for(const kind of ['flights','hotels']){
  const result=await searchBooking(kind,{...input,origin:'Rome',destination:'Paris'},{key:'test',fetcher:async()=>({ok:true,json:async()=>({search_metadata:{status:'Success'},error:"Google hasn't returned any results for this query."})})});
  assert.deepEqual(result.items,[]);assert.equal(result.currency,'EUR');
 }
});
test('provider authorization, limits and malformed payloads are distinguishable and safe to retry',async()=>{
 const route={...input,origin:'Sydney',destination:'Paris'};
 for(const [response,status]of [
  [{ok:false,status:403,json:async()=>{throw Error('not JSON');}},503],
  [{ok:false,status:429,json:async()=>{throw Error('not JSON');}},429],
  [{ok:true,json:async()=>({})},502],
  [{ok:true,json:async()=>({search_metadata:{status:'Processing'}})},502],
  [{ok:true,json:async()=>({properties:'not a result list'})},502],
  [{ok:true,json:async()=>({error:'private-key'})},502]
 ]){
  await assert.rejects(searchBooking('hotels',route,{key:'test',fetcher:async()=>response}),e=>e.status===status&&!e.message.includes('private-key'));
 }
 const result=await searchBooking('hotels',route,{key:'test',fetcher:async()=>({ok:true,json:async()=>({properties:[null,{name:'Available stay',total_rate:{extracted_lowest:250}}]})})});
 assert.equal(result.items.length,1);assert.equal(result.items[0].title,'Available stay');assert.equal(result.items[0].price,'AUD 250');
});
