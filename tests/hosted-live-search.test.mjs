import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/hosted-worker.mjs';

const origin = 'https://packswift.test', oneDay = 86400000;
const day = n => new Date(Date.now()+n*oneDay).toISOString().slice(0,10);
const trip = {origin:'Bangkok',destination:'Tokyo',startDate:day(40),endDate:day(44),adults:2,children:0,travelStyle:'Balanced'};
const bindings = {GOOGLE_PLACES_API_KEY:'test-only-places-provider-key',SERPAPI_API_KEY:'test-only-booking-provider-key'};
// No env.DB, account cookie, real keys, or network access.
function send(path,{method='GET',body,headers={},env=bindings}={}) {
  const init = {method,headers:{'CF-Connecting-IP':'192.0.2.1',...headers}};
  if (body !== undefined) {init.body=typeof body==='string'?body:JSON.stringify(body); init.headers['Content-Type'] ??= 'application/json';}
  return worker.fetch(new Request(origin+path,init),env);
}

test('hosted guest can fetch flight and nearby-stay results in the origin currency',async t=>{
  const upstream=[];
  t.mock.method(globalThis,'fetch',async input=>{
    const u=new URL(input); upstream.push(u.searchParams.get('engine'));assert.equal(u.hostname,'serpapi.com');
    assert.equal(u.searchParams.get('currency'),'THB');assert.equal(u.searchParams.get('api_key'),bindings.SERPAPI_API_KEY);
    if (upstream.at(-1)==='google_flights')return Response.json({other_flights:[{price:8400,flights:[{airline:'Test Air'}]}]});
    assert.match(u.searchParams.get('q'),/Shibuya/);
    return Response.json({properties:[{name:'Test inn',total_rate:{extracted_lowest:3550}}]});
  });
  for (const [kind,title,price] of [['flights','Test Air','THB 8,400'],['hotels','Test inn','THB 3,550']]) {
    const r=await send('/api/booking-search/'+kind,{method:'POST',body:{...trip,stayNear:'Shibuya'}});
    assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
    const data=await r.json();assert.equal(data.items[0].title,title);assert.equal(data.items[0].price,price);
    assert.ok(!JSON.stringify(data).includes(bindings.SERPAPI_API_KEY));
  }
  assert.deepEqual(upstream,['google_flights','google_hotels']);
});

test('hosted activities, photo, and stay-near suggestions work without login or a database',async t=>{
  const id='test_activity_123';let searches=0;
  t.mock.method(globalThis,'fetch',async (input,init)=>{
    const url=new URL(input);
    assert.equal(url.hostname,'places.googleapis.com');assert.equal(new Headers(init.headers).get('x-goog-api-key'),bindings.GOOGLE_PLACES_API_KEY);
    if (url.pathname.endsWith(':searchText')) {
      searches++;assert.match(JSON.parse(init.body).textQuery,/Bangkok/);
      return Response.json({places:[{id,displayName:{text:'Bangkok Market'},photos:[{authorAttributions:[{displayName:'Photographer'}]}]}]});
    }
    if(url.pathname.endsWith(':autocomplete')) return Response.json({suggestions:[{placePrediction:{placeId:id,structuredFormat:{mainText:{text:'Bangkok Market'}}}}]});
    if(url.pathname.endsWith('/media')) return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/jpeg'}});
    return Response.json({photos:[{name:'places/'+id+'/photos/test_photo'}]});
  });
  for (const extra of ['', '&purpose=Food%2C+Drink+%26+Culinary','&purpose=Food%2C+Drink+%26+Culinary&style=Pocket+Friendly']) {
    const result=await send('/api/places/popular-activities?destination=Bangkok'+extra);
    assert.equal(result.status,200);const data=await result.json();assert.equal(data.items[0].name,'Bangkok Market');
    assert.equal(data.items[0].imageUrl,'/api/activities/photo/'+id);
  }
  assert.equal(searches,3);
  const r=await send('/api/activities/photo/'+id);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/jpeg');assert.equal((await r.arrayBuffer()).byteLength,3);
  const near=await send('/api/places/transport-autocomplete?q=market&destination=Bangkok');assert.equal(near.status,200);assert.equal((await near.json())[0].name,'Bangkok Market');
});

test('hosted live search rejects oversized/invalid inputs and mismatched origin without forwarding',async t=>{
  const mock=t.mock.method(globalThis,'fetch',async()=>assert.fail('should not call provider'));
  for(const [path,options,status] of [
    ['/api/booking-search/flights',{},405],
    ['/api/booking-search/hotels',{method:'POST',body:trip,headers:{Origin:'https://elsewhere.test'}},403],
    ['/api/booking-search/hotels',{method:'POST',body:'query',headers:{'Content-Type':'text/plain'}},415],
    ['/api/booking-search/hotels',{method:'POST',body:'x'.repeat(16500)},413],
    ['/api/booking-search/hotels',{method:'POST',body:'{}!',env:{}},400],
    ['/api/places/popular-activities?destination=Bangkok&style=unknown',{},422],
    ['/api/places/transport-autocomplete?q=x',{},422],
    ['/api/activities/photo/x',{},422],
  ]) {
    const r=await send(path,options);assert.equal(r.status,status);assert.ok((await r.json()).message);
  }
  assert.equal(mock.mock.callCount(),0);
});

test('hosted missing configuration returns actionable JSON and the IP search limit still applies',async t=>{
  const mock=t.mock.method(globalThis,'fetch',async()=>assert.fail('should not call provider'));
  const args={env:{},headers:{'CF-Connecting-IP':'192.0.2.6'}};
  for(let i=0;i<6;i++) {
    const r=await send('/api/booking-search/flights',{...args,method:'POST',body:trip});
    assert.equal(r.status,503);assert.match((await r.json()).error,/configured/i);
  }
  const limited=await send('/api/booking-search/hotels',{...args,method:'POST',body:trip});
  assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))>0);
  const missing=await send('/api/places/transport-autocomplete?q=park',args);
  assert.equal(missing.status,503);assert.equal((await missing.json()).code,'MISSING_API_KEY');assert.equal(mock.mock.callCount(),0);
});
