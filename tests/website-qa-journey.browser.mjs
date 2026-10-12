// Opt-in real browser/provider/database QA. Creates and removes only its own test account.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {getDatabasePool} from '../src/config/database.js';
const base=process.env.QA_TEST_URL;
if(!base)throw Error('Set QA_TEST_URL to the local PackSwift server.');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
const username='qa_'+randomUUID().slice(0,8),password='Temporary!QA12345';
let userId;
try {
 const context=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'America/Los_Angeles'});
 const page=await context.newPage(),errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/api/auth/me'))failed.push({url:new URL(r.url()).pathname,status:r.status()});});
 await page.goto(base+'/');
 await page.getByRole('link',{name:'Get Started',exact:true}).first().click();
 await page.locator('#signup-name').fill('PackSwift QA');await page.locator('#signup-username').fill(username);
 await page.locator('#signup-email').fill(username+'@example.com');await page.locator('#signup-password').fill(password);
 const created=page.waitForResponse(r=>r.url().endsWith('/api/auth/signup')&&r.request().method()==='POST');
 await page.getByRole('button',{name:/Create account/}).click();const signup=await created;
 assert.equal(signup.status(),201);
 await page.waitForURL(url=>!url.pathname.includes('signup'));
 userId=(await (await context.request.get(base+'/api/auth/me')).json()).user.id;
 await page.goto(base+'/trip-planner?destination=Bangkok');await page.waitForSelector('.calendar-day');
 await page.locator('#origin-search').fill('Yangon');
 for(let n=0;n<18&&!await page.locator('[data-date="2026-12-03"]').count();n++)await page.getByRole('button',{name:'Next month',exact:true}).click();
 await page.locator('[data-date="2026-12-03"]').click();await page.locator('[data-date="2026-12-10"]').click();
 await page.locator('#studio-next').click();await page.getByRole('button',{name:'Increase adults',exact:true}).click();
 await page.locator('#passport-country').fill('Myanmar');await page.locator('#studio-next').click();
 await page.locator('#currency').selectOption('THB');await page.locator('#budget').fill('30000');
 for(const goal of ['make-possible','fixed-budget','best-value'])await page.locator('#planning-goal').selectOption(goal);
 await page.locator('#studio-next').click();await page.locator('#dietary-style').selectOption('halal');
 await page.locator('#trip-notes').fill('Culture, food and beaches');await page.locator('#studio-next').click();
 const search=page.locator('#global-place-search');
 for(const query of ['Grand Palace','Dream World','Hua Hin Beach','Eiffel Tower Paris']){
  await search.fill(query);await page.locator('#global-place-results button').first().click();
  await page.locator('.place-search-preview').waitFor();
  assert.ok((await page.locator('.place-search-preview h4').textContent()).length);
  await page.locator('.place-search-preview').getByRole('button',{name:'+ Add to Trip',exact:true}).click();
  if(await page.getByRole('dialog').isVisible())await page.getByRole('dialog').getByRole('button',{name:'Add Anyway'}).click();
  await page.getByRole('button',{name:'✓ Added to Trip',exact:true}).waitFor();
 }
 assert.equal(await page.locator('.searched-place-row').count(),4);
 await page.locator('#studio-find').click();
 await page.waitForFunction(()=>!document.querySelector('#studio-find').disabled,{},{timeout:90000});
 assert.ok(await page.locator('.activity-card').count(),'Real recommendations should render');
 await page.locator('#studio-next').click();
 for(const mode of ['auto','manual','collaborative'])await page.locator('input[name="itinerary-mode-choice"][value="'+mode+'"]').check();
 for(const pace of ['relaxed','packed','balanced'])await page.locator('#pace').selectOption(pace);
 await page.locator('#readiness-0').check();await page.locator('#studio-next').click();
 await page.locator('#studio-next').click();await page.waitForURL(/\/trips\/[a-f0-9-]+$/,{timeout:30000});
 const id=page.url().split('/').at(-1);console.log('Saved real trip with four Google Places selections');
 const saved=await (await context.request.get(base+'/api/trips/'+id)).json();
 const fields=saved.trip.preferences.detailPlanning.fields;
 for(const [name,value] of Object.entries({origin:'Yangon',destination:'Bangkok',startDate:'2026-12-03',endDate:'2026-12-10',adults:'2',currency:'THB',budget:'30000',dietaryStyle:'halal'}))assert.equal(fields.find(f=>f.name===name).value,value,name);
 assert.equal(saved.trip.preferences.detailPlanning.selected.length,4);
 assert.equal(new Set(saved.trip.preferences.detailPlanning.selected.map(p=>p.placeId||p.id)).size,4);
 await page.goto(base+'/trips');await page.getByRole('link',{name:'Continue Planning',exact:true}).click();
 await page.getByRole('heading',{name:'Your Bangkok Trip'}).waitFor();
 await page.getByRole('link',{name:'Itinerary',exact:true}).click();await page.getByRole('heading',{name:/itinerary/i}).first().waitFor();
 await page.getByRole('link',{name:'Packing',exact:true}).click();await page.getByRole('heading',{name:'Smart packing'}).waitFor();
 await page.getByRole('button',{name:'✓ I Have It',exact:true}).first().click();
 await page.waitForFunction(()=>document.querySelector('.saved-trip-packing button[aria-pressed="true"]'));
 await page.reload();await page.waitForFunction(()=>document.querySelector('.saved-trip-packing button[aria-pressed="true"]'));
 await page.goto(base+'/trip-planner?trip_id='+id);await page.waitForSelector('#trip-planner-form[aria-busy="false"]');
 assert.equal(await page.locator('#start-date').inputValue(),'2026-12-03');assert.equal(await page.locator('#readiness-0').isChecked(),true);
 await page.locator('[data-step-button="4"]').click();assert.equal(await page.locator('.searched-place-row').count(),4);
 await page.goto(base+'/profile');await page.waitForFunction(()=>document.querySelector('#in-progress-trip-count')?.textContent==='1 in progress');
 await page.getByRole('button',{name:'Logout',exact:true}).click();
 await page.waitForURL(url=>url.pathname==='/');
 await page.goto(base+'/login');
 await page.locator('#login-identity').fill(username);await page.locator('#login-password').fill('Wrong!Password123');
 await page.getByRole('button',{name:/Sign in/}).click();
 await page.waitForFunction(()=>document.querySelector('#login-auth-feedback').textContent.length>0);
 await page.locator('#login-password').fill(password);await page.getByRole('button',{name:/Sign in/}).click();
 await page.waitForURL(url=>url.pathname!=='/login');
 await page.goto(base+'/trips');await page.getByRole('link',{name:'Continue Planning',exact:true}).waitFor();
 assert.equal(failed.filter(f=>f.url==='/api/auth/login'&&f.status===401).length,1,'Expected invalid-credential rejection');
 failed.splice(0,failed.length,...failed.filter(f=>!(f.url==='/api/auth/login'&&f.status===401)));
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 console.log('PASS: Home→UI signup→calendar→travelers→budget→halal/interests→four global searches→real recommendations→preferences→save→My Trips→Continue→itinerary→packing→edit/restore→Profile. Console/network clean.');
} finally {
 await browser.close();const db=getDatabasePool();
 // Username fallback also cleans up if signup succeeded but an assertion failed before reading its ID.
 if(!userId){const [rows]=await db.execute('SELECT id FROM users WHERE username=?',[username]);userId=rows[0]?.id;}
 if(userId){await db.execute('DELETE FROM trip_sessions WHERE user_id=?',[userId]);await db.execute('DELETE FROM users WHERE id=?',[userId]);}
 await db.end();
}
