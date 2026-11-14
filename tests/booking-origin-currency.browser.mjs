import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {searchBooking} from '../src/services/booking-search.js';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),requests=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.startsWith('/api/booking-search/')){
   const input=route.request().postDataJSON(),kind=path.split('/').pop();requests.push({kind,input});
   const data=await searchBooking(kind,input,{key:'test-only',rateProvider:async target=>({base:'USD',target,rate:2100,updatedAt:new Date().toISOString()}),fetcher:async url=>({ok:true,json:async()=>({search_parameters:{currency:url.searchParams.get('currency')},search_metadata:{google_flights_url:'https://www.google.com/travel/flights?curr=JPY'},best_flights:[{price:100,flights:[{airline:'Currency test airline',departure_airport:{id:'BKK'},arrival_airport:{id:'TYO'}}]}],properties:[{name:'Currency test stay',total_rate:{extracted_lowest:200}}]})})});
   return route.fulfill({json:data});
  }
  return route.fulfill({json:path==='/api/auth/me'?{user:null}:{items:[],places:[],suggestions:[],itinerary:[]}});
 });
 const base=process.env.BASE_URL||'http://127.0.0.1:3000';
 await page.goto(base+'/trip-planner');await page.waitForSelector('.travel-guidance-panel');await page.waitForTimeout(400);
 const set=async values=>{await page.evaluate(values=>{for(const [name,value]of Object.entries(values)){const field=document.querySelector('[name="'+name+'"]');field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));}},values);await page.waitForTimeout(150);};
 await set({origin:'Bangkok',destination:'Tokyo',startDate:'2027-11-08',endDate:'2027-11-12',travelStyle:'Balanced'});
 const panel=page.locator('[data-preview-section="Flight & Stay"]'),flights=panel.getByRole('region',{name:'Flight search results'}),stays=panel.getByRole('region',{name:'Stay search results'});
 const budgetBefore=await page.locator('#currency').inputValue();
 await panel.getByRole('button',{name:'Search flights',exact:true}).click();await flights.getByText('Currency test airline',{exact:true}).waitFor();
 await panel.getByRole('button',{name:'Search stays',exact:true}).click();await stays.getByText('Currency test stay',{exact:true}).waitFor();
 assert.equal(requests.length,2);assert.ok(requests.every(r=>r.input.currency==='THB'));
 assert.match(await flights.innerText(),/THB 100/);assert.match(await stays.innerText(),/THB 200/);
 for(const [label,param]of [['Search Expedia flights','currency'],['Search Booking.com','selected_currency']])assert.equal(new URL(await panel.getByRole('link',{name:new RegExp(label)}).getAttribute('href')).searchParams.get(param),'THB');
 assert.equal(new URL(await stays.getByRole('link',{name:/Find this stay/}).getAttribute('href')).searchParams.get('selected_currency'),'THB');
 assert.equal(new URL(await flights.getByRole('link',{name:/Compare route/}).getAttribute('href')).searchParams.get('curr'),'THB');
 assert.equal(await page.locator('#currency').inputValue(),budgetBefore,'Searches do not change trip-budget currency');
 await set({origin:'Paris'});
 assert.equal(await flights.getByText('Currency test airline',{exact:true}).count(),0,'Changing origin clears visible old quotes');
 await panel.getByRole('button',{name:'Search stays',exact:true}).click();await stays.getByText('Currency test stay',{exact:true}).waitFor();
 assert.equal(requests.at(-1).input.currency,'EUR');assert.match(await stays.innerText(),/EUR 200/);
 await set({destination:'Singapore'});
 await panel.getByRole('button',{name:'Search flights',exact:true}).click();await flights.getByText('Currency test airline',{exact:true}).waitFor();
 assert.equal(requests.at(-1).input.currency,'EUR','Destination change retains origin currency');
 await set({origin:'Yangon',destination:'Bangkok'});
 for(const [button,region]of [['Search flights',flights],['Search stays',stays]]){await panel.getByRole('button',{name:button,exact:true}).click();await region.locator('.booking-result').waitFor();}
 assert.equal(requests.at(-1).input.currency,'MMK');
 assert.match(await flights.innerText(),/≈ MMK 210,000/);assert.match(await stays.innerText(),/≈ MMK 420,000/);
 assert.match(await flights.innerText(),/Provider quote: USD 100/);assert.match(await stays.innerText(),/rate updated/);
 assert.equal(await stays.getByRole('link',{name:'Rates By Exchange Rate API'}).getAttribute('href'),'https://www.exchangerate-api.com');
 assert.equal(new URL(await stays.getByRole('link',{name:/Find this stay/}).getAttribute('href')).searchParams.get('selected_currency'),'USD','Unsupported origin currency does not create an unsupported external request');
 await panel.getByRole('button',{name:'Expand Flight & Stay',exact:true}).click();await panel.scrollIntoViewIfNeeded();
 await page.screenshot({path:'/tmp/packswift-origin-currency.png'});
 // An existing draft must derive currency afresh from the route, not its legacy budget currency.
 await page.reload();await page.waitForSelector('.travel-guidance-panel');await page.waitForTimeout(500);
 assert.equal(await page.locator('[name="origin"]').inputValue(),'Yangon');
 await panel.getByRole('button',{name:'Search stays',exact:true}).click();await stays.getByText('Currency test stay',{exact:true}).waitFor();
 assert.equal(requests.at(-1).input.currency,'MMK');
 await set({origin:'Unlisted city'});
 assert.equal(await panel.getByRole('button',{name:'Search stays',exact:true}).isDisabled(),true);
 assert.equal(await panel.getByRole('button',{name:'Search flights',exact:true}).isDisabled(),true);
 assert.match(await panel.innerText(),/recognized origin city/);
 assert.deepEqual(errors,[]);
 console.log('PASS: origin currency in both searches and links, explicit MMK estimates, original USD prices, attribution, route invalidation, draft restoration, unknown origin, unchanged budget currency');
}finally{await browser.close();}
