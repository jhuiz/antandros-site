# Aeterna Sidera public site

Public GitHub Pages site for Aeterna Sidera Inc.

## Current public posture

The site presents Aeterna Sidera's chemical-propulsion program and developing fluid-controls product line. The central public message is propulsion for spacecraft with more work to do: servicing, orbital logistics, and repeated maneuvering over extended operating lives. Both programs remain in development; evaluation valve hardware is not yet available. The intended propulsion offering includes multiple-thruster system configurations, rather than one fixed thruster package. Standalone-thruster sales remain uncommitted. Keep the homepage and propulsion page concise; detailed educational material belongs in technical articles, not a generic development roadmap.

Public copy may describe:

- the intended system offering, without promising universal customization or supported configurations;
- repeated maneuvering, extended operating life, precision, and reliability as objectives rather than demonstrated capabilities;
- the current design-and-analysis stage before prototype fabrication and testing;
- the founder's background;
- the intended independent fluid-control component offering and optional integration accessories, explicitly as development intentions; and
- sourced educational articles, with illustrative models distinguished from Aeterna hardware results.

Public copy must not disclose internal tasks, gate criteria, schedules, or unannounced long-term product concepts. It must not disclose or imply a selected detailed architecture, propellant pair, design point, predicted performance, hardware result, funding term, customer commitment, qualification, compliance, or flight authority.

## Structure

- `index.html` — concise company purpose, program links, founder background, and contact
- `propulsion.html` — intended applications, system offering, development status, and contact
- `fluid-controls.html` — in-house valve development for Aeterna propulsion and independent supply, intended evaluation offering, and contact
- `articles/index.html` — technical series index
- `articles/why-spacecraft-need-maneuverability.html` — Article 1 with sources and original phasing illustration
- `articles/why-orbits-change.html` — Article 2 with public sources, an orbital reference frame, Sun-synchronous precession and GEO longitude illustrations
- `articles/from-mission-objectives-to-maneuver-requirements.html` — Article 3 with sourced maneuver-planning examples, an interactive coast comparison and a perigee/apogee impulse comparison
- `assets/article-two.css`, `assets/orbital-frame.{css,js}`, `assets/precession.{css,js}`, `assets/geo-libration.{css,js}` — isolated Article 2 layout and self-contained educational illustrations
- `assets/article-three.css`, `assets/state-coast.{css,js}`, `assets/apsis-burn.{css,js}` — isolated Article 3 layout and self-contained illustrative two-body models
- `assets/phasing.js` — progressively enhanced phasing controls (no remote dependencies or tracking)
- `contact.html` — redirect to the contact section on the homepage
- Other legacy `.html` files — deindexed redirects to the homepage
- `404.html` — branded not-found page
- `styles.css` — shared static styles
- `script.js` — current-year footer update
- `assets/aeterna-sidera-mark.png` — approved wordmark-free company mark used in the header and footer
- `assets/jesus-huizar-portrait.png` — retained founder-supplied photograph, copied without retouching or cropping; the site serves a proportionally resized 560-pixel WebP derivative for its 280-pixel display
- `assets/orbital-operations-concept.png` — retained AI-generated conceptual illustration; the site serves a full-resolution WebP derivative as the hero background, with responsive cropping and a contrast overlay; not a depiction of Aeterna hardware or a calculated trajectory
- `favicon.ico`, `assets/favicon.svg`, and `assets/favicon.png` — format exports of the approved company mark; regenerate with `node scripts/generate_favicons.cjs` (requires Sharp). The SVG embeds the original mark so it does not depend on external image loading. Versioned icon links refresh the prior browser icon.
- `assets/og-card.svg` — editable social-card source referencing the approved company mark; `assets/og-card.png` — served social card
- `scripts/prepare_images.cjs` — reproducibly creates the WebP derivatives and social-card PNG from retained sources (requires Sharp; no network access)
- `CNAME` — current GitHub Pages custom domain

## Deployment

The live site is served by GitHub Pages from the `main` branch at `aeternasidera.com`. Merging to `main` publishes the changed files. The public contact mailbox is `hello@aeternasidera.com`. The site does not load third-party analytics or tracking scripts.

## Local preview

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

Article 2 is available at `/articles/why-orbits-change.html` and is listed in the article index and sitemap. Its release was approved by the founder on September 26, 2026. Only approved public copy and original illustrative assets belong in the site; private presentations, study-specific implementation details and internal editorial notes stay outside the repository. `noindex` is not an access-control mechanism for future drafts.

Its GEO illustration (`#geo-animation`) combines an Earth-fixed longitude dial, an ideal geostationary reference and the normalized libration plot. Playback and scrubbing share one time state; autoplay is off, playback stops after three libration periods, and reduced-motion mode retains manual scrubbing. The dial is a longitude projection with magnified angles, not an orbital trajectory or altitude display.

Article 3 is available at `/articles/from-mission-objectives-to-maneuver-requirements.html` and is listed in the article index and sitemap. Its release was approved by the founder on September 27, 2026. The first figure compares two alternative initial velocities at the same position and epoch under ideal point-mass gravity, without thrust. Playback stops after one reference period; reduced-motion mode retains manual scrubbing. The second figure compares independent perigee and apogee impulses, not a two-burn sequence. Both are original illustrative calculations, not Aeterna hardware results.

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

The browser check starts an ephemeral localhost-only server and uses an isolated headless Edge browser by default. Set `AETERNA_BROWSER_CHANNEL=chromium` to use Playwright's Chromium instead. It checks the seven primary pages at 320, 768, 900, and 1280 pixels, optimized homepage artwork and portrait rendering, navigation destinations and visibility, favicon rendering, overflow, JavaScript errors, article illustrations, reduced motion, and no-JavaScript fallbacks. Optional `AETERNA_SCREENSHOT_DIR` saves review screenshots outside the repository; `AETERNA_SITE_ORIGIN=https://aeternasidera.com` verifies the live site instead of starting the local server.

Review the homepage, propulsion page, fluid-controls page, article index, article, 404 page, every legacy redirect, mobile layout, keyboard focus, metadata, structured data, social card, and email action. Confirm that superseded public positioning and unsupported capability claims are absent. Article sources and legal scope require editorial review before merge; the article is an educational synthesis, not peer-reviewed research or demonstrated Aeterna performance.

At first publication, add the actual publication date to the article and its index entry, with matching structured metadata where applicable. Record later substantive revisions using their actual dates; do not label local draft work as a public release.

Run `node scripts/prepare_images.cjs` after changing the portrait source, illustration source, or social-card SVG. The PNG originals are preserved; the homepage loads only the optimized derivatives. The script embeds the approved company mark when rendering the social preview PNG. No branch should be merged to `main` until the founder approves the public content.
