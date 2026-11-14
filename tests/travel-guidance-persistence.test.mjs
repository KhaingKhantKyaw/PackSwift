import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlannerDraft,scheduleSignature} from '../src/services/planner-draft.js';
const model=globalThis.PackSwiftTravelGuidanceModel;
const input={origin:'Yangon',destination:'Bangkok',startDate:'2027-01-01',endDate:'2027-01-06',adults:'2',children:'0',currency:'USD'};
const body=extra=>({fields:Object.entries({...input,...extra}).map(([name,value])=>({name,value,type:name==='travelGuidance'?'hidden':'text'})),selected:[]});
test('saved trip preserves guidance and user-confirmed preparation but strips unknown fields',()=>{
 const task=model.tasks(input)[0],state={version:1,experience:'first',detailLevel:'quick',preparation:{bookings:task.context,unknown:'done'},unsafe:'ignored'};
 const draft=normalizePlannerDraft(body({travelGuidance:JSON.stringify(state)}));
 const stored=JSON.parse(draft.details.fields.find(f=>f.name==='travelGuidance').value);
 assert.deepEqual(stored,{version:1,experience:'first',detailLevel:'quick',preparation:{bookings:task.context}});
 assert.equal(model.tasks({...input,travelGuidance:stored})[0].checked,true);
});
test('guidance changes never invalidate the itinerary or imply completion of packing',()=>{
 const initial=normalizePlannerDraft(body({})),changed=normalizePlannerDraft(body({travelGuidance:JSON.stringify({experience:'experienced',detailLevel:'detailed',preparation:{weather:'checked'}})}));
 assert.equal(scheduleSignature(initial.details),scheduleSignature(changed.details));
 assert.deepEqual(changed.packing,[]);assert.equal(changed.budget,null);
});
test('malformed guidance safely restores an unselected experience',()=>{
 const draft=normalizePlannerDraft(body({travelGuidance:'not json'}));
 assert.deepEqual(JSON.parse(draft.details.fields.find(f=>f.name==='travelGuidance').value),model.normalize());
});
