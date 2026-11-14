import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/**',route=>route.fulfill({json:new URL(route.request().url()).pathname==='/api/auth/me'?{user:null}:{items:[],places:[],suggestions:[],itinerary:[]}}));
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:3000')+'/trip-planner');
 await page.waitForSelector('.travel-guidance-panel');await page.waitForTimeout(500);
 const setup=page.locator('.planner-trip-setup'),experience=page.locator('.travel-guidance-panel');
 const fields=['Trip Type','Location','Dates','Travelers','Travel Purpose','Travel Style'];
 for(const viewport of [{width:1180,height:768},{width:1280,height:720},{width:1366,height:768},{width:1440,height:900},{width:1920,height:1080}]){
  await page.setViewportSize(viewport);await page.evaluate(()=>scrollTo(0,0));
  const box=await setup.boundingBox();
  if(box.y+box.height>viewport.height-8){
   await page.screenshot({path:'/tmp/packswift-compact-overflow.png',fullPage:false});
   console.log(JSON.stringify(await page.locator('.sketch-fields>.sketch-field:visible').evaluateAll(nodes=>nodes.map(node=>({field:node.dataset.field,height:node.getBoundingClientRect().height,styles:{display:getComputedStyle(node).display,padding:getComputedStyle(node).padding,minHeight:getComputedStyle(node).minHeight,gap:getComputedStyle(node.parentElement).gap,rows:getComputedStyle(node).gridTemplateRows},children:[...node.children].filter(child=>child.getBoundingClientRect().height).map(child=>({class:child.className,tag:child.tagName,height:child.getBoundingClientRect().height,minHeight:getComputedStyle(child).minHeight,margin:getComputedStyle(child).margin,padding:getComputedStyle(child).padding}))}))),null,2));
  }
  assert.ok(box.y+box.height<=viewport.height-8,`Complete setup fits ${viewport.width}×${viewport.height}: bottom ${box.y+box.height}`);
  const cards=await Promise.all(fields.map(name=>page.locator(`.sketch-field[data-field="${name}"]`).boundingBox()));
  assert.ok(cards.slice(0,3).every(card=>Math.abs(card.y-cards[0].y)<2),'First three controls share a row');
  assert.ok(cards.slice(3).every(card=>Math.abs(card.y-cards[3].y)<2),'Second three controls share a row');
  assert.ok(cards.every(card=>Math.abs(card.width-cards[0].width)<2),'All six base panels have equal widths');
  assert.ok(cards.slice(0,3).every(card=>Math.abs(card.height-cards[0].height)<2),'First row panels match heights');
  assert.ok(cards.slice(3).every(card=>Math.abs(card.height-cards[3].height)<2),'Second row panels match heights');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'No page overflow');
  console.log(`Setup at ${viewport.width}×${viewport.height}: ${Math.round(box.height)}px tall, bottom ${Math.round(box.y+box.height)}px`);
 }
 await page.setViewportSize({width:1366,height:768});
 await page.evaluate(()=>{
  for(const [name,value]of Object.entries({origin:'Yangon',destination:'Bangkok',startDate:'2027-01-01',endDate:'2027-01-06',adults:'2',travelStyle:'Balanced'})){
   const field=document.querySelector('[name="'+name+'"]');field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));
  }
 });
 await experience.getByRole('radio',{name:/This is my first trip/}).click();
 await experience.getByRole('button',{name:'Quick view',exact:true}).click();
 assert.equal(await experience.getByRole('button',{name:'Use experience default'}).isVisible(),true);
 await page.evaluate(()=>scrollTo(0,0));
 let box=await setup.boundingBox();assert.ok(box.y+box.height<768,'Setup fits with a selected experience and guidance override');
 for(const width of [1180,1280,1366]){
  await page.setViewportSize({width,height:768});
  const dates=await page.locator('.sketch-date input:not([type="date"])').evaluateAll(nodes=>nodes.map(node=>{
   const style=getComputedStyle(node),canvas=document.createElement('canvas'),context=canvas.getContext('2d');context.font=style.font;
   return {value:node.value,needed:context.measureText(node.value).width,available:node.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)};
  }));
  assert.ok(dates.length===2&&dates.every(date=>date.needed<=date.available),`Complete dates remain readable at ${width}px: ${JSON.stringify(dates)}`);
  assert.ok(await page.locator('.traveller-stepper').evaluateAll(nodes=>nodes.every(node=>node.scrollWidth<=node.clientWidth+1)),'Traveler counters stay in bounds');
 }
 await page.setViewportSize({width:1366,height:768});
 const children=page.locator('.sketch-field[data-field="Travelers"] .traveller-stepper').nth(1);
 await children.getByRole('button').last().click();
 assert.equal(await page.locator('.traveler-child-ages select').isVisible(),true);
 await page.locator('.traveler-child-ages select').selectOption('5');
 assert.equal(await page.locator('.traveler-child-ages select').inputValue(),'5');
 await page.evaluate(()=>{const field=document.getElementById('children');field.value='8';field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));});
 assert.equal(await page.locator('.traveler-child-ages select').count(),8,'Every child retains an age selector');
 assert.ok(await page.locator('.traveler-child-ages').evaluate(node=>node.scrollHeight<=node.clientHeight+1&&node.scrollWidth<=node.clientWidth+1),'Extra ages expand without clipping');
 await page.evaluate(()=>{const field=document.getElementById('children');field.value='0';field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.locator('.purpose-multiselect>summary').click();
 await page.locator('.purpose-options input').first().check();
 await page.locator('.purpose-options input').nth(1).check();
 assert.equal(await page.locator('.purpose-options input:checked').count(),2);
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:1180,height:768});
 await page.getByRole('button',{name:'Choose start date',exact:true}).click();
 assert.ok(await page.locator('.calendar-day:visible').count()>0,'Calendar remains usable');
 assert.ok(await page.locator('.sketch-calendar-panel').evaluate(node=>node.scrollWidth<=node.clientWidth+1),'Calendar stays within its panel');
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:1366,height:768});
 await page.locator('#trip-overview-title').click();
 for(const theme of ['light','dark']){
  await page.evaluate(value=>PackSwift.setThemePreference(value),theme);await page.waitForTimeout(400);
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:`/tmp/packswift-compact-setup-${theme}.png`});
 }
 for(const width of [1100,1000,768,650,390]){
  await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'No overflow at '+width);
  assert.equal(await page.locator('.trip-comfort-controls').isVisible(),true,'Comfort still accessible');
  assert.ok(await experience.evaluate(n=>n.scrollWidth<=n.clientWidth+1),'Guidance stays in bounds at '+width);
  if(width<=1000){
   const form=await page.locator('#trip-planner-form').boundingBox(),overview=await page.locator('#trip-overview').boundingBox();
   assert.ok(overview.y>=form.y+form.height-2,'Overview stacks on smaller screens');
  }
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: compact desktop setup, consistent panels, child ages, guidance controls, purpose selection, calendar, themes and responsive layout');
}finally{await browser.close();}
