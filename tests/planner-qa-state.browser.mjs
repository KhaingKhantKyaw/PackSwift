import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
try {
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.PLANNER_TEST_URL||'http://127.0.0.1:3000')+'/trip-planner');
 await page.waitForSelector('.calendar-day');
 await page.locator('#readiness-0').check();
 await page.reload();await page.waitForSelector('.calendar-day');
 assert.equal(await page.locator('#readiness-0').isChecked(),true,'Checklist must survive refresh without editing the form');
 assert.match(await page.locator('#studio-ready-count').textContent(),/^1 \/ 10$/);
 await page.locator('#destination-search').fill('Bangkok');
 // Cancel a scheduled calculation by clearing the range before the debounce fires.
 await page.evaluate(()=>{
  const f=document.querySelector('#trip-planner-form');
  f.elements.startDate.value='2026-12-03';f.elements.endDate.value='2026-12-10';
  f.dispatchEvent(new Event('input',{bubbles:true}));
  f.elements.endDate.value='';f.dispatchEvent(new Event('input',{bubbles:true}));
 });
 assert.equal(await page.locator('#studio-state').textContent(),'Choose your route and dates');
 assert.equal(await page.locator('#studio-dashboard-content').evaluate(e=>e.classList.contains('is-recalculating')),false);
 await page.locator('#origin-search').fill('Yangon');
 await page.evaluate(()=>{const f=document.querySelector('#trip-planner-form');for(const [name,value]of Object.entries({endDate:'2026-12-10',passportCountry:'Myanmar',budget:'30000'}))f.elements[name].value=value;f.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('[data-step-button="4"]').click();
 for(const [status,body,expected]of [[429,JSON.stringify({message:'Too many place searches. Please wait a minute and try again.'}),'Too many place searches'],[502,'upstream unavailable','unreadable response']]){
  await page.route('**/api/places/autocomplete?**',route=>route.fulfill({status,contentType:'application/json',body}));
  await page.locator('#global-place-search').fill('Test failure '+status);
  await page.waitForFunction(text=>document.querySelector('.place-search [role="status"]').textContent.includes(text),expected);
  await page.unroute('**/api/places/autocomplete?**');
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: independent checklist persistence; canceled/invalid date range clears loading state; actionable rate-limit and malformed-response errors.');
} finally {await browser.close();}
