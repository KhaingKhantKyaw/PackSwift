// Run with: node tests/theme-readability.browser.mjs (PLAYWRIGHT_MODULE and CHROME_PATH are optional).
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import express from 'express';

const {chromium} = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const app = express();
app.use(express.static(fileURLToPath(new URL('../public/', import.meta.url)), {extensions: ['html']}));
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve, reject) => server.once('listening', resolve).once('error', reject));
const base = 'http://127.0.0.1:' + server.address().port;
const failures = [];
let browser;
let samples = 0;

// Sample the actual painted surface underneath the text, including translucent
// ancestors, gradients and photos. Hiding just the ink keeps layout and fills intact.
async function checkText(page, selector, mode, pseudo = '') {
  const subject = page.locator(selector).first();
  await subject.scrollIntoViewIfNeeded({timeout: 4500});
  const ink = await subject.evaluate((el, pseudo) => {
    const style = getComputedStyle(el, pseudo || null);
    const bounds = el.getBoundingClientRect();
    // Use a text fragment to avoid sampling icons, padding or control borders.
    let rect;
    for (const node of el.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
      const r = document.createRange(); r.selectNodeContents(node);
      rect = r.getClientRects()[0];
      if (rect?.width) break;
    }
    const x = rect?.width ? rect.left - bounds.left + rect.width * .5 :
      Math.min(bounds.width / 2, parseFloat(style.paddingLeft) + 15);
    const y = rect?.height ? rect.top - bounds.top + rect.height / 2 : bounds.height / 2;
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = style.webkitTextFillColor || style.color;
    ctx.fillRect(0, 0, 1, 1);
    const rgba = [...ctx.getImageData(0, 0, 1, 1).data];
    let opacity = pseudo ? Number(style.opacity) : 1;
    for (let node = el; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    el.setAttribute('data-contrast-probe', '');
    return {rgba, opacity, x, y};
  }, pseudo);
  let png;
  try {
    png = (await subject.screenshot({scale: 'css', animations: 'disabled', timeout: 5000})).toString('base64');
  } finally {
    await subject.evaluate(el => el.removeAttribute('data-contrast-probe'));
  }
  const ratio = await page.evaluate(async ({png, ink}) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + png;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
    const bg = ctx.getImageData(Math.min(img.width - 1, Math.max(0, Math.round(ink.x))),
      Math.min(img.height - 1, Math.max(0, Math.round(ink.y))), 1, 1).data;
    const alpha = ink.rgba[3] / 255 * ink.opacity;
    const fg = ink.rgba.slice(0, 3).map((v, i) => v * alpha + bg[i] * (1 - alpha));
    function luminance(rgb) {
      const [r, g, b] = Array.from(rgb).slice(0, 3).map(v => {
        const c = v / 255;
        return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
      });
      return .2126 * r + .7152 * g + .0722 * b;
    }
    const a = luminance(fg), b = luminance(bg);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  }, {png, ink});
  samples++;
  if (ratio < 4.5) failures.push(`${mode} ${new URL(page.url()).pathname} ${selector}${pseudo}: ${ratio.toFixed(2)}:1`);
}
async function checkPage(page, mode, probes) {
  await page.addStyleTag({content: '[data-contrast-probe], [data-contrast-probe] *, [data-contrast-probe]::placeholder {-webkit-text-fill-color:transparent!important;text-shadow:none!important;}'});
  for(const probe of probes) await checkText(page, ...(Array.isArray(probe) ? [probe[0], mode, probe[1]] : [probe, mode]));
}

try {
  browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH});
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce', colorScheme: 'light'});
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const flight = url.pathname.endsWith('/flights');
    const data = url.pathname.startsWith('/api/booking-search/')
      ? {source: 'Test provider', searchedAt: new Date().toISOString(), items: [{
        title: flight ? 'Sample airline' : 'Sample hotel', detail: 'Tokyo · example quote',
        price: 'THB 5,200', priceLabel: 'Reported total', url: flight ? 'https://www.google.com/travel/flights' : undefined}]}
      : url.pathname.endsWith('/popular-activities')
      ? {items: [{id: 'tokyo-market', name: 'Explore the market', rating: 4.7, ratingCount: 21}]}
      : url.pathname === '/api/auth/me' ? {user: null} : {items: [], places: [], suggestions: [], itinerary: []};
    return route.fulfill({json: data});
  });
  const page = await context.newPage();
  const waitTheme = theme => page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
  const nav = async path => { await page.goto(base + path); await page.locator('.ps-header-theme').waitFor(); };
  const sections = [
    ['/', ['.ps-header-link', '.ps-header-action[href="/login"]', '#slider-plan']],
    ['/help', ['.ps-help-panel h2', '.concierge-faq label', ['#help-search', '::placeholder'], '#contact p']],
    ['/login', ['.auth-panel .panel-title', '.auth-panel .panel-copy', 'label[for="login-identity"]',
      ['#login-identity', '::placeholder'], '.auth-panel button[type="submit"]', '.auth-switch a']],
  ];
  const day = delta => new Date(Date.now() + delta * 86400000).toISOString().slice(0, 10);
  for (const mode of ['light', 'dark']) {
    await nav('/');
    if (mode === 'dark') {
      await page.locator('.ps-header-theme').click();
      await waitTheme('dark');
      await page.reload();
    }
    for (const [path, probes] of sections) {
      await nav(path); await waitTheme(mode); await checkPage(page, mode, probes);
    }
    await nav('/trip-planner'); await waitTheme(mode);
    await page.locator('.travel-guidance-panel').waitFor();
    await page.evaluate(values => {
      for (const [name, value] of Object.entries(values)) {
        const field = document.querySelector(`[name="${name}"]`);
        field.value = value;
        for (const event of ['input', 'change']) field.dispatchEvent(new Event(event, {bubbles: true}));
      }
    }, {origin: 'Bangkok', destination: 'Tokyo', startDate: day(40), endDate: day(44), travelPurposes: '["Food, Drink & Culinary"]', travelStyle: 'Balanced'});
    const panel = page.locator('[data-preview-section="Flight & Stay"]');
    for (const [button, region] of [['Search flights', 'Flight search results'], ['Search stays', 'Stay search results']]) {
      await panel.getByRole('button', {name: button, exact: true}).click();
      await panel.getByRole('region', {name: region}).locator('.booking-result').first().waitFor();
    }
    const activity = page.locator('.activity-preview-card').first();
    await activity.waitFor();
    const like = activity.locator('[data-vote="up"]');
    if (await like.getAttribute('aria-pressed') !== 'true') await like.click();
    await checkPage(page, mode, ['.sketch-field[data-field="Location"] h2', '#origin-search', '.travel-guidance-choice-title',
      '.booking-option-controls .booking-search-link', '.booking-currency-note', '.booking-stay-filter input',
      '[aria-label="Flight search results"] .booking-result strong:nth-of-type(2)', '[aria-label="Flight search results"] .booking-result-action',
      '[aria-label="Stay search results"] .booking-result small', '[aria-label="Stay search results"] .booking-result-action',
      '.activity-preview-body h3', '.activity-preview-rating strong', '.activity-preview-rating span:last-child',
      '.activity-preview-actions [aria-pressed="true"] span']);
  }
  await page.evaluate(() => window.PackSwift.setThemePreference('system'));
  await waitTheme('light');
  await page.emulateMedia({colorScheme: 'dark'}); await waitTheme('dark');
  await page.reload(); await waitTheme('dark');
  await page.emulateMedia({colorScheme: 'light'}); await waitTheme('light');
  assert.deepEqual(failures, [], 'Text below 4.5:1 on its rendered background');
  console.log(`Passed ${samples} text contrast checks and light/dark/system theme switching.`);
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
