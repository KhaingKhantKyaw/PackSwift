import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const base=process.env.PLANNER_TEST_URL||'http://127.0.0.1:3000';
 for(const [width,height] of [[1440,900],[1366,768],[1280,800],[768,1024],[390,844]]){
  await page.setViewportSize({width,height});
  for(const path of ['/','/#world-explorer','/trip-planner','/help','/login','/signup']){
   await page.goto(base+path);await page.waitForFunction(()=>document.querySelector('link[href="/css/global-header.css"]')?.sheet&&document.querySelector('link[href="/css/journey-theme.css"]')?.sheet);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${path} overflow at ${width}`);
   if(width>=1280&&path==='/'){
    const r=await page.locator('.home-hero-shell').boundingBox();assert.equal(r.y,88);assert.ok(Math.abs(r.y+r.height-height)<2);
   }
   if(width>=1280&&path.includes('#')){
    await page.locator('#world-explorer').evaluate(el=>el.scrollIntoView({behavior:'instant'}));
    const r=await page.locator('#world-explorer').boundingBox();assert.ok(Math.abs(r.y-88)<2);assert.ok(Math.abs(r.y+r.height-height)<2);
   }
   if(path==='/trip-planner'){
    const r=await page.locator('#studio-next').boundingBox();assert.equal(r.height,42);
   }
   await page.screenshot({path:`/tmp/ps-polish-${path==='/'?'home':path.includes('#')?'explore':path.slice(1)}-${width}.png`});
  }
 }
 await page.goto(base+'/help');
 await page.locator('#help-search').fill('packing');
 assert.equal(await page.locator('#help-questions details:not([hidden])').count(),1);
 await page.locator('[data-help-topic="budget"]').click();
 assert.equal(await page.locator('#help-questions details:not([hidden])').count(),1);
 await page.locator('#help-search').fill('zzzz-no-match');
 assert.match(await page.locator('#help-search-status').textContent(),/No matching/);
 await page.locator('[data-help-topic=""]').click();
 assert.equal(await page.locator('#help-questions details:not([hidden])').count(),6);
 assert.deepEqual(errors,[]);
 console.log('PASS: five viewport sizes, six routes, desktop hero/Explore fit, compact controls, Help filtering, no overflow or page errors.');
}finally{await browser.close();}
