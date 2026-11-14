import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../public/js/emergency-directory.js';
import {auditEmergencyDirectory} from '../scripts/audit-emergency-contacts.mjs';
const model=globalThis.PackSwiftEmergencyDirectory,data=JSON.parse(await readFile(new URL('../public/data/emergency-contacts.json',import.meta.url),'utf8'));
test('all countries and territories selectable; reviewed coverage is explicit',()=>{
 assert.equal(model.countries.length,250);assert.equal(new Set(model.countries.map(c=>c.code)).size,250);assert.equal(model.validate(data),data);
 assert.equal(new Set(data.groups.flatMap(g=>g.countries)).size,36);
 assert.equal(model.countryCode('USA'),'US');assert.equal(model.countryCode('United Kingdom'),'GB');assert.equal(model.countryCode('UAE'),'AE');
 assert.equal(model.countryCode('Paris'),'','Ambiguous city is not a country');
});
test('national and regional scope must not leak to territories',()=>{
 const now=new Date('2026-11-14');assert.equal(model.lookup(data,'France',now).contacts[0].number,'112');
 assert.equal(model.lookup(data,'French Polynesia',now).contacts.length,0);
 assert.equal(model.lookup(data,'Myanmar',now).status,'missing');
 assert.equal(model.lookup(data,'not a country',now).status,'unknown');
 assert.equal(model.lookup(data,'Japan',now).contacts[0].number,'110');
});
test('old sources warn instead of pretending to be current; future reviews are not trusted',()=>{
 assert.equal(model.lookup(data,'TH',new Date('2027-05-01')).status,'review-due');
 assert.equal(model.lookup(data,'TH',new Date('2020-01-01')).contacts.length,0);
});
test('bad numbers, sources, duplicated areas and impossible dates fail closed',()=>{
 for(const mutate of [g=>g.contacts[0].number='javascript:1',g=>g.source='https://127.0.0.1/private',g=>g.verifiedAt='2026-02-31',g=>g.countries.push(g.countries[0])]){
  const broken=structuredClone(data);mutate(broken.groups[0]);assert.throws(()=>model.validate(broken));
 }
});
test('source auditing never verifies, mutates or follows source redirects',async()=>{
 const raw=JSON.stringify(data),calls=[];
 const report=await auditEmergencyDirectory(data,{checkSources:true,now:new Date('2026-11-14'),fetcher:async(url,opts)=>{calls.push(opts);return {status:200,headers:new Headers(),text:async()=>'<html>Changed content</html>'};}});
 assert.equal(JSON.stringify(data),raw);assert.equal(report.coveredAreas,36);assert.ok(report.missingAreas.length>0);assert.ok(calls.every(o=>o.redirect==='manual'));assert.ok(report.sources.every(s=>s.humanReviewRequired&&s.status.includes('needs-review')));
});
