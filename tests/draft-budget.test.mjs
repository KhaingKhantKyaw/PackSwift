import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('draft restoration preserves custom budget through local and async estimates',async()=>{
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'7777',dataset:{},addEventListener(){}});return nodes.get(id);};
 const fields={destination:'Bangkok',startDate:'2026-12-16',endDate:'2027-01-03',adults:'2',children:'1',planningGoal:'best-value'};
 const estimate={recommended:18000,totalEstimate:18000,totalNights:18,dailyAverage:1000,minimumViable:9000,currency:'THB',demandLevel:'Moderate'};
 let callback;const writes=[];
 const context={document:{getElementById:node},FormData:class{get(key){return fields[key];}},Intl,AbortController,window:{PackSwiftRestoringDraft:true},PackSwiftCostEngine:{calculateTripEstimate:()=>estimate},setTimeout:fn=>{callback=fn;},clearTimeout(){},setBudgetValue:n=>writes.push(n),updateBudgetMinimum(){},updateLiveTripPreview(){},fetch:async()=>({ok:true,json:async()=>estimate})};
 vm.runInNewContext(readFileSync(new URL('../public/js/dynamic-budget.js',import.meta.url),'utf8'),context);
 context.window.PackSwiftRestoringDraft=false;await callback();
 assert.deepEqual(writes,[],'neither local nor late API estimate may replace restored budget');
 fields.endDate='2027-01-04';context.window.refreshDynamicBudget();await callback();
 assert.deepEqual(writes,[18000,18000],'a subsequent deliberate date change still recalculates normally');
});
