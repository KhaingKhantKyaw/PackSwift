import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage();let requests=0;
 await page.route('**/api/booking-search/*',async route=>{requests++;const kind=route.request().url().split('/').pop();await route.fulfill({json:{source:'Test provider',searchedAt:new Date().toISOString(),items:kind==='flights'?[{title:'Test airline',detail:'RGN → BKK',price:'THB 100',priceLabel:'Test only',url:'https://www.google.com/travel/flights'}]:[]}});});
 await page.goto('http://127.0.0.1:3000/trip-planner');await page.waitForFunction(()=>window.PackSwiftBookingPreview);
 await page.evaluate(()=>{const host=document.createElement('div');host.id='booking-test';document.body.prepend(host);window.testBookingInput={origin:'Yangon',destination:'Bangkok',startDate:'2026-12-09',endDate:'2026-12-15',adults:2,children:0,currency:'THB',entryMode:'air'};window.PackSwiftBookingPreview.mount(host,window.testBookingInput);});
 const root=page.locator('#booking-test');assert.equal(requests,0);
 await root.getByRole('button',{name:'Search flights',exact:true}).click();await root.getByText('Test airline',{exact:true}).waitFor();assert.equal(requests,1);
 await root.getByRole('button',{name:'Search stays',exact:true}).click();await root.getByText('No options found. Try other dates or the external search.').waitFor();
 await page.evaluate(()=>{const host=document.querySelector('#booking-test');host.replaceChildren();window.PackSwiftBookingPreview.mount(host,{...window.testBookingInput,destination:'Tokyo'});});assert.equal(await root.getByText('Test airline',{exact:true}).count(),0);assert.equal(requests,2);
 await page.route('**/api/booking-search/*',r=>r.fulfill({status:429,json:{error:'Search quota reached.'}}));await root.getByRole('button',{name:'Search flights',exact:true}).click();await root.getByText('Search quota reached.').waitFor();
 assert.equal(await root.getByRole('button',{name:'Search flights',exact:true}).isEnabled(),true);
 console.log('PASS: explicit searches, results, empty state, changed-trip invalidation and retryable errors');
}finally{await browser.close();}
