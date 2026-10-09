import test from 'node:test';import assert from 'node:assert/strict';
import {fetchGooglePlacePhoto,normalizeGooglePlace} from '../src/services/google-places-service.js';
test('photo proxy requests photos and bounded media size without a browser key',async()=>{
 const calls=[];const photo=await fetchGooglePlacePhoto('test-place',{apiKey:'test-key-for-photo-tests-only',fetchImpl:async(url,options)=>{calls.push({url,options});return calls.length===1?{ok:true,json:async()=>({photos:[{name:'places/test/photos/one'}]})}:{ok:true};}});
 assert.ok(photo);assert.equal(calls[0].options.headers['x-goog-fieldmask'],'photos');assert.match(calls[1].url,/maxWidthPx=720/);assert.ok(!calls[1].url.includes('test-key'));
});
test('missing photo is distinct from provider configuration failure',async()=>{
 assert.equal(await fetchGooglePlacePhoto('test',{apiKey:'test-key-for-photo-tests-only',fetchImpl:async()=>({ok:true,json:async()=>({})})}),null);
 await assert.rejects(fetchGooglePlacePhoto('test',{apiKey:'test-key-for-photo-tests-only',fetchImpl:async()=>({ok:false,status:403})}),e=>e.code==='PHOTO_CONFIGURATION'&&e.providerStatus===403);
});
test('normalization preserves author names and profile links',()=>{
 const p=normalizeGooglePlace({id:'test',displayName:{text:'Test'},photos:[{authorAttributions:[{displayName:'Photographer',uri:'https://maps.google.com/contrib/test'}]}]});assert.equal(p.imageAuthors[0].name,'Photographer');assert.equal(p.imageUrl,'/api/activities/photo/test');
});
