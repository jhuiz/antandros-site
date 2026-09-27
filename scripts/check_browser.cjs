/* Local or AETERNA_SITE_ORIGIN browser verification. Requires Playwright, no build step. */
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon' };
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
    let origin;
    if (process.env.AETERNA_SITE_ORIGIN) {
      const remote = new URL(process.env.AETERNA_SITE_ORIGIN);
      assert(['http:', 'https:'].includes(remote.protocol) && remote.pathname === '/' && !remote.search && !remote.hash, 'AETERNA_SITE_ORIGIN must be an HTTP(S) origin');
      origin = remote.origin;
    } else {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      origin = `http://127.0.0.1:${server.address().port}`;
    }
    const channel = process.env.AETERNA_BROWSER_CHANNEL || 'msedge';
    browser = await chromium.launch({ headless: true, ...(channel === 'chromium' ? {} : { channel }) });
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    const articleRoute = '/articles/why-spacecraft-need-maneuverability.html';
    const articleTwoRoute = '/articles/why-orbits-change.html';
    const articleRoutes = [articleRoute, articleTwoRoute];
    const routes = ['/', '/propulsion.html', '/fluid-controls.html', '/articles/', ...articleRoutes];
    for (const width of [320, 768, 900, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        const response = await page.goto(origin + route);
        assert.equal(response.status(), 200, `Unexpected status: ${route}`);
        assert(!/\b(?:noindex|none)\b/i.test(response.headers()['x-robots-tag'] || ''), `Noindex response header: ${route}`);
        assert.equal(await page.locator('h1').count(), 1);
        const canonical = 'https://aeternasidera.com' + route;
        assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), canonical);
        assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), canonical);
        assert(!/\b(?:noindex|nofollow|none)\b/i.test(await page.locator('meta[name="robots"]').getAttribute('content')), `Not indexable: ${route}`);
        assert.equal(await page.locator('.site-nav a:visible').count(), 5, `Hidden navigation at ${width}: ${route}`);
        assert.equal(await page.locator('.site-nav a', { hasText: 'Propulsion' }).getAttribute('href'), '/propulsion.html');
        if (route === '/propulsion.html') assert.equal(await page.locator('.site-nav [aria-current="page"]').textContent(), 'Propulsion');
        if (route === '/') {
          for (const selector of ['.hero-background', '.founder-portrait img']) {
            const picture = page.locator(selector);
            await picture.scrollIntoViewIfNeeded();
            await picture.evaluate(img => img.decode());
            assert(await picture.evaluate(img => img.naturalWidth > 0 && img.clientWidth > 0), `${selector} did not render`);
            assert.match(await picture.getAttribute('src'), /\.webp$/, `${selector} must use its optimized derivative`);
            if (selector === '.hero-background') {
              assert.equal(await picture.getAttribute('alt'), '');
              assert.equal(await picture.getAttribute('aria-hidden'), 'true');
              assert(await picture.evaluate(img => {
                const image = img.getBoundingClientRect();
                const hero = img.closest('.home-hero').getBoundingClientRect();
                return Math.abs(image.width - hero.width) < 1 && Math.abs(image.height - hero.height) < 1 && getComputedStyle(img).position === 'absolute';
              }), 'Hero background must fill its section');
            } else {
              assert(await picture.getAttribute('alt'), `${selector} needs an accessible description`);
            }
          }
          assert.match(await page.locator('.hero-art-credit').innerText(), /Concept illustration/);
          await page.evaluate(() => scrollTo(0, 0));
        }
        if (route === '/fluid-controls.html') {
          assert.match(await page.locator('.hero').innerText(), /vertically integrated propulsion/);
          assert.match(await page.locator('.hero').innerText(), /independent supply/);
          assert.equal(await page.locator('.hero#product-direction').count(), 1);
          assert.equal(await page.getByText('Evaluation hardware is not yet available.', { exact: true }).count(), 1);
        }
        if (route === '/articles/') {
          assert.equal(await page.locator('.article-teaser').count(), articleRoutes.length);
          for (const publishedRoute of articleRoutes) {
            const link = page.locator(`.article-teaser h2 a[href="${publishedRoute}"]`);
            assert.equal(await link.count(), 1);
            assert(await link.isVisible());
          }
        }
        if (route === articleTwoRoute) {
          assert.equal(await page.locator('.equation math').count(), 5);
          assert(await page.locator('.equation math').evaluateAll(equations => equations.every(equation =>
            equation.namespaceURI === 'http://www.w3.org/1998/Math/MathML' && equation.getAttribute('aria-label') && equation.getBoundingClientRect().height > 0)), 'Native equations did not render');
          assert.equal(await page.locator('figure.orbital-figure').count(), 3);
          await page.waitForSelector('#orbital-frame-svg[data-projection="orthographic"]');
          await page.waitForSelector('#geo-libration-illustration[data-chart-ready="true"]');
          assert.equal(await page.locator('#orbital-frame-svg [data-orbital-frame-label]').count() >= 9, true);
          assert.equal(await page.locator('#precession-illustration svg.precession-geometry').count(), 2);
        }
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
    // Explicitly return to Article 1 now that Article 2 ends the responsive loop.
    await page.goto(origin + articleRoute);
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

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(origin + articleTwoRoute);
    const geo = page.locator('#geo-libration-illustration');
    await page.waitForSelector('#geo-libration-illustration[data-chart-ready="true"]');
    assert.equal(await geo.getAttribute('data-playing'), 'false');
    const initialGeoTime = await geo.getAttribute('data-time');
    const initialPrecessionTime = await page.locator('#precession-elapsed').innerText();
    await page.waitForTimeout(180);
    assert.equal(await geo.getAttribute('data-time'), initialGeoTime, 'GEO must not autoplay');
    assert.equal(await page.locator('#precession-elapsed').innerText(), initialPrecessionTime, 'Precession must not autoplay');
    for (const [percent, fixedTime] of [[0, '18:00'], [25, '12:00'], [50, '06:00'], [75, '00:00'], [100, '18:00']]) {
      await page.locator('#precession-year-position').fill(String(percent));
      assert.equal(await page.locator('#precession-follow-time').innerText(), '18:00');
      assert.equal(await page.locator('#precession-fixed-time').innerText(), fixedTime);
      await page.waitForFunction(degrees => Number(document.querySelector('#precession-follow-svg').dataset.nodeDegrees) === degrees, 90 + percent * 3.6);
      assert.equal(Number(await page.locator('#precession-fixed-svg').getAttribute('data-node-degrees')), 90);
    }
    const referencePosition = await page.locator('#geo-dial-marker-reference').getAttribute('transform');
    for (const [time, smaller, larger] of [[0, 0, 0], [0.25, 0.5, 1.8], [0.5, 0, 0], [0.75, -0.5, -1.8], [1, 0, 0], [3, 0, 0]]) {
      await page.locator('#geo-time').fill(String(time));
      assert.equal(Number(await geo.getAttribute('data-time')), time);
      assert.equal(Number(await page.locator('[data-playhead]').getAttribute('data-time')), time, 'Shared slider must update plot time');
      for (const [id, expected] of [['reference', 0], ['smaller', smaller], ['larger', larger]]) {
        for (const selector of [`#geo-dial-marker-${id}`, `[data-playhead-marker="${id}"]`]) {
          assert(Math.abs(Number(await page.locator(selector).getAttribute('data-q')) - expected) < 1e-8, `GEO ${id} at ${time}: ${selector}`);
        }
        assert.equal(await page.locator(`#geo-dial-marker-${id}`).getAttribute('data-in-band'), String(Math.abs(expected) <= 1));
      }
      assert.equal(await page.locator('#geo-dial-marker-reference').getAttribute('transform'), referencePosition, 'Geostationary reference must remain fixed');
    }
    await page.locator('#geo-time').fill('0');
    await page.locator('#geo-play').click();
    await page.waitForFunction(() => Number(document.querySelector('#geo-libration-illustration').dataset.time) > 0);
    await page.locator('#geo-play').click();
    assert.equal(await geo.getAttribute('data-playing'), 'false');
    const pausedGeoTime = await geo.getAttribute('data-time');
    await page.waitForTimeout(100);
    assert.equal(await geo.getAttribute('data-time'), pausedGeoTime);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('#geo-play').disabled);
    assert(await page.locator('#geo-play').isDisabled());
    await page.locator('#geo-time').fill('0.25');
    assert.equal(await page.locator('[data-geo-value="larger"]').innerText(), '+1.80 · outside band');
    assert.equal(await geo.getAttribute('data-playing'), 'false');
    await page.locator('#precession-year-position').fill('75');
    assert.equal(await page.locator('#precession-fixed-time').innerText(), '00:00');
    assert.equal(Number(await page.locator('#precession-follow-svg').getAttribute('data-node-degrees')), 360);

    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
    const fallback = await noJs.newPage();
    await fallback.goto(origin + articleRoute);
    assert.equal(await fallback.locator('.phasing-controls').isVisible(), false);
    assert(await fallback.locator('.phasing-diagram').isVisible());
    assert.equal(await fallback.locator('#phasing-lag').innerText(), '10.01');
    await fallback.goto(origin + articleTwoRoute);
    assert.equal(await fallback.locator('.equation math').count(), 5);
    assert.equal(await fallback.locator('.figure-fallback').count(), 3);
    for (const description of await fallback.locator('.figure-fallback').all()) assert(await description.isVisible());
    assert.equal(await fallback.locator('input[type="range"], #geo-play').count(), 0);
    assert(await fallback.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No-JS Article 2 overflow');
    await noJs.close();
    await page.goto(origin + '/');
    await page.getByRole('link', { name: 'Propulsion', exact: true }).click();
    assert.equal(new URL(page.url()).pathname, '/propulsion.html');
    assert.equal(new URL(page.url()).hash, '');
    assert.deepEqual(errors, []);
    console.log('PASS: 24 responsive page checks, metadata, article index, homepage artwork and portrait, navigation, favicon rendering, keyboard entry, phasing, five native equations, three orbital diagrams, precession quarters, shared GEO states, reduced motion, no-JS fallbacks, and no browser errors');
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
