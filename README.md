# Aeterna Sidera transition site

Public GitHub Pages site for Aeterna Sidera Inc., formerly Antandros, Inc.

## Current public posture

The site presents one bounded activity: a focused, solution-neutral industry study of recurring problems in uncrewed spacecraft and payload hardware execution. Aeterna Sidera is not currently marketing a commercial product. Earlier company descriptions are archived exploratory concepts, not current offerings or roadmap commitments.

## Structure

- `index.html` — current one-page company and discovery site
- `contact.html` — redirect to the contact section on the homepage
- Other legacy `.html` files — deindexed redirects to the homepage
- `404.html` — branded not-found page
- `styles.css` — shared static styles
- `script.js` — current-year footer update
- `favicon.ico`, `assets/favicon.svg`, and `assets/favicon.png` — current favicon assets
- `assets/og-card.svg` — editable social-card source; `assets/og-card.png` — served social card
- `CNAME` — current GitHub Pages custom domain

## Deployment

The live site is served by GitHub Pages from the `main` branch at `antandros.space`. Merging to `main` publishes the changed files. The old domain and `hello@antandros.space` remain in use only during the name transition. The temporary site does not load third-party analytics or tracking scripts.

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

Review the homepage, the 404 page, every legacy redirect, mobile layout, keyboard focus, metadata, and the email action. Confirm that retired concepts, unrelated affiliations, and unsupported capability claims are absent.
