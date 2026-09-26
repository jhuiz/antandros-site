/* Local-only browser verification. Requires Playwright, no build step. */
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = http.createServer(async (request, response) => {
  try {
    let relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (relative.endsWith('/')) relative += 'index.html';
    const target = path.resolve(root, '.' + relative);
    if (!target.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    const data = await fs.readFile(target);
    response.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
    response.end(data);
  } catch { response.writeHead(404).end(); }
});

(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const channel = process.env.AETERNA_BROWSER_CHANNEL || 'msedge';
    browser = await chromium.launch({ headless: true, ...(channel === 'chromium' ? {} : { channel }) });
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    const articleRoute = '/articles/why-spacecraft-need-maneuverability.html';
    const routes = ['/', '/propulsion.html', '/fluid-controls.html', '/articles/', articleRoute];
    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await page.goto(origin + route);
        assert.equal(await page.locator('h1').count(), 1);
        assert.equal(await page.locator('.site-nav a:visible').count(), 5, `Hidden navigation at ${width}: ${route}`);
        assert.equal(await page.locator('.site-nav a', { hasText: 'Propulsion' }).getAttribute('href'), '/propulsion.html');
        if (route === '/propulsion.html') assert.equal(await page.locator('.site-nav [aria-current="page"]').textContent(), 'Propulsion');
        const iconUrls = await page.locator('link[rel="icon"]').evaluateAll(icons => icons.map(icon => icon.href));
        assert.equal(iconUrls.length, 2);
        for (const iconUrl of iconUrls) {
          assert(iconUrl.endsWith('?v=aeterna-mark-1'), 'Stale favicon URL');
          await page.evaluate(async url => { const icon = new Image(); icon.src = url; await icon.decode(); }, iconUrl);
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow at ${width}: ${route}`);
        await page.keyboard.press('Tab');
        assert.equal(await page.locator(':focus').textContent(), 'Skip to content');
        await page.locator('h1').click();
        if (process.env.AETERNA_SCREENSHOT_DIR && (width === 320 || width === 1280)) {
          await fs.mkdir(process.env.AETERNA_SCREENSHOT_DIR, { recursive: true });
          const name = route.replaceAll('/', '_').replace('.html', '') || 'home';
          await page.screenshot({ path: path.join(process.env.AETERNA_SCREENSHOT_DIR, `${name}-${width}.png`), fullPage: true });
          if (route === articleRoute) await page.locator('#phasing-illustration').screenshot({ path: path.join(process.env.AETERNA_SCREENSHOT_DIR, `phasing-${width}.png`) });
        }
      }
    }
    assert.equal(await page.locator('#phasing-lag').innerText(), '10.01');
    await page.locator('#phasing-time').fill('5');
    assert.equal(await page.locator('#phasing-lag').innerText(), '27.81');
    await page.locator('#phasing-time').fill('0');
    assert.equal(await page.locator('#phasing-lag').innerText(), '0.00');
    await page.locator('#phasing-play').click();
    await page.waitForTimeout(150);
    await page.locator('#phasing-play').click();
    assert(Number(await page.locator('#phasing-days').innerText()) > 0);
    const paused = await page.locator('#phasing-days').innerText();
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#phasing-days').innerText(), paused);
    await page.locator('#phasing-time').fill('9.95');
    await page.locator('#phasing-play').click();
    await page.waitForFunction(() => document.querySelector('#phasing-play').textContent === 'Replay coast');
    assert.equal(await page.locator('#phasing-days').innerText(), '10.00');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#phasing-time').fill('0');
    assert.equal(await page.locator('#phasing-play').textContent(), 'Advance 1 day');
    await page.locator('#phasing-play').click();
    assert.equal(await page.locator('#phasing-days').innerText(), '1.00');
    await page.locator('#phasing-time').fill('10');
    await page.locator('#phasing-play').click();
    assert.equal(await page.locator('#phasing-days').innerText(), '0.00');
    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
    const fallback = await noJs.newPage();
    await fallback.goto(origin + articleRoute);
    assert.equal(await fallback.locator('.phasing-controls').isVisible(), false);
    assert(await fallback.locator('.phasing-diagram').isVisible());
    assert.equal(await fallback.locator('#phasing-lag').innerText(), '10.01');
    await page.goto(origin + '/');
    await page.getByRole('link', { name: 'Propulsion', exact: true }).click();
    assert.equal(new URL(page.url()).pathname, '/propulsion.html');
    assert.equal(new URL(page.url()).hash, '');
    assert.deepEqual(errors, []);
    console.log('PASS: 15 responsive page checks, dedicated propulsion navigation, favicon rendering, keyboard entry, animation, endpoints, reduced motion, no-JS fallback, and no browser errors');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
