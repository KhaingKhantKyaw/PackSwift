import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
try{
 const page=await browser.newPage(),errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/api/auth/me'))failed.push({path:new URL(r.url()).pathname,status:r.status()});});
 for(const path of ['/','/#world-explorer','/help','/login','/signup','/trip-planner','/trips','/profile']){
  await page.goto((process.env.QA_TEST_URL||'http://127.0.0.1:3000')+path);
  await page.waitForFunction(()=>window.PackSwift?.setThemePreference);
  for(const [width,height]of [[1440,900],[1366,768],[1280,800],[1024,768],[768,1024],[390,844],[375,812]]){
   await page.setViewportSize({width,height});
   for(const theme of ['light','dark','system']){
    await page.evaluate(t=>PackSwift.setThemePreference(t),theme);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${path} ${width} ${theme}: overflow`);
   }
  }
  console.log('PASS public route and 21 viewport/theme combinations:',path);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 console.log('PASS: public/protected entry routes, 168 viewport/theme checks, clean JavaScript and HTTP responses.');
}finally{await browser.close();}
