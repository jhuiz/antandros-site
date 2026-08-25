# Aeterna Sidera public site

Public GitHub Pages site for Aeterna Sidera Inc.

## Current public posture

The site presents Aeterna Sidera's current in-space bipropellant chemical-propulsion development program, with an approximately 1 N-class head as the initial direction. The public page describes the program as being in the engineering-definition stage, prior to hardware development, without publishing internal tasks, gate criteria, schedules, or results.

Public copy may describe:

- the intended application domain;
- the coupled source/feed-through-nozzle development boundary;
- the current engineering-definition stage;
- the high-level path through head-end, integrated-subsystem, and later maturation stages; and
- the founder-led development method.

Public copy must not disclose or imply a selected detailed architecture, propellant pair, design point, predicted performance, hardware result, funding term, customer commitment, qualification, compliance, or flight authority.

## Structure

- `index.html` — current one-page company and development site
- `contact.html` — redirect to the contact section on the homepage
- Other legacy `.html` files — deindexed redirects to the homepage
- `404.html` — branded not-found page
- `styles.css` — shared static styles
- `script.js` — current-year footer update
- `assets/aeterna-sidera-mark.png` — approved wordmark-free company mark used in the header and footer
- `favicon.ico`, `assets/favicon.svg`, and `assets/favicon.png` — current favicon assets
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

Review the homepage, the 404 page, every legacy redirect, mobile layout, keyboard focus, metadata, structured data, social card, and email action. Confirm that superseded public positioning and unsupported capability claims are absent.
