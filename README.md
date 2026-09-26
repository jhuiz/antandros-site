# Aeterna Sidera public site

Public GitHub Pages site for Aeterna Sidera Inc.

## Current public posture

The site presents Aeterna Sidera's in-space bipropellant chemical-propulsion program and developing fluid-controls product line. Both remain in development; evaluation valve hardware is not yet available. Public copy does not publish internal tasks, gate criteria, schedules, or results.

Public copy may describe:

- the intended application domain;
- the coupled source/feed-through-nozzle development boundary;
- the current engineering-definition stage;
- the high-level path through head-end, integrated-subsystem, and later maturation stages; and
- the founder-led development method;
- the intended independent fluid-control component offering and optional integration accessories, explicitly as development intentions; and
- sourced educational articles, with illustrative models distinguished from Aeterna hardware results.

Public copy must not disclose or imply a selected detailed architecture, propellant pair, design point, predicted performance, hardware result, funding term, customer commitment, qualification, compliance, or flight authority.

## Structure

- `index.html` — company and development homepage
- `propulsion.html` — propulsion applications, development boundary, and staged program overview
- `fluid-controls.html` — developing component line and application-discussion invitation
- `articles/index.html` — technical series index
- `articles/why-spacecraft-need-maneuverability.html` — Article 1 with sources and original phasing illustration
- `assets/phasing.js` — progressively enhanced phasing controls (no remote dependencies or tracking)
- `contact.html` — redirect to the contact section on the homepage
- Other legacy `.html` files — deindexed redirects to the homepage
- `404.html` — branded not-found page
- `styles.css` — shared static styles
- `script.js` — current-year footer update
- `assets/aeterna-sidera-mark.png` — approved wordmark-free company mark used in the header and footer
- `favicon.ico`, `assets/favicon.svg`, and `assets/favicon.png` — format exports of the approved company mark; regenerate with `node scripts/generate_favicons.cjs` (requires Sharp). The SVG embeds the original mark so it does not depend on external image loading. Versioned icon links refresh the prior browser icon.
- `assets/og-card.svg` — editable social-card source; `assets/og-card.png` — served social card
- `CNAME` — current GitHub Pages custom domain

## Deployment

The live site is served by GitHub Pages from the `main` branch at `aeternasidera.com`. Merging to `main` publishes the changed files. The public contact mailbox is `hello@aeternasidera.com`. The site does not load third-party analytics or tracking scripts.

## Local preview

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Verification

Before merging:

```bash
git diff --check
```

Run the dependency-free structural check:

```bash
python3 scripts/check_site.py
```

For browser checks, make Playwright available to Node (for example through the installed workspace runtime), then run:

```bash
node scripts/check_browser.cjs
```

The browser check starts an ephemeral localhost-only server and uses an isolated headless Edge browser by default. Set `AETERNA_BROWSER_CHANNEL=chromium` to use Playwright's Chromium instead. It checks the five primary pages at 320, 768, and 1280 pixels, navigation destinations and visibility, favicon rendering, overflow, JavaScript errors, phasing controls, reduced motion, and the no-JavaScript fallback. Optional `AETERNA_SCREENSHOT_DIR` saves review screenshots outside the repository.

Review the homepage, propulsion page, fluid-controls page, article index, article, 404 page, every legacy redirect, mobile layout, keyboard focus, metadata, structured data, social card, and email action. Confirm that superseded public positioning and unsupported capability claims are absent. Article sources and legal scope require editorial review before merge; the article is an educational synthesis, not peer-reviewed research or demonstrated Aeterna performance.

The social preview PNG is rendered from `assets/og-card.svg`; regenerate both together when changing its copy. No branch should be merged to `main` until the founder approves the public content.
