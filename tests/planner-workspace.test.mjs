import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/js/planner-workspace.js',import.meta.url),'utf8');
const context={window:{},document:{addEventListener(){}},fetch:()=>Promise.resolve({ok:true,json:()=>[]})};
vm.runInNewContext(source,context);
test('budget allocations sum to the selected budget without the sample arithmetic error',()=>{
 for(const total of [0,1,8,28400,30800,123456]){
 const rows=context.window.PackSwiftWorkspace.breakdown(total);
 assert.equal(rows.reduce((sum,row)=>sum+row.amount,0),total);
 assert.ok(rows.every(row=>row.amount>=0));
 }
});
