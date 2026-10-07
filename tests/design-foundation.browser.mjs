import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
try {
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 for(const width of [1440,390]) for(const path of ['/','/trip-planner','/help']) {
  await page.setViewportSize({width,height:960});
  await page.goto((process.env.PLANNER_TEST_URL||'http://127.0.0.1:3000')+path);
  await page.waitForFunction(()=>document.querySelector('link[href="/css/journey-theme.css"]')?.sheet);
  const nav=await page.locator('.desktop-nav a:not([hidden]),.slider-menu a:not([hidden])').allTextContents();
  assert.deepEqual(nav.map(text=>text.trim()).slice(0,4),['Home','Explore','Plan Trip','Help']);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${path}: ${width}px overflow`);
  if(path!=='/') assert.equal(await page.locator('.site-header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(10, 50, 55, 0.72)');
  await page.screenshot({path:`/tmp/packswift-foundation-${path==='/'?'home':path.slice(1)}-${width}.png`});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: shared navigation, dark header, desktop/mobile overflow and no page errors.');
} finally {await browser.close();}
