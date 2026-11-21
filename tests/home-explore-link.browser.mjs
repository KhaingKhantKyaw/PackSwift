import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.BASE_URL||'http://127.0.0.1:3000';await page.goto(base+'/');
 const link=page.locator('.slider-actions').getByRole('link',{name:'Explore the world',exact:true});await link.waitFor();
 assert.equal(await link.getAttribute('href'),'/explore');assert.equal(await page.locator('.home-explore-link').count(),0);
 assert.equal(await page.getByText('Explore destination',{exact:true}).count(),0);
 for(const width of [1440,390])for(const theme of ['light','dark']){await page.setViewportSize({width,height:900});await page.evaluate(t=>PackSwift.setThemePreference(t),theme);assert.equal(await link.isVisible(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await link.click();await page.waitForURL('**/explore');assert.deepEqual(errors,[]);
 console.log('PASS: one hero Explore the world link, no bottom duplicate, mobile/themes and navigation to Explore.');
}finally{await browser.close();}
