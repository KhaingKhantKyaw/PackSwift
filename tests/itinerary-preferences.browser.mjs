import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
try{
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/generate-itinerary',route=>route.fulfill({json:{days:[{activities:Array.from({length:6},(_,i)=>({id:'test-place-'+i,title:'Test Place '+(i+1),isSample:true}))}]}}));
 await page.goto((process.env.PLANNER_TEST_URL||'http://127.0.0.1:3001')+'/trip-planner?destination=Bangkok');
 await page.waitForSelector('.calendar-day');await page.waitForFunction(()=>document.querySelector('#currency').value==='THB');
 await page.locator('#origin-search').fill('Yangon');
 // Use the ISO-backed inputs to keep this test independent of the current month.
 await page.evaluate(()=>{document.querySelector('#start-date').value='2026-12-16';document.querySelector('#end-date').value='2026-12-20';document.querySelector('#trip-planner-form').dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#studio-next').click();await page.locator('#passport-country').fill('Myanmar');await page.locator('#studio-next').click();await page.locator('#budget').fill('30000');
 await page.locator('[data-step-button="4"]').click();await page.locator('#studio-find').click();
 for(let i=0;i<6;i++){await page.getByRole('button',{name:'+ Add',exact:true}).first().click();await page.waitForTimeout(220);}
 await page.locator('#studio-next').click();
 assert.equal(await page.locator('[data-step="5"]').isVisible(),true);
 assert.equal(await page.locator('input[value="collaborative"]').isChecked(),true);
 assert.equal(await page.locator('.preference-place').count(),6);
 const first=page.locator('.preference-place').first();await first.locator('summary').click();
 await first.getByRole('combobox',{name:'Preferred day for Test Place 1',exact:true}).selectOption('2');
 await first.getByRole('combobox',{name:'Preferred time for Test Place 1',exact:true}).selectOption('specific');
 await first.getByLabel('Specific time for Test Place 1',{exact:true}).fill('09:30');await first.getByRole('combobox',{name:'How important is this activity? for Test Place 1',exact:true}).selectOption('must_visit');
 await page.locator('input[value="manual"]').check();await page.locator('#pace').selectOption('packed');
 const before=JSON.parse(await page.locator('#itinerary-preferences-state').inputValue());assert.equal(before.activityPreferences[0].isUserLocked,true);
 await page.reload();await page.waitForSelector('.preference-place');
 assert.deepEqual(JSON.parse(await page.locator('#itinerary-preferences-state').inputValue()),before);
 assert.equal(await page.locator('input[value="manual"]').isChecked(),true);
 await page.locator('[data-step-button="4"]').click();await page.locator('.studio-selected').first().getByRole('button',{name:'Remove',exact:true}).click();await page.locator('#studio-next').click();
 assert.equal(await page.locator('.preference-place').count(),5);assert.ok(!JSON.parse(await page.locator('#itinerary-preferences-state').inputValue()).activityPreferences.some(p=>p.activityId==='test-place-0'));
 await page.screenshot({path:'/tmp/packswift-preferences-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('PASS: default preferences, selected-place references, customization, manual mode, pace, refresh restoration, removal sync, mobile overflow.');
}finally{await browser.close();}
