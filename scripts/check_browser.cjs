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

const articleSixFigures = ['#figure-valve-command-dependencies', '#figure-thermal-guide-clearance'];
async function checkArticleSixLayout(page, label) {
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('body.article-six').count(), 1, `${label}: Article 6 page class`);
  assert.equal(await page.locator('section.article-section').count(), 6, `${label}: six sections`);
  assert.equal(await page.locator('.equation-block math[display="block"]').count(), 2, `${label}: two display equations`);
  assert.equal(await page.locator('math').count(), 10, `${label}: ten native math expressions`);
  assert(await page.locator('math').evaluateAll(equations => equations.every(equation =>
    equation.namespaceURI === 'http://www.w3.org/1998/Math/MathML' && equation.getAttribute('aria-label')?.trim() && equation.getBoundingClientRect().height > 0)), `${label}: accessible native MathML`);
  assert.equal(await page.locator('.article-six-visual button, .article-six-visual select, .article-six-visual input, iframe').count(), 0, `${label}: static figures have no controls or frames`);
  assert.equal(await page.locator('#valve-command-dependencies [data-vcd-stage]').count(), 4, `${label}: four static command dependencies`);
  assert.equal(await page.locator('#thermal-guide-clearance .tgc-diagram').count(), 2, `${label}: two static clearance diagrams`);
  for (const selector of articleSixFigures) {
    const figure = page.locator(selector);
    assert(await figure.isVisible(), `${label}: visible ${selector}`);
    assert((await figure.innerText()).trim().length > 150, `${label}: meaningful static figure text`);
  }
  const inspection = await page.evaluate(() => {
    const visible = node => {
      const style = getComputedStyle(node), box = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    };
    const diagramChecks = [...document.querySelectorAll('.article-six-visual svg')].map(svg => {
      const bounds = svg.getBoundingClientRect();
      const labels = [...svg.querySelectorAll('text')].filter(visible).map(node => ({text: node.textContent, box: node.getBoundingClientRect()}));
      const tiny = [...svg.querySelectorAll('text,tspan')].filter(visible).filter(node => {
        const matrix = node.getScreenCTM();
        return parseFloat(getComputedStyle(node).fontSize) * (matrix ? Math.hypot(matrix.c, matrix.d) : 1) < 10.99;
      }).map(node => node.textContent);
      const outside = labels.filter(({box}) => box.left < bounds.left - 1 || box.right > bounds.right + 1 || box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1).map(node => node.text);
      const overlaps = [];
      for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i].box, b = labels[j].box;
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) overlaps.push([labels[i].text, labels[j].text]);
      }
      return {labels: labels.length, tiny, outside, overlaps, described: svg.getAttribute('role') === 'img' && !!svg.querySelector('title')?.textContent.trim() && !!svg.querySelector('desc')?.textContent.trim()};
    });
    const textProblems = [];
    for (const figure of document.querySelectorAll('.article-six-visual')) {
      const frame = figure.getBoundingClientRect(), walker = document.createTreeWalker(figure, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (!node.textContent.trim() || parent.closest('svg,style,script') || !visible(parent)) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = [...range.getClientRects()].filter(rect => rect.width && rect.height);
        if (parseFloat(getComputedStyle(parent).fontSize) < 10.99) textProblems.push('Tiny: ' + node.textContent.trim());
        if (rects.some(rect => rect.left < frame.left - 1 || rect.right > frame.right + 1)) textProblems.push('Outside: ' + node.textContent.trim());
      }
    }
    const clipped = [...document.querySelectorAll('.article-body math, .equation-block, .article-table, .article-visual, h1, h2, h3, h4')].filter(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.left < -0.5 || bounds.right > innerWidth + 0.5 || element.scrollWidth > element.clientWidth + 2;
    }).map(element => element.tagName + '#' + element.id);
    const moving = [...document.querySelectorAll('.article-six-visual, .article-six-visual *')].filter(node => {
      const style = getComputedStyle(node);
      return style.animationName !== 'none' && style.animationDuration.split(',').some(value => parseFloat(value) > 0);
    }).map(node => node.tagName);
    const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
    const badAria = [...document.querySelectorAll('[aria-labelledby],[aria-describedby]')].flatMap(node =>
      `${node.getAttribute('aria-labelledby') || ''} ${node.getAttribute('aria-describedby') || ''}`.trim().split(/\s+/)).filter(id => id && !document.getElementById(id));
    const badAnchors = [...document.querySelectorAll('a[href^="#"]')].map(node => node.getAttribute('href').slice(1)).filter(id => id && !document.getElementById(decodeURIComponent(id)));
    return {diagramChecks, textProblems, clipped, moving, duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i), badAria, badAnchors, overflow: document.documentElement.scrollWidth > innerWidth + 1};
  });
  assert.equal(inspection.diagramChecks.length, 2, `${label}: expected two diagram checks`);
  for (const diagram of inspection.diagramChecks) {
    assert(diagram.described && diagram.labels >= 2, `${label}: SVG names, descriptions and labels`);
    for (const key of ['tiny', 'outside', 'overlaps']) assert.deepEqual(diagram[key], [], `${label}: SVG ${key}`);
  }
  for (const key of ['textProblems', 'clipped', 'moving', 'duplicateIds', 'badAria', 'badAnchors']) assert.deepEqual(inspection[key], [], `${label}: ${key}`);
  assert(!inspection.overflow, `${label}: document overflow`);
  const text = await page.locator('main').innerText();
  assert(!/\\(?:\[|\]|\(|\)|Delta|alpha|mathrm|approx|begin|end)|\$\$/.test(text), `${label}: raw LaTeX visible`);
  assert.match(text, /one-sided radial gap = c\/2/, `${label}: diametral-versus-radial distinction`);
  assert.match(text, /not fixed delays/, `${label}: qualitative dependency boundary`);
}

async function captureArticleSix(page, directory, width, suffix = '') {
  await fs.mkdir(directory, {recursive: true});
  const items = [
    ['dependencies', page.locator(articleSixFigures[0])],
    ['clearance', page.locator(articleSixFigures[1])],
    ['pressure-equation', page.locator('.equation-block').nth(0)],
    ['clearance-equation', page.locator('.equation-block').nth(1)],
  ];
  for (const [name, locator] of items) {
    const viewport = page.viewportSize(), box = await locator.boundingBox();
    // Tall-element captures otherwise can include offscreen fixed skip links.
    if (box && box.height + 80 > viewport.height) await page.setViewportSize({...viewport, height: Math.ceil(box.height + 80)});
    await page.evaluate(() => document.activeElement?.blur());
    await locator.screenshot({path: path.join(directory, `article-six-${name}-${width}${suffix}.png`)});
    await page.setViewportSize(viewport);
  }
}

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
    const articleFourExternal = [];
    const articleFiveExternal = [];
    const articleSixExternal = [];
    let checkingArticleFour = false;
    let checkingArticleFive = false;
    let checkingArticleSix = false;
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    page.on('request', request => {
      if (checkingArticleFour && /^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) articleFourExternal.push(request.url());
      if (checkingArticleFive && /^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) articleFiveExternal.push(request.url());
      if (checkingArticleSix && /^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) articleSixExternal.push(request.url());
    });
    const articleRoute = '/articles/why-spacecraft-need-maneuverability.html';
    const articleTwoRoute = '/articles/why-orbits-change.html';
    const articleThreeRoute = '/articles/from-mission-objectives-to-maneuver-requirements.html';
    const articleFourRoute = '/articles/matching-propulsion-to-the-mission.html';
    const articleFiveRoute = '/articles/choosing-a-propulsion-system-architecture.html';
    const articleSixRoute = '/articles/turning-propulsion-architecture-into-dependable-hardware.html';
    const articleRoutes = [articleRoute, articleTwoRoute, articleThreeRoute, articleFourRoute, articleFiveRoute, articleSixRoute];
    const chartCases = [
      { figure: '#hall-power-mass-figure', root: '#hall-power-mass-chart', name: 'hall-power-mass' },
      { figure: '#mass-break-even-figure', root: '#mass-break-even-chart', name: 'mass-break-even' },
    ];
    const routes = ['/', '/propulsion.html', '/fluid-controls.html', '/articles/', ...articleRoutes];
    for (const width of [320, 768, 900, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        checkingArticleFour = route === articleFourRoute;
        checkingArticleFive = route === articleFiveRoute;
        checkingArticleSix = route === articleSixRoute;
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
        if (route === articleTwoRoute || route === articleThreeRoute || route === articleFourRoute) {
          assert.equal(await page.locator('.equation math').count(), route === articleTwoRoute ? 5 : route === articleThreeRoute ? 2 : 3);
          assert(await page.locator('.equation math').evaluateAll(equations => equations.every(equation =>
            equation.namespaceURI === 'http://www.w3.org/1998/Math/MathML' && equation.getAttribute('aria-label') && equation.getBoundingClientRect().height > 0)), 'Native equations did not render');
        }
        if (route === articleTwoRoute) {
          assert.equal(await page.locator('figure.orbital-figure').count(), 3);
          await page.waitForSelector('#orbital-frame-svg[data-projection="orthographic"]');
          await page.waitForSelector('#geo-libration-illustration[data-chart-ready="true"]');
          assert.equal(await page.locator('#orbital-frame-svg [data-orbital-frame-label]').count() >= 9, true);
          assert.equal(await page.locator('#precession-illustration svg.precession-geometry').count(), 2);
        }
        if (route === articleThreeRoute) {
          assert.equal(await page.locator('.article-section').count(), 6);
          assert.equal(await page.locator('figure.orbital-figure').count(), 2);
          await page.waitForSelector('#state-coast-figure[data-ready="true"] [data-case="b"]');
          await page.waitForSelector('#apsis-burn-figure [data-orbit="after"]');
          assert.equal(await page.locator('#apsis-burn-figure .apsis-svg').count(), 2);
          assert.equal(await page.locator('#apsis-burn-figure button, #apsis-burn-figure input').count(), 0, 'Apsis comparison is static');
          const clipped = await page.locator('.equation math, .article-table, figure, h1, h2').evaluateAll(elements => elements.filter(element => {
            const bounds = element.getBoundingClientRect();
            return bounds.left < -0.5 || bounds.right > innerWidth + 0.5 || element.scrollWidth > element.clientWidth + 2;
          }).map(element => element.tagName + '.' + element.className));
          assert.deepEqual(clipped, [], `Article 3 content clipping at ${width}`);
        }
        if (route === articleFourRoute) {
          assert.equal(await page.locator('.article-section').count(), 6);
          assert.equal(await page.locator('table.article-table').count(), 6);
          assert.equal(await page.locator('figure.comparison-figure').count(), 2);
          assert.equal(await page.locator('math').count(), 10);
          assert(await page.locator('math').evaluateAll(equations => equations.every(equation =>
            equation.namespaceURI === 'http://www.w3.org/1998/Math/MathML' && equation.getAttribute('aria-label')?.trim() && equation.getBoundingClientRect().height > 0)), 'Article 4 math needs accessible native rendering');
          assert.equal(await page.locator('.draft-notice').count(), 0, 'Public Article 4 retains draft notice');
          assert(!/Private preview|Not published|Internal editorial notes|\/mnt\/|\/home\/|C:\\Users/i.test(await page.locator('body').innerText()), 'Private material visible in Article 4');
          const metadata = await page.locator('script[type="application/ld+json"]').evaluateAll(scripts => scripts.map(script => JSON.parse(script.textContent)).filter(item => item['@type'] === 'Article'));
          assert.equal(metadata.length, 1, 'Article 4 has one Article schema');
          assert.equal(metadata[0].mainEntityOfPage, canonical);
          assert.equal(metadata[0].headline, 'Matching Propulsion to the Mission');
          assert.equal(await page.locator('meta[property="article:published_time"]').getAttribute('content'), metadata[0].datePublished);
          assert.equal(await page.locator(`time[datetime="${metadata[0].datePublished}"]`).count(), 1, 'Visible publication date agrees with schema');
          const anchors = await page.evaluate(() => {
            const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
            const broken = [...document.querySelectorAll('a[href^="#"]')].filter(node => !document.getElementById(decodeURIComponent(node.getAttribute('href').slice(1)))).map(node => node.getAttribute('href'));
            return { count: ids.length, unique: new Set(ids).size, broken };
          });
          assert.equal(anchors.count, anchors.unique, 'Article 4 IDs are unique');
          assert.deepEqual(anchors.broken, [], 'Article 4 fragment links resolve');
          for (const item of chartCases) {
            await page.waitForSelector(`${item.root}[data-chart-ready="true"][data-model-checks="passed"] svg`);
            const chart = page.locator(`${item.root} svg`);
            assert.equal(await chart.getAttribute('role'), 'img');
            assert.equal(await chart.getAttribute('data-model-checks'), 'passed');
            assert((await chart.locator('title').textContent()).trim());
            assert((await chart.locator('desc').textContent()).trim());
            const labels = await chart.evaluate(svg => {
              const bounds = svg.getBoundingClientRect();
              const text = [...svg.querySelectorAll('text')].filter(node => node.textContent.trim());
              return {
                tiny: text.filter(node => {
                  const matrix = node.getScreenCTM();
                  const scale = matrix ? Math.hypot(matrix.c, matrix.d) : 1;
                  return parseFloat(getComputedStyle(node).fontSize) * scale < 11.9;
                }).map(node => node.textContent),
                outside: text.filter(node => {
                  const box = node.getBoundingClientRect();
                  return box.left < bounds.left - 1 || box.right > bounds.right + 1 || box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1;
                }).map(node => node.textContent),
              };
            });
            assert.deepEqual(labels.tiny, [], `${item.name} labels below 12 px at ${width}`);
            assert.deepEqual(labels.outside, [], `${item.name} labels outside chart at ${width}`);
          }
          const clipped = await page.locator('.article-body math, .article-table, figure, h1, h2, h3').evaluateAll(elements => elements.filter(element => {
            const bounds = element.getBoundingClientRect();
            return bounds.left < -0.5 || bounds.right > innerWidth + 0.5 || element.scrollWidth > element.clientWidth + 2;
          }).map(element => element.tagName + '#' + element.id));
          assert.deepEqual(clipped, [], `Article 4 content clipping at ${width}`);
          // Independently recalculate the two plotted reference cases, rather than only trusting the chart's self-check flag.
          const audits = await page.locator('#hall-power-mass-chart, #mass-break-even-chart').evaluateAll(roots => Object.fromEntries(roots.map(root => [root.id, JSON.parse(root.dataset.chartAudit)])));
          const hall = audits['hall-power-mass-chart'];
          const mass = audits['mass-break-even-chart'];
          const close = (actual, expected, label) => assert(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} != ${expected}`);
          const exhaust = 9.80665 * 1400;
          close(hall.delta_v_m_s, 262.4695436105533, 'Hall reference delta-v');
          close(hall.assumed_total_propellant_isp_s, 1400, 'Hall Isp boundary');
          close(hall.assumed_complete_input_efficiency, 0.30, 'Hall total-input efficiency');
          close(hall.assumed_operating_availability, 1, 'Continuous-firing screen');
          close(hall.assumed_other_overhead_days, 0, 'Optimistic readiness overhead');
          close(hall.common_hardware_mass_only_kg, 100, 'Common bus excludes propulsion installation');
          const points = await page.locator('#hall-power-mass-chart .chart-marker').evaluateAll(markers => markers.map(node => ({ power: Number(node.dataset.powerW), days: Number(node.dataset.deadlineDays), mass: Number(node.dataset.massKg) })));
          assert.equal(points.length, 4);
          for (const point of points) {
            const expected = (2 * 0.30 * point.power / exhaust) * point.days * 86400 / (exhaust * Math.expm1(262.4695436105533 / exhaust));
            close(point.mass, expected, 'Hall marker mass ceiling');
            close(hall.checkpoints_mass_ceiling_kg_by_days_then_watts[point.days.toFixed(1)][String(point.power)], expected, 'Hall audit checkpoint');
          }
          close(mass.hydrazine_retained_mass_kg, 120, 'Assumed hydrazine retained mass');
          close(mass.hydrazine_isp_s, 220, 'Hydrazine reference Isp');
          close(mass.bipropellant_isp_s, 290, 'Bipropellant reference Isp');
          const extra = 120 * Math.expm1(262.3887989371143 / 9.80665 * (1 / 220 - 1 / 290));
          const initialMono = 120 * Math.exp(262.3887989371143 / (9.80665 * 220));
          close(mass.break_even_extra_retained_kg, extra, 'Extra retained-mass break-even');
          close(mass.equal_initial_mass_kg, initialMono, 'Equal starting mass');
          close(Number(await page.locator('[data-break-even-kg]').getAttribute('data-break-even-kg')), extra, 'Break-even marker');
          close(Number(await page.locator('[data-break-even-kg]').getAttribute('data-starting-mass-difference-kg')), 0, 'Break-even zero crossing');
          assert(mass.initial_mass_difference_at_0_kg < 0 && mass.initial_mass_difference_at_8_kg > 0, 'Break-even curve has correct sign');
        }
        if (route === articleFiveRoute) {
          assert.equal(await page.locator('section.article-section').count(), 6, 'Article 5 has six sections');
          assert.equal(await page.locator('table.article-table').count(), 2, 'Article 5 has two tables');
          assert.equal(await page.locator('.article-five-visual').count(), 2, 'Article 5 has two integrated visual roots');
          assert.equal(await page.locator('.draft-notice, .preview-status, iframe').count(), 0, 'Article 5 retains private preview chrome');
          const publicText = await page.locator('body').innerText();
          assert(!/Private preview|Not published|Internal editorial notes|\/mnt\/|\/home\/|C:\\Users|\bour (?:spacecraft|example|configuration|architecture|propellant)\b/i.test(publicText), 'Private material or selected-design perspective visible in Article 5');
          assert(publicText.includes('does not report Aeterna hardware performance, qualification or flight results'), 'Article 5 evidence boundary missing');
          const metadata = await page.locator('script[type="application/ld+json"]').evaluateAll(scripts => scripts.map(script => JSON.parse(script.textContent)).filter(item => item['@type'] === 'Article'));
          assert.equal(metadata.length, 1, 'Article 5 has one Article schema');
          assert.equal(metadata[0].mainEntityOfPage, canonical);
          assert.equal(metadata[0].headline, 'Choosing a Propulsion System Architecture');
          assert.equal(metadata[0].datePublished, '2026-09-29');
          assert.equal(await page.locator('meta[property="article:published_time"]').getAttribute('content'), metadata[0].datePublished);
          assert.equal(await page.locator(`time[datetime="${metadata[0].datePublished}"]`).count(), 1, 'Article 5 visible date agrees with schema');
          const anchors = await page.evaluate(() => {
            const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
            return {
              count: ids.length, unique: new Set(ids).size,
              broken: [...document.querySelectorAll('a[href^="#"]')].filter(node => !document.getElementById(decodeURIComponent(node.getAttribute('href').slice(1)))).map(node => node.getAttribute('href')),
            };
          });
          assert.equal(anchors.count, anchors.unique, 'Article 5 IDs are unique');
          assert.deepEqual(anchors.broken, [], 'Article 5 fragment links resolve');
          await page.evaluate(() => document.fonts.ready);
          await page.waitForFunction(() => document.querySelectorAll('.article-five-visual svg text').length > 20);
          assert.equal(await page.locator('#propulsion-operating-timeline button, #propulsion-operating-timeline select, #propulsion-operating-timeline input').count(), 0, 'Article 5 timeline must remain static, without a dropdown');
          const timeline = await page.locator('.pot-chart').innerHTML();
          for (const mode of ['overview', 'shared', 'isolated']) {
            // Programmatic activation preserves the page's initial keyboard-entry check below.
            await page.locator(`[data-pam-mode="${mode}"]`).evaluate(button => button.click());
            const state = await page.evaluate(() => ({
              pressed: [...document.querySelectorAll('[data-pam-mode][aria-pressed="true"]')].map(button => button.dataset.pamMode),
              blocked: document.querySelectorAll('.pam-blocked').length,
              active: document.querySelectorAll('.pam-active').length,
              mapText: [...document.querySelectorAll('.pam-map text')].map(node => [...node.querySelectorAll('tspan')].map(span => span.textContent).join(' ')).join(' | '),
            }));
            assert.deepEqual(state.pressed, [mode], `Article 5 map state ${mode} at ${width}`);
            assert.equal(state.blocked, mode === 'isolated' ? 2 : 0, 'Isolation cuts both propellant paths to branch A only');
            assert.equal(state.active, mode === 'shared' ? 2 : 0, 'Shared demand marks both groups');
            if (mode === 'shared') assert.equal((state.mapText.match(/Commanded firing/g) || []).length, 2);
            if (mode === 'isolated') assert(state.mapText.includes('Supply removed') && state.mapText.includes('Paths connected'), 'Isolation distinguishes disconnected A and connected B');
            assert.equal(await page.locator('.pot-chart').innerHTML(), timeline, 'Map interaction must not alter the static timeline');
            for (const selector of ['.pam-map', '.pot-chart']) {
              const svg = page.locator(selector);
              assert.equal(await svg.getAttribute('role'), 'img');
              assert((await svg.locator('title').textContent()).trim());
              assert((await svg.locator('desc').textContent()).trim());
              const fit = await svg.evaluate(svg => {
                const bounds = svg.getBoundingClientRect();
                const labels = [...svg.querySelectorAll('text')].filter(node => node.textContent.trim()).map(node => {
                  const rect = node.getBoundingClientRect();
                  const matrix = node.getScreenCTM();
                  return { text: node.textContent, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, size: parseFloat(getComputedStyle(node).fontSize) * (matrix ? Math.hypot(matrix.c, matrix.d) : 1) };
                });
                const overlaps = [];
                for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
                  const a = labels[i], b = labels[j];
                  if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) overlaps.push([a.text, b.text]);
                }
                return {
                  count: labels.length,
                  outside: labels.filter(label => label.left < bounds.left - 1 || label.right > bounds.right + 1 || label.top < bounds.top - 1 || label.bottom > bounds.bottom + 1).map(label => label.text),
                  tiny: labels.filter(label => label.size < 11).map(label => label.text),
                  overlaps,
                };
              });
              assert(fit.count > 10, `Article 5 ${selector} did not render`);
              assert.deepEqual(fit.tiny, [], `Article 5 ${selector} labels below 11 px at ${width}/${mode}`);
              assert.deepEqual(fit.outside, [], `Article 5 ${selector} clipped labels at ${width}/${mode}`);
              assert.deepEqual(fit.overlaps, [], `Article 5 ${selector} overlapping labels at ${width}/${mode}`);
            }
          }
          await page.locator('[data-pam-mode="overview"]').evaluate(button => button.click());
          const clipped = await page.locator('.article-table, .article-visual, h1, h2, h3').evaluateAll(elements => elements.filter(element => {
            const bounds = element.getBoundingClientRect();
            return bounds.left < -0.5 || bounds.right > innerWidth + 0.5 || element.scrollWidth > element.clientWidth + 2;
          }).map(element => element.tagName + '#' + element.id));
          assert.deepEqual(clipped, [], `Article 5 content clipping at ${width}`);
          assert.equal(await page.locator(`a[href="${articleSixRoute}"]`).count(), 1, 'Article 5 links forward to Article 6');
        }
        if (route === articleSixRoute) {
          await checkArticleSixLayout(page, `Article 6/${width}`);
          assert.equal(await page.locator('table.article-table').count(), 1, 'Article 6 has one requirement-state table');
          assert.equal(await page.locator('.draft-notice, .preview-status').count(), 0, 'Article 6 retains preview chrome');
          const publicText = await page.locator('body').innerText();
          assert(!/Private preview|Not published|Private editorial notes|Internal editorial notes|END ARTICLE BODY|\/mnt\/|\/home\/|C:\\Users|\bour (?:spacecraft|example|configuration|architecture|propellant)\b/i.test(publicText), 'Article 6 private content or ownership perspective leaked');
          assert(publicText.includes('not a disclosed Aeterna product configuration'), 'Article 6 example boundary missing');
          assert(publicText.includes('not a valve design or demonstrated performance'), 'Article 6 model boundary missing');
          const metadata = await page.locator('script[type="application/ld+json"]').evaluateAll(scripts => scripts.map(script => JSON.parse(script.textContent)).filter(item => item['@type'] === 'Article'));
          assert.equal(metadata.length, 1, 'Article 6 has one Article schema');
          assert.equal(metadata[0].mainEntityOfPage, canonical);
          assert.equal(metadata[0].headline, 'Turning Propulsion Architecture into Dependable Hardware');
          assert.equal(metadata[0].datePublished, '2026-09-30');
          assert.equal(await page.locator('meta[property="article:published_time"]').getAttribute('content'), metadata[0].datePublished);
          assert.equal(await page.locator('time[datetime="2026-09-30"]').count(), 1, 'Article 6 visible publication date');
          assert.equal(await page.locator(`.article-backlink a[href="${articleFiveRoute}"]`).count(), 1, 'Article 6 links back to Article 5');
          assert.equal(await page.locator('link[rel="stylesheet"][href^="/assets/article-six"]').count(), 2, 'Article 6 has two local stylesheets');
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
          if (route === articleFourRoute) {
            for (const item of chartCases) await page.locator(item.figure).screenshot({ path: path.join(process.env.AETERNA_SCREENSHOT_DIR, `article-four-${item.name}-${width}.png`) });
          }
          if (route === articleFiveRoute) {
            for (const [name, selector] of [['architecture-map', '#figure-propulsion-architecture-map'], ['operating-timeline', '#figure-propulsion-operating-timeline']]) {
              await page.locator(selector).screenshot({ path: path.join(process.env.AETERNA_SCREENSHOT_DIR, `article-five-${name}-${width}.png`) });
            }
          }
          if (route === articleSixRoute) await captureArticleSix(page, process.env.AETERNA_SCREENSHOT_DIR, width);
        }
      }
    }
    // Keep the legacy phasing checks independent of responsive route order.
    checkingArticleFour = false;
    checkingArticleFive = false;
    checkingArticleSix = false;
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

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(origin + articleThreeRoute);
    const coast = page.locator('#state-coast-figure');
    const coastSlider = page.locator('#coast-time');
    const coastPlay = page.locator('#coast-play');
    await page.waitForSelector('#state-coast-figure[data-ready="true"]');
    assert.equal(await coast.getAttribute('data-playing'), 'false');
    await page.waitForTimeout(180);
    assert.equal(Number(await coast.getAttribute('data-fraction')), 0, 'Coast comparison must not autoplay');
    const near = (actual, expected, label) => assert(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} != ${expected}`);
    for (const fraction of [0, 0.25, 0.5, 1]) {
      await coastSlider.fill(String(fraction));
      const states = await coast.locator('[data-case]').evaluateAll(markers => Object.fromEntries(markers.map(marker =>
        [marker.dataset.case, ['x', 'y', 'vx', 'vy'].map(key => Number(marker.dataset[key]))])));
      const angle = 2 * Math.PI * fraction;
      [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle)].forEach((value, index) => near(states.a[index], value, 'Circular coast'));
      const [x, y, vx, vy] = states.b;
      near((vx * vx + vy * vy) / 2 - 1 / Math.hypot(x, y), -0.33875, 'Elliptical coast energy');
      near(x * vy - y * vx, 1.15, 'Elliptical coast angular momentum');
      if (fraction === 0) [1, 0, 0, 1.15].forEach((value, index) => near(states.b[index], value, 'Shared initial state'));
      else assert(Math.hypot(x - states.a[0], y - states.a[1]) > 0.1, 'Different initial speeds must produce different later positions');
      near(Number(await coast.getAttribute('data-fraction')), fraction, 'Coast slider time');
    }
    const apsides = await page.locator('#apsis-burn-figure .apsis-svg').evaluateAll(diagrams => diagrams.map(diagram => ({
      id: diagram.dataset.case,
      ...Object.fromEntries(['rp', 'ra', 'burnRadius', 'beforeSpeed', 'afterSpeed', 'scale'].map(key => [key, Number(diagram.dataset[key])])),
      impulseY: Number(diagram.querySelector('[data-impulse]').dataset.dvy)
    })));
    const perigee = apsides.find(diagram => diagram.id === 'perigee');
    const apogee = apsides.find(diagram => diagram.id === 'apogee');
    near(perigee.rp, 1, 'Perigee burn preserves perigee');
    near(perigee.ra, 2.645001542, 'Perigee burn raises apogee');
    near(apogee.ra, 2, 'Apogee burn preserves apogee');
    near(apogee.rp, 1.297980958, 'Apogee burn raises perigee');
    near(perigee.scale, apogee.scale, 'Apsis diagrams share a distance scale');
    for (const diagram of apsides) {
      near(diagram.afterSpeed - diagram.beforeSpeed, 0.05, 'Equal speed increases');
      near(diagram.beforeSpeed ** 2, 2 / diagram.burnRadius - 1 / 1.5, 'Original orbit vis-viva');
      near(diagram.afterSpeed ** 2, 2 / diagram.burnRadius - 2 / (diagram.rp + diagram.ra), 'Resulting orbit vis-viva');
      near(diagram.impulseY, diagram.id === 'perigee' ? 0.05 : -0.05, 'Prograde impulse direction');
    }
    await coastSlider.fill('0.25');
    await coastSlider.focus();
    await page.keyboard.press('ArrowRight');
    near(Number(await coast.getAttribute('data-fraction')), 0.251, 'Keyboard slider increment');
    await page.keyboard.press('Home');
    near(Number(await coast.getAttribute('data-fraction')), 0, 'Keyboard slider start');
    await page.keyboard.press('End');
    near(Number(await coast.getAttribute('data-fraction')), 1, 'Keyboard slider end');
    await coastSlider.fill('0.99');
    await coastPlay.click();
    await page.waitForFunction(() => document.querySelector('#coast-play').textContent === 'Replay');
    assert.equal(await coast.getAttribute('data-playing'), 'false');
    near(Number(await coast.getAttribute('data-fraction')), 1, 'Coast playback endpoint');
    await coastPlay.click();
    await page.waitForFunction(() => Number(document.querySelector('#state-coast-figure').dataset.fraction) > 0.01);
    assert(Number(await coast.getAttribute('data-fraction')) < 0.25, 'Coast replay starts at zero');
    await coastPlay.click();
    const pausedCoastTime = await coast.getAttribute('data-fraction');
    await page.waitForTimeout(100);
    assert.equal(await coast.getAttribute('data-fraction'), pausedCoastTime, 'Coast pause holds time');
    await coastPlay.click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('#coast-play').disabled);
    assert.equal(await coast.getAttribute('data-playing'), 'false');
    assert.equal(await coastPlay.innerText(), 'Motion off');
    assert(await coastSlider.isEnabled());
    await coastSlider.fill('0.25');
    near(Number(await coast.getAttribute('data-fraction')), 0.25, 'Reduced-motion slider stays available');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    checkingArticleFive = true;
    await page.goto(origin + articleFiveRoute);
    const overviewButton = page.locator('[data-pam-mode="overview"]');
    const sharedButton = page.locator('[data-pam-mode="shared"]');
    const isolatedButton = page.locator('[data-pam-mode="isolated"]');
    assert.equal(await overviewButton.getAttribute('aria-pressed'), 'true', 'Article 5 opens in overview');
    await overviewButton.focus();
    await page.keyboard.press('Tab');
    assert(await sharedButton.evaluate(button => button === document.activeElement), 'Map keyboard order reaches shared demand');
    await page.keyboard.press('Enter');
    assert.equal(await sharedButton.getAttribute('aria-pressed'), 'true', 'Map shared demand works with Enter');
    await page.keyboard.press('Tab');
    assert(await isolatedButton.evaluate(button => button === document.activeElement), 'Map keyboard order reaches isolation');
    await page.keyboard.press('Space');
    assert.equal(await isolatedButton.getAttribute('aria-pressed'), 'true', 'Map isolation works with Space');
    assert.equal(await page.locator('.pam-blocked').count(), 2);
    assert.equal(await page.locator('#pam-state-detail').getAttribute('aria-live'), 'polite');
    const staticTimeline = await page.locator('.pot-chart').innerHTML();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await overviewButton.click();
    assert.equal(await overviewButton.getAttribute('aria-pressed'), 'true', 'Map remains usable with reduced motion');
    assert.equal(await page.locator('.pot-chart').innerHTML(), staticTimeline, 'Timeline remains static under reduced motion');
    checkingArticleFive = false;

    checkingArticleSix = true;
    await page.goto(origin + articleSixRoute);
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await checkArticleSixLayout(page, `Article 6 reduced motion ${width}`);
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const width of [375, 480]) {
      await page.setViewportSize({ width, height: 900 });
      await checkArticleSixLayout(page, `Article 6 additional width ${width}`);
      if (width === 375 && process.env.AETERNA_SCREENSHOT_DIR) await captureArticleSix(page, process.env.AETERNA_SCREENSHOT_DIR, width);
    }
    checkingArticleSix = false;

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
    await fallback.goto(origin + articleThreeRoute);
    assert.equal(await fallback.locator('.article-section').count(), 6);
    assert.equal(await fallback.locator('.equation math').count(), 2);
    assert(await fallback.locator('#state-coast-figure .figure-fallback').isVisible());
    assert(await fallback.locator('#apsis-burn-figure .figure-fallback').isVisible());
    assert.equal(await fallback.locator('#coast-time, #coast-play').count(), 0);
    assert(await fallback.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No-JS Article 3 overflow');
    fallback.on('pageerror', error => errors.push(error.message));
    fallback.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    let fallbackArticle = 4;
    fallback.on('request', request => {
      if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) (fallbackArticle === 6 ? articleSixExternal : fallbackArticle === 5 ? articleFiveExternal : articleFourExternal).push(request.url());
    });
    await fallback.goto(origin + articleFourRoute);
    assert.equal(await fallback.locator('.article-section').count(), 6);
    assert.equal(await fallback.locator('.equation math').count(), 3);
    assert.equal(await fallback.locator('math').count(), 10);
    assert.equal(await fallback.locator('.draft-notice').count(), 0);
    for (const item of chartCases) {
      const picture = fallback.locator(`${item.root} img.figure-fallback`);
      assert(await picture.isVisible(), 'No-JS Article 4 PNG fallback visible');
      await picture.scrollIntoViewIfNeeded();
      await picture.evaluate(image => image.decode());
      assert(await picture.evaluate(image => image.naturalWidth > 0 && image.getAttribute('alt')?.trim()), 'No-JS Article 4 image decoded and described');
      const imageUrl = new URL(await picture.getAttribute('src'), origin);
      assert.equal(imageUrl.origin, origin, 'PNG fallback must be local');
      const imageResponse = await fallback.request.get(imageUrl.href);
      assert.equal(imageResponse.status(), 200);
      assert.match(imageResponse.headers()['content-type'], /^image\/png/);
      const png = await imageResponse.body();
      assert(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'PNG fallback signature');
      const fullSize = fallback.locator(`${item.figure} .figure-full-size a`);
      assert(await fullSize.isVisible(), 'Full-size figure link works without JavaScript');
      const fullUrl = new URL(await fullSize.getAttribute('href'), origin);
      assert.equal(fullUrl.origin, origin, 'Full-size SVG must be local');
      const svgResponse = await fallback.request.get(fullUrl.href);
      assert.equal(svgResponse.status(), 200);
      assert.match(svgResponse.headers()['content-type'], /^image\/svg\+xml/);
      assert.match(await svgResponse.text(), /<svg\b/);
      if (process.env.AETERNA_SCREENSHOT_DIR) await fallback.locator(item.figure).screenshot({ path: path.join(process.env.AETERNA_SCREENSHOT_DIR, `article-four-${item.name}-no-js-320.png`) });
    }
    assert(await fallback.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No-JS Article 4 overflow');
    fallbackArticle = 5;
    await fallback.goto(origin + articleFiveRoute);
    assert.equal(await fallback.locator('section.article-section').count(), 6, 'Article 5 full text remains available without JavaScript');
    for (const selector of ['#propulsion-architecture-map .viz-controls', '#pam-state-detail', '.pam-figure', '.pot-figure']) {
      assert.equal(await fallback.locator(selector).isVisible(), false, `No-JS Article 5 hides inactive ${selector}`);
    }
    const mapFallback = fallback.locator('#propulsion-architecture-map noscript');
    const timelineFallback = fallback.locator('#propulsion-operating-timeline noscript');
    assert(await mapFallback.isVisible() && await timelineFallback.isVisible(), 'Both Article 5 no-JS descriptions are visible');
    assert.match(await mapFallback.innerText(), /group B retains connected paths.*shared upstream/s, 'Map fallback explains remaining shared dependencies');
    assert.match(await mapFallback.innerText(), /No calculated flows or demonstrated fault tolerance; not an Aeterna configuration/, 'Map fallback retains limitations');
    assert.match(await timelineFallback.innerText(), /restore readiness|restore readiness before firing/, 'Timeline fallback explains conditional preparation');
    assert.match(await timelineFallback.innerText(), /No universal recovery interval/, 'Timeline fallback avoids universal cooldown');
    assert.match(await timelineFallback.innerText(), /neither establishes unrestricted firing or lower energy use/, 'Timeline fallback retains standby limitations');
    assert.equal(await fallback.locator('#propulsion-operating-timeline button, #propulsion-operating-timeline select, #propulsion-operating-timeline input').count(), 0, 'No-JS timeline has no irrelevant controls');
    assert(await fallback.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No-JS Article 5 overflow');
    if (process.env.AETERNA_SCREENSHOT_DIR) await fallback.screenshot({ path: path.join(process.env.AETERNA_SCREENSHOT_DIR, 'article-five-no-js-320.png'), fullPage: true });
    fallbackArticle = 6;
    await fallback.goto(origin + articleSixRoute);
    for (const width of [320, 1280]) {
      await fallback.setViewportSize({ width, height: 900 });
      await checkArticleSixLayout(fallback, `Article 6 no JavaScript ${width}`);
      if (process.env.AETERNA_SCREENSHOT_DIR) await captureArticleSix(fallback, process.env.AETERNA_SCREENSHOT_DIR, width, '-no-js');
    }
    await noJs.close();
    await page.goto(origin + '/');
    await page.getByRole('link', { name: 'Propulsion', exact: true }).click();
    assert.equal(new URL(page.url()).pathname, '/propulsion.html');
    assert.equal(new URL(page.url()).hash, '');
    assert.deepEqual(errors, []);
    assert.deepEqual(articleFourExternal, [], 'Article 4 made external network requests');
    assert.deepEqual(articleFiveExternal, [], 'Article 5 made external network requests');
    assert.deepEqual(articleSixExternal, [], 'Article 6 made external network requests');
    console.log('PASS: 40 responsive page checks, metadata, six article index cards, homepage artwork and portrait, navigation, favicon rendering, keyboard entry, phasing, twelve native display equations, five orbital figures, two responsive resource charts with independent numerical checks, precession quarters, shared GEO states, coast controls and invariants, apsis physics, three architecture-map states and keyboard control, static operating timeline, two static hardware figures with force/clearance MathML, two additional Article 6 widths, reduced motion, no-JS fallbacks, no Article 4/5/6 external requests, and no browser errors');
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
