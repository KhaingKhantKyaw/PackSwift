import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/trip-planner.html',import.meta.url),'utf8');
test('new planner has six steps and no legacy planner controllers',()=>{
 assert.equal((html.match(/class="studio-step"/g)||[]).length,6);
 for(const legacy of ['trip-planner.js','live-preview.js','detail-planning.js','trip-workspace.js','dynamic-budget.js'])assert.equal(html.includes(`/js/${legacy}`),false);
 assert.ok(html.includes('/js/planner-studio.js'));
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
 assert.equal((html.match(/name="destination"/g)||[]).length,1);
});
