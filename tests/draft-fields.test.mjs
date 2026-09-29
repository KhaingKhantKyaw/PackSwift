import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context={window:{}};
vm.runInNewContext(readFileSync(new URL('../public/js/trip-draft-gate.js',import.meta.url),'utf8'),context);
const {captureFields,restoreFields}=context.window.PackSwiftDraft;
const make=()=>({elements:[
 {id:'origin-search',tagName:'INPUT',name:'origin',type:'search',value:'Bangkok',disabled:false,dataset:{}},
 {id:'destination-search',tagName:'INPUT',name:'destination',type:'search',value:'Hanoi',disabled:false,dataset:{}},
 {id:'domestic-destination',tagName:'INPUT',name:'destination',type:'hidden',value:'Yangon',disabled:true,dataset:{}},
 {id:'budget',tagName:'INPUT',name:'budget',type:'text',value:'1,898',disabled:false,dataset:{}}
]});
for(const legacy of [false,true])test(`Hanoi is not overwritten by hidden Yangon (${legacy?'legacy':'new'} draft)`,()=>{
 const source=make();const saved=captureFields(source);if(legacy)saved.forEach(s=>{delete s.id;delete s.disabled;});
 const target=make();target.elements[1].value='';target.elements[1].dataset.internationalValue='Tokyo';
 restoreFields(target,saved);
 assert.equal(target.elements[1].value,'Hanoi');assert.equal(target.elements[1].dataset.internationalValue,'Hanoi');
 assert.equal(target.elements[2].value,'Yangon');assert.equal(target.elements[2].disabled,true);
 assert.equal(target.elements[0].value,'Bangkok');assert.equal(target.elements[3].value,'1,898');
});
