import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=f=>readFile(new URL('../public/'+f,import.meta.url),'utf8');
test('destination introductions are short without deleting interactive content',async()=>{
 const home=await read('js/home-slider.js');
 const descriptions=[...home.matchAll(/description:\s*["']([^"'\n]+)["']/g)].map(m=>m[1]);
 assert.equal(descriptions.length,9);assert.ok(descriptions.every(s=>s.length<=65));
 const html=await read('index.html');for(const id of ['slider-plan','slider-save','slider-search-results','slider-description'])assert.ok(html.includes('id="'+id+'"'));
});
test('safety, privacy, estimates and accessible status remain explicit',async()=>{
 const [dashboard,emergency,budget,profile,login,theme]=await Promise.all(['js/user-dashboard.js','js/emergency-directory.js','js/planning-support.js','profile.html','login.html','css/website-theme.css'].map(read));
 assert.match(dashboard,/Personal review—not visa approval/);
 assert.match(dashboard,/Private until shared/);assert.match(dashboard,/Original amounts stay unchanged/);
 assert.match(emergency,/Never make test calls/);assert.match(emergency,/Live availability is not confirmed/);
 assert.match(budget,/Estimate only\. Confirm prices before booking/);
 assert.match(profile,/id="dashboard-status" role="status"/);assert.match(login,/autocomplete="current-password"/);
 assert.match(theme,/:empty:not\(\[role\]\)/);
});
