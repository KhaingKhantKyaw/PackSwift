// Opt-in rendered regression; uses the existing local server and no mock trip data.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
const base=process.env.PLANNER_TEST_URL||'http://127.0.0.1:3000';
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/trip-planner?destination=Bangkok');
 await page.waitForSelector('.calendar-day');
 await page.locator('#origin-search').fill('Yangon');
 await page.evaluate(()=>{document.querySelector('#start-date').value='2026-12-03';document.querySelector('#end-date').value='2026-12-10';document.querySelector('#trip-planner-form').dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#studio-next').click();
 await page.locator('#adults').fill('2');
 await page.locator('#passport-country').fill('Myanmar');
 await page.locator('#studio-next').click();
 await page.locator('#currency').selectOption('THB');
 await page.locator('#budget').fill('30000');
 await page.locator('#studio-next').click();
 await page.locator('#trip-notes').fill('Culture, food and beaches');
 await page.locator('#studio-next').click();
 assert.equal(await page.locator('[data-step="4"]').isVisible(),true);
 await page.locator('#studio-next').click();
 assert.equal(await page.locator('[data-step="5"]').isVisible(),true);
 await page.locator('#studio-next').click();
 assert.equal(await page.locator('[data-step="6"]').isVisible(),true);
 await page.locator('#studio-back').click();
 await page.locator('#studio-back').click();
 assert.equal(await page.locator('[data-step="4"]').isVisible(),true);
 await page.locator('[data-step-button="0"]').click();
 await page.waitForFunction(()=>document.querySelector('#workspace-metrics').textContent.includes('30,000'));
 assert.match(await page.locator('#studio-summary').innerText(),/Yangon → Bangkok/);
 assert.match(await page.locator('#studio-summary').innerText(),/7 nights · 2 travellers/);
 assert.equal(await page.locator('#workspace-metrics').count(),1);
 assert.equal(await page.locator('#studio-summary .workspace-stats').count(),0);
 for(const target of ['workspace-itinerary','workspace-map','workspace-packing','studio-checks','studio-summary']) {
  await page.locator(`[data-workspace-target="${target}"]`).click();
  assert.equal(await page.locator(`[data-workspace-target="${target}"]`).getAttribute('aria-current'),'page');
  assert.equal(await page.locator('#'+target).count(),1);
 }
 await page.reload();await page.waitForSelector('.calendar-day');
 assert.equal(await page.locator('#origin-search').inputValue(),'Yangon');
 assert.equal(await page.locator('#budget').inputValue(),'30000');
 for(const [width,height] of [[1440,900],[1366,768],[1280,800],[1024,768],[768,1024],[390,844]]) {
  await page.setViewportSize({width,height});
  for(const theme of ['light','dark']) {
   await page.evaluate(t=>{PackSwift.setThemePreference(t);scrollTo(0,0)},theme);
   await page.waitForTimeout(100);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width} ${theme}: horizontal overflow`);
   assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.studio-dashboard')).overflowY),'visible');
   const calendar=await page.locator('.compact-trip-calendar').boundingBox();assert.ok(calendar.x>=0&&calendar.x+calendar.width<=width);
   await page.screenshot({path:`/tmp/planner-editorial-${width}-${theme}.png`,fullPage:true});
  }
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: route/dates/travelers/budget synchronization, steps 0–5, Back, tab targets, reload persistence, six viewports, both themes, no horizontal overflow or JavaScript errors.');
} finally {await browser.close();}
