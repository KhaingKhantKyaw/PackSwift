import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',route=>{const p=new URL(route.request().url()).pathname;let json={items:[],places:[],suggestions:[],itinerary:[]};if(p==='/api/auth/me')json={user:null};if(p.startsWith('/api/booking-search/'))json={source:'Test provider',searchedAt:new Date().toISOString(),items:Array.from({length:10},(_,i)=>({title:'Option '+(i+1),price:'USD '+(100+i),url:'https://example.com/booking'}))};return route.fulfill({json});});
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:3000')+'/trip-planner');
 await page.waitForFunction(()=>window.PackSwiftPlannerSections&&document.querySelector('#travel-style'));
 await page.evaluate(()=>{const f=document.getElementById('trip-planner-form');for(const [name,value]of Object.entries({origin:'Yangon',destination:'Bangkok',startDate:'2027-12-12',endDate:'2027-12-16'}))f.elements[name].value=value;f.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('.planner-section-nav:not([hidden])').waitFor();
 const nav=page.locator('.planner-section-nav'),root=page.locator('#studio-dashboard-content');
 await nav.getByRole('button',{name:'Flights & stays',exact:true}).click();
 const flights=root.locator('[data-preview-section="Flight & Stay"]');await flights.waitFor({state:'visible'});
 await flights.getByRole('button',{name:'Search flights',exact:true}).click();await flights.getByText('Option 1',{exact:true}).waitFor();
 assert.equal(await flights.locator('.booking-result').count(),4);
 await flights.getByRole('button',{name:'Show more flights',exact:true}).click();assert.equal(await flights.locator('.booking-result').count(),8);
 await nav.getByRole('button',{name:'Packing & tips',exact:true}).click();await root.locator('[data-preview-section="Packing List"]').waitFor({state:'visible'});
 await nav.getByRole('button',{name:'Flights & stays',exact:true}).click();assert.equal(await flights.locator('.booking-result').count(),8);
 for(const width of [1440,390])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.evaluate(t=>PackSwift.setThemePreference(t),theme);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const trapped=await flights.evaluate(panel=>[panel,...panel.querySelectorAll('.reference-preview-content,.booking-results-scroll')].filter(n=>n.scrollHeight>n.clientHeight+2&&['auto','scroll','hidden'].includes(getComputedStyle(n).overflowY)).map(n=>n.className));assert.deepEqual(trapped,[]);
  await flights.getByText('Option 1',{exact:true}).scrollIntoViewIfNeeded();const box=await flights.getByText('Option 1',{exact:true}).boundingBox();const before=await page.evaluate(()=>scrollY);await page.mouse.move(box.x+10,box.y+5);await page.mouse.wheel(0,250);await page.waitForFunction(y=>scrollY>y,before);
 }
 await nav.getByRole('button',{name:'Itinerary & activities',exact:true}).click();assert.equal(await flights.isVisible(),false);
 assert.equal(await page.locator('#destination-search').inputValue(),'Bangkok');assert.deepEqual(errors,[]);
 console.log('PASS: one document scroller, section switching without remounting, paginated results, preserved inputs, wheel scrolling, mobile and both themes.');
}finally{await browser.close();}
