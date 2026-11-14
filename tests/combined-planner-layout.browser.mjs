import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/booking-search/*',route=>route.fulfill({json:{items:[],source:'Test'}}));
 await page.route('**/api/places/**',route=>route.fulfill({json:{places:[],suggestions:[]}}));
 await page.route('**/api/v1/trips/live-review',route=>route.fulfill({json:{itinerary:[]}}));
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:3000')+'/trip-planner');
 await page.waitForSelector('.planner-horizontal .sketch-fields');
 await page.waitForTimeout(500);
 const overview=page.locator('#trip-overview');
 const card=overview.locator('[data-preview-section="Overview"]');
 assert.equal(await card.isVisible(),false,'Overview starts empty');
 assert.equal(await page.locator('#travel-style').inputValue(),'');
 assert.equal(await page.locator('.purpose-options input:checked').count(),0);
 await page.selectOption('#travel-style','Balanced');
 await card.waitFor({state:'visible'});
 assert.match(await overview.innerText(),/Balanced/);
 await page.selectOption('#travel-style','');
 assert.equal(await card.isVisible(),false,'Clearing inputs restores blank overview');
 await page.evaluate(()=>{
  for(const [id,value] of [['origin-search','Yangon'],['destination-search','Bangkok'],['start-date','2027-01-01'],['end-date','2027-01-06'],['adults','2']]){
   const field=document.getElementById(id);field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));
  }
 });
 await page.waitForTimeout(500);
 assert.match(await overview.innerText(),/Bangkok/);
 assert.match(await overview.innerText(),/1 Jan 2027 – 6 Jan 2027/);
 assert.match(await overview.innerText(),/From Yangon · 2 adults · 5 nights/);
 assert.equal(await page.locator('[data-preview-section="Overview"]').count(),1,'No duplicated overview');
 assert.equal(await page.locator('#studio-dashboard-content>[data-preview-section]:visible').count(),4);
 const formBox=await page.locator('#trip-planner-form').boundingBox(),overviewBox=await overview.boundingBox();
 assert.ok(Math.abs(formBox.y-overviewBox.y)<2,'Form and overview share a top edge');
 assert.ok(overviewBox.x>=formBox.x+formBox.width-2,'Overview sits beside the form');
 assert.ok(Math.abs(formBox.height-overviewBox.height)<2,'Shared surface has equal column heights');
 await page.getByRole('button',{name:'Edit destination',exact:true}).click();
 assert.equal(await page.evaluate(()=>document.activeElement.id),'destination-search');
 await page.locator('.sketch-field[data-field="Travelers"] .traveller-stepper').nth(1).getByRole('button').last().click();
 assert.equal(await page.locator('.traveler-child-ages select').count(),1);
 assert.equal(await page.locator('.traveler-child-ages').isVisible(),true);
 assert.equal(await page.locator('#trip-planner-form #children').inputValue(),'1');
 await page.locator('.purpose-multiselect>summary').click();
 await page.locator('.purpose-options input').first().check();
 await page.locator('.purpose-options input').nth(1).check();
 assert.equal(await overview.locator('.destination-overview-choices>span').count(),2);
 await page.keyboard.press('Escape');
 for(const theme of ['dark','light']){
  await page.evaluate(value=>PackSwift.setThemePreference(value),theme);
  assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
  assert.equal(await card.isVisible(),true);
 }
 if(process.env.SCREENSHOT_PATH)await page.screenshot({path:process.env.SCREENSHOT_PATH,fullPage:false});
 for(const width of [768,390]){
  await page.setViewportSize({width,height:1000});
  const form=await page.locator('#trip-planner-form').boundingBox(),preview=await overview.boundingBox();
  assert.ok(preview.y>=form.y+form.height-2,'Overview stacks below form on small screens');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`No page overflow at ${width}px`);
 }
 assert.deepEqual(errors,[],'No page errors');
 console.log('PASS: combined layout, blank state, live updates, purposes, child ages, edit action, themes and mobile stacking');
}finally{await browser.close();}
