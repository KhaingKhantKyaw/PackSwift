import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 let baseline;
 for(const [name,path,active] of [['home','/','home'],['explore','/#world-explorer','explore'],['planner','/trip-planner','planner'],['help','/help','help'],['trips','/trips','trips']]){
  await page.goto((process.env.PLANNER_TEST_URL||'http://127.0.0.1:3000')+path);
  await page.waitForFunction(()=>document.querySelector('link[href="/css/global-header.css"]')?.sheet);
  await page.waitForTimeout(400);
  const geometry=await page.evaluate(()=>['.ps-global-header','.ps-header-brand',...[...document.querySelectorAll('.ps-header-links a')].slice(0,4).map(a=>`[data-nav="${a.dataset.nav}"]`),'.ps-header-action[href="/login"]','.ps-header-start','.ps-header-theme'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(n=>Math.round(n*100)/100);}));
  assert.equal(geometry[0][3],88);
  if(baseline)assert.deepEqual(geometry,baseline,`${name} geometry differs`);else baseline=geometry;
  if(name!=='trips') assert.equal(await page.locator('.ps-header-link[aria-current=page]').getAttribute('data-nav'),active);
  await page.locator('.ps-global-header').screenshot({path:`/tmp/packswift-header-${name}.png`});
 }
 await page.setViewportSize({width:390,height:844});
 await page.goto((process.env.PLANNER_TEST_URL||'http://127.0.0.1:3000')+'/trip-planner');
 await page.locator('.ps-header-menu').click();
 assert.equal(await page.locator('.ps-header-menu').getAttribute('aria-expanded'),'true');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('.ps-header-menu').getAttribute('aria-expanded'),'false');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const before=await page.locator('html').getAttribute('data-theme');
 await page.locator('.ps-header-theme').click();
 assert.notEqual(await page.locator('html').getAttribute('data-theme'),before);
 assert.deepEqual(errors,[]);
 console.log('PASS: identical cross-page desktop geometry, mobile menu/Escape, theme toggle, no overflow or page errors.');
}finally{await browser.close();}
