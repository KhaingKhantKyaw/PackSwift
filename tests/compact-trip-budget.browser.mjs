import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',route=>route.fulfill({json:new URL(route.request().url()).pathname==='/api/auth/me'?{user:null}:{items:[],places:[],itinerary:[]}}));
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:3000')+'/trip-planner');await page.waitForSelector('.compact-trip-finish');
 const summary=page.locator('.compact-trip-estimate'),bar=page.locator('.compact-trip-finish');
 assert.equal(await page.getByRole('heading',{name:'Finish your plan',exact:true}).count(),0);
 await summary.getByText('Budget optional · add later',{exact:true}).waitFor();
 assert.equal(await bar.locator('input,select').count(),0);
 const apply=costs=>page.evaluate(costs=>{const f=document.getElementById('trip-planner-form');for(const [k,v]of Object.entries({origin:'Yangon',destination:'Bangkok',startDate:'2027-12-12',endDate:'2027-12-16',currency:'USD'}))f.elements[k].value=v;const costContext=['origin','destination','startDate','endDate','adults','children','childAges'].map(k=>f.elements[k]?.value||'').join('|');f.elements.planningSupport.value=JSON.stringify({costs,costCurrency:'USD',costContext});f.dispatchEvent(new Event('input',{bubbles:true}));},costs);
 await apply({flights:100,stay:200,daily:30});await summary.getByText('Estimated total: USD 450',{exact:true}).waitFor();
 await bar.getByText('View breakdown',{exact:true}).click();await bar.getByText('USD 150 · USD 30/day × 5 days',{exact:true}).waitFor();
 assert.match(await bar.innerText(),/My Trips → Open trip → Budget|Confirm prices/);
 await bar.getByText('View breakdown',{exact:true}).click();
 await apply({flights:100,stay:'',daily:30});await summary.getByText('Partial estimate: USD 250',{exact:true}).waitFor();
 await page.locator('#origin-search').fill('Singapore');await summary.getByText('Estimate needs review',{exact:true}).waitFor();
 await apply({flights:0,stay:0,daily:0});await summary.getByText('Estimated total: USD 0',{exact:true}).waitFor();
 await apply({daily:30});await page.locator('#start-date').evaluate(n=>{n.value='';n.dispatchEvent(new Event('input',{bubbles:true}));});await summary.getByText('Estimate needs review',{exact:true}).waitFor();
 for(const width of [1440,390])for(const theme of ['light','dark']){await page.setViewportSize({width,height:900});await page.evaluate(t=>PackSwift.setThemePreference(t),theme);await bar.scrollIntoViewIfNeeded();const position=await bar.evaluate(n=>getComputedStyle(n).position);assert.equal(position,'static');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if(width===390){const b=await bar.locator('.compact-save-trip').boundingBox(),r=await summary.boundingBox();assert.ok(b.y>=r.y+r.height);assert.ok(Math.abs(b.width-(await bar.evaluate(n=>n.clientWidth-parseFloat(getComputedStyle(n).paddingLeft)-parseFloat(getComputedStyle(n).paddingRight))))<2);}await page.screenshot({path:`/tmp/packswift-compact-budget-${width}-${theme}.png`});}
 assert.deepEqual(errors,[]);console.log('PASS: compact optional estimate, complete/partial/zero/stale costs, collapsed breakdown, no duplicate editors, normal flow, mobile save and themes.');
}finally{await browser.close();}
