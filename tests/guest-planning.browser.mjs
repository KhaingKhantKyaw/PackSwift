// Run with Node (set PLAYWRIGHT_MODULE / CHROME_PATH to use an existing browser installation).
// Only bundled pages are served; no database, credentials, booking service or mail provider is used.
import assert from 'node:assert/strict';
import express from 'express';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const app = express();
app.use(express.static(fileURLToPath(new URL('../public/', import.meta.url)), { extensions: ['html'] }));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const user = { id: 37, username: 'Planner37', fullName: 'Trip Tester', email: 'planner@example.test' };
const id = '00000000-0000-4000-8000-000000000037';
const year = new Date().getFullYear() + 1;
const details = { origin: 'Yangon', destination: 'Bangkok', startDate: year + '-02-07', endDate: year + '-02-10', adults: '2', travelStyle: 'Balanced' };
let browser;

async function session(signedIn = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const writes = [], temporaryRequests = [], errors = [];
  let signed = signedIn;
  await context.addInitScript(() => {
    window.addEventListener('packswift:planner-loaded', () => { window.plannerTestReady = true; }, { once: true });
  });
  const watch = page => page.on('pageerror', error => errors.push(error.message));
  context.on('page', watch);
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (url.origin !== origin) return route.abort();
    if (!path.startsWith('/api/')) return route.continue();
    const json = (body, status = 200) => route.fulfill({ status, json: body });
    if (path === '/api/auth/me') return json({ user: signed ? user : null });
    if (['/api/auth/login', '/api/auth/signup'].includes(path) && request.method() === 'POST') {
      signed = true;
      return json({ user });
    }
    if (path.startsWith('/api/trip-drafts')) {
      temporaryRequests.push(path);
      return json({ message: 'Guest planning must not require a database draft.' }, 503);
    }
    if (path.startsWith('/api/trips/') && ['PUT', 'POST', 'PATCH'].includes(request.method())) {
      writes.push({ path, method: request.method(), body: request.postDataJSON(), signed });
      return signed ? json({ tripId: id, budgetStatus: 'complete' }) : json({ message: 'Sign in' }, 401);
    }
    if (path === '/api/trips/' + id) return json({ trip: { id, preferences: { detailPlanning: writes.at(-1)?.body } } });
    if (path === '/api/places' || path.startsWith('/api/places/transport')) return json([]);
    if (path === '/api/v1/trips/live-review') return json({ itinerary: [] });
    return json({ items: [], places: [], suggestions: [], activities: [], itinerary: [] });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7500);
  return { context, page, writes, temporaryRequests, errors };
}

async function enterPlanner(page, home = false) {
  await page.goto(origin + (home ? '/' : '/trip-planner'), { waitUntil: 'domcontentloaded' });
  if (home) {
    await page.getByRole('link', { name: /^log\s?in$/i }).first().waitFor();
    const cta = page.locator('#slider-plan');
    assert.match(await cta.innerText(), /plan (a |your )?trip/i);
    assert.equal(new URL(await cta.getAttribute('href'), origin).pathname, '/trip-planner');
    await cta.click();
  }
  await page.waitForFunction(() => window.plannerTestReady);
  assert.equal(new URL(page.url()).pathname, '/trip-planner');
  assert.equal(await page.getByRole('dialog').count(), 0);
}
async function setTrip(page) {
  // The dates and counts are backed by native form controls; their input/change events are what
  // the custom pickers and steppers emit. The save and authentication UI are clicked normally.
  await page.evaluate(values => {
    const form = document.getElementById('trip-planner-form');
    for (const [name, value] of Object.entries(values)) {
      const field = form.elements[name];
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, details);
  await page.locator('.planner-section-nav').getByRole('button',{name:'Packing & tips',exact:true}).click();
  const packing = page.locator('[data-preview-section="Packing List"] details[data-category="My Items"]');
  if (!await packing.evaluate(section => section.open)) await packing.locator('summary').click();
  const item = packing.getByRole('textbox', { name: 'New item in My Items' });
  await item.fill('Film camera');
  await item.press('Enter');
  await packing.getByRole('checkbox', { name: 'Packed Film camera' }).check();
  await page.locator('.compact-trip-estimate').getByText('Budget optional · add later',{exact:true}).waitFor();
}
const saveButton = page => page.getByRole('button', { name: 'Save to My Trips', exact: true });
async function openGate(page) {
  await saveButton(page).click();
  const gate = page.getByRole('dialog', { name: 'Save to My Trips', exact: true });
  await gate.waitFor();
  return gate;
}
async function loginOrSignup(page, mode) {
  const form = page.locator('[data-auth-form="' + mode + '"]');
  if (mode === 'signup') {
    await form.locator('[name=fullName]').fill(user.fullName);
    await form.locator('[name=username]').fill(user.username);
    await form.locator('[name=email]').fill(user.email);
  } else {
    await form.locator('[name=identity]').fill(user.email);
  }
  await form.locator('[name=password]').fill('Demo-Only-2029!');
  await form.locator('button[type=submit]').click();
}
function checkSave(s) {
  assert.deepEqual(s.writes.map(w => [w.path, w.method, w.signed]), [['/api/trips/draft', 'POST', true]], 'one authenticated creation, never an anonymous write');
  const fields = s.writes[0].body.fields;
  for (const [name, value] of Object.entries(details)) assert.equal(fields.find(f => f.name === name)?.value, value, name + ' preserved');
  const packed = JSON.parse(fields.find(f => f.name === 'packingSnapshot').value);
  assert.ok(packed.some(item => item.name === 'Film camera' && item.packed), 'custom checked packing item retained');
  assert.equal(fields.find(f => f.name === 'budget')?.value, '', 'unknown budget remains blank and can be completed after saving');
  assert.deepEqual(s.temporaryRequests, [], 'no server draft is needed before authentication');
  assert.deepEqual(s.errors, [], 'no uncaught browser errors');
}
async function saved(s) {
  await s.page.waitForURL(url => url.searchParams.get('trip_id') === id);
  checkSave(s);
  await s.page.reload({ waitUntil: 'domcontentloaded' });
  await s.page.waitForFunction(() => window.plannerTestReady);
  checkSave(s);
}
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  for (const mode of ['login', 'signup']) {
    const s = await session(), { page } = s;
    try {
      await enterPlanner(page, mode === 'login');
      await setTrip(page);
      assert.equal(s.writes.length, 0);
      let gate = await openGate(page);
      if (mode === 'login') {
        await gate.getByRole('button', { name: 'Keep planning' }).click();
        await gate.waitFor({ state: 'hidden' });
        assert.equal(await page.locator('#destination-search').inputValue(), details.destination);
        assert.equal(s.writes.length, 0);
        gate = await openGate(page);
        await gate.getByRole('link', { name: /^Log in$/i }).click();
        await page.getByRole('link', { name: 'Back to planning' }).click();
        await page.waitForFunction(() => window.plannerTestReady);
        assert.equal(await page.locator('#origin-search').inputValue(), details.origin);
        assert.deepEqual(JSON.parse((await page.locator('#planning-support-state').inputValue())||'{}'), {});
        assert.equal(s.writes.length, 0);
        gate = await openGate(page);
      }
      await gate.getByRole('link', { name: mode === 'login' ? /^Log in$/i : /^Create (an )?account$/i }).click();
      const redirect = new URL(page.url()).searchParams.get('redirect');
      assert.match(redirect, /^\/trip-planner\?resume_draft=[a-z\d-]+$/i);
      if (mode === 'signup') {
        // Switching between auth forms must retain the same pending save.
        await page.locator('.auth-switch a').click();
        assert.equal(new URL(page.url()).pathname, '/login');
        await page.locator('.auth-switch a').click();
        assert.equal(new URL(page.url()).searchParams.get('redirect'), redirect);
      }
      assert.equal(s.writes.length, 0);
      await loginOrSignup(page, mode);
      await saved(s);
      console.log('PASS guest → ' + mode + ' → original trip saved once (including refresh)');
    } finally { await s.context.close(); }
  }
  const s = await session(true);
  try {
    // A copied handoff URL in a fresh tab should not create a trip or consume another tab's draft.
    await s.page.goto(origin + '/trip-planner?resume_draft=550e8400-e29b-41d4-a716-446655440000');
    await s.page.waitForFunction(() => window.plannerTestReady);
    assert.equal(s.writes.length, 0);
    await enterPlanner(s.page);
    await setTrip(s.page);
    await saveButton(s.page).click();
    await saved(s);
    assert.equal(await s.page.getByRole('dialog').count(), 0);
    console.log('PASS stale link does not save; signed-in planner saves directly');
  } finally { await s.context.close(); }
  const retry = await session();
  try {
    const {page}=retry;
    await enterPlanner(page);await setTrip(page);
    const gate=await openGate(page);await gate.getByRole('link',{name:'Log in',exact:true}).click();
    let firstBody;
    await page.route('**/api/trips/draft',async route=>{
      firstBody=route.request().postDataJSON();
      await route.fulfill({status:503,json:{message:'Please retry this save.'}});
    },{times:1});
    await loginOrSignup(page,'login');
    await page.getByText('Please retry this save.',{exact:true}).filter({visible:true}).first().waitFor();
    assert.equal(await page.locator('#destination-search').inputValue(),details.destination);
    await saveButton(page).click();await saved(retry);
    assert.ok(firstBody.guestSaveId);
    assert.equal(firstBody.guestSaveId,retry.writes[0].body.guestSaveId);
    console.log('PASS failed account save retains the trip and retries with the same save ID');
  } finally { await retry.context.close(); }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
