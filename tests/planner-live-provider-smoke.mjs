// Opt-in: verifies the running planner, not a static preview. At most one real
// request per provider operation. No user account, real trip, or booking is needed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
if(process.env.RUN_LIVE_SEARCH!=='1') throw Error('Set RUN_LIVE_SEARCH=1 to use one activity, one flight and one hotel search.');
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:3000');
if(!['127.0.0.1','localhost'].includes(base.hostname))throw Error('Use a local PackSwift server.');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage({viewport:{width:1440,height:950}}),counts=new Map(),statuses=new Map();
 const paths=new Map([['/api/places/popular-activities','activities'],['/api/booking-search/flights','flights'],['/api/booking-search/hotels','hotels']]);
 await page.route('**/*',route=>{
   const u=new URL(route.request().url()),name=paths.get(u.pathname);
   if(name&&u.origin===base.origin){
     if(counts.has(name))return route.abort();
     counts.set(name,1);return route.continue();
   }
   // Do not consume quota for photos, ancillary place requests, analytics or account writes.
   if(u.origin!==base.origin||u.pathname.startsWith('/api/'))return route.fulfill({status:503,json:{message:'Ancillary service omitted from smoke test.'}});
   return route.continue();
 });
 page.on('response',response=>{const k=paths.get(new URL(response.url()).pathname);if(k)statuses.set(k,response.status());});
 await page.goto(new URL('/trip-planner',base).href);
 await page.waitForSelector('.sketch-fields');
 const date=offset=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
 await page.evaluate(values=>{const form=document.getElementById('trip-planner-form');for(const [name,value]of Object.entries(values)){
   const f=form.elements[name];f.value=value;f.dispatchEvent(new Event('input',{bubbles:true}));f.dispatchEvent(new Event('change',{bubbles:true}));
 }},{origin:'Bangkok',destination:'Hanoi',startDate:date(35),endDate:date(39),travelStyle:'Balanced',travelPurposes:JSON.stringify(['Food, Drink & Culinary'])});
 const panel=page.locator('[data-preview-section="Flight & Stay"]');
 for(const [name,button]of [['flights','Search flights'],['hotels','Search stays']]){
   await panel.getByRole('button',{name:button,exact:true}).click();
 }
 const cases=[['activities',page.locator('.activity-preview-card')],['flights',panel.getByRole('region',{name:'Flight search results'}).locator('.booking-result')],['hotels',panel.getByRole('region',{name:'Stay search results'}).locator('.booking-result')]];
 const checks=await Promise.all(cases.map(async([name,cards])=>{
   await cards.first().waitFor({state:'attached',timeout:65000}).catch(()=>{});
   const n=await cards.count();
   const hasQuote=name==='activities'||(await cards.locator('strong').allTextContents()).some(text=>/^THB\s+\d/.test(text.trim()));
   console.log(name+': HTTP '+(statuses.get(name)??'no response')+', '+n+' cards'+(name==='activities'?'':', origin-currency quote: '+hasQuote));
   return statuses.get(name)===200&&n>0&&hasQuote;
 }));
 assert.ok(checks.every(Boolean),'One or more live searches did not show matching cards. See counts above.');
}finally{await browser.close();}
