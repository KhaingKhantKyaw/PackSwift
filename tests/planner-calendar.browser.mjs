import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const{chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
try{const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.clock.install({time:new Date('2026-10-10T12:00:00Z')});
 await page.goto((process.env.PLANNER_TEST_URL||'http://127.0.0.1:3000')+'/trip-planner?destination=Bangkok');await page.waitForSelector('.calendar-day');
 assert.equal(await page.locator('[data-date="2026-10-09"]').isDisabled(),true);
 assert.equal(await page.locator('[data-date="2026-10-10"]').getAttribute('aria-current'),'date');
 const height=await page.locator('.compact-trip-calendar').evaluate(e=>e.clientHeight);
 await page.locator('[data-date="2026-10-18"]').click();assert.equal(await page.locator('#start-date').inputValue(),'2026-10-18');assert.match(await page.locator('.calendar-selection').innerText(),/Select return date/);
 await page.locator('[data-date="2026-10-28"]').click();assert.equal(await page.locator('.calendar-day.in-range').count(),9);assert.match(await page.locator('.calendar-selection').innerText(),/10 nights/);
 assert.equal(await page.locator('.compact-trip-calendar').evaluate(e=>e.clientHeight),height);
 assert.match(await page.locator('#studio-summary').innerText(),/10 nights/);
 await page.getByRole('button',{name:'Clear Dates',exact:true}).click();assert.equal(await page.locator('#end-date').inputValue(),'');assert.equal(await page.getByRole('button',{name:'Clear Dates',exact:true}).isDisabled(),true);
 for(let n=0;n<2;n++)await page.getByRole('button',{name:'Next month',exact:true}).click();
 await page.locator('[data-date="2026-12-18"]').click();await page.getByRole('button',{name:'Next month',exact:true}).click();await page.locator('[data-date="2027-01-03"]').click();assert.match(await page.locator('.calendar-selection').innerText(),/16 nights/);
 await page.getByRole('button',{name:'Previous month',exact:true}).click();assert.equal(await page.locator('[data-date="2026-12-18"]').getAttribute('aria-pressed'),'true');
 for(const [width,h]of[[1440,900],[1366,768],[1280,800],[1024,768],[768,1024],[390,844]]){await page.setViewportSize({width,height:h});for(const theme of['light','dark']){await page.evaluate(t=>PackSwift.setThemePreference(t),theme);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.locator('.calendar-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),7);await page.locator('.planner-date-card').screenshot({path:`/tmp/calendar-${width}-${theme}.png`});}}
 console.log('PASS: start/end, continuous row-spanning range, clear, past disabled, today, month/year crossing, duration and preview, stable height, six widths and both themes.');
}finally{await browser.close();}
