import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import express from 'express';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const app=express();app.use(express.static(fileURLToPath(new URL('../public/',import.meta.url)),{extensions:['html']}));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base='http://127.0.0.1:'+server.address().port;let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>r.fulfill({json:{user:null}}));
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.goto(base+'/emergency-contacts.html?country=FR');
 await page.getByRole('link',{name:'Call General emergency · police, ambulance, fire 112',exact:true}).waitFor();
 assert.equal(await page.locator('#public-emergency-directory select option').count(),251);
 const select=page.locator('#public-emergency-directory select');
 await select.selectOption('PF');await page.getByText(/Verified contacts unavailable/).waitFor();assert.equal(await page.locator('a[href^="tel:"]').count(),0);assert.equal(await page.locator('#download-emergency-contacts').isDisabled(),true);
 await select.selectOption('AU');await page.getByRole('link',{name:'Call Police, fire or ambulance 000',exact:true}).waitFor();
 assert.equal(await page.locator('a[href="tel:000"]').count(),1);
 const download=page.waitForEvent('download');await page.locator('#download-emergency-contacts').click();const file=await download;const {readFile}=await import('node:fs/promises');const text=await readFile(await file.path(),'utf8');assert.match(text,/Australia/);assert.match(text,/000/);assert.match(text,/2026-11-14/);
 for(const width of [1440,390])for(const mode of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.evaluate(t=>PackSwift.setThemePreference(t),mode);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,width+' '+mode+' overflow');
 }
 assert.deepEqual(errors,[]);
 await page.route('**/data/emergency-contacts.json',r=>r.fulfill({status:503,json:{}}));await page.reload();await page.getByText(/Directory unavailable/).waitFor();assert.equal(await page.locator('a[href^="tel:"]').count(),0);
 console.log('Public emergency directory passed: guest access, country selection, regional boundaries, local dialing, offline export, failed-load safety and both themes/mobile.');
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
