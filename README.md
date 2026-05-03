# Antandros website

Static, responsive website for Antandros, a spacecraft-servicing company developing standards-aligned spacecraft readiness and servicing infrastructure with a staged roadmap toward non-contact inspection and future servicing support.

## What is included

- `index.html` — landing page
- `technology.html` — what Antandros does: readiness technologies and staged capabilities
- `standards.html` — standards traceability and compatibility posture
- `roadmap.html` — staged R&D and demonstration roadmap
- `contact.html` — backend-free mailto contact form
- `404.html` — simple not-found page
- `styles.css` — full responsive design system
- `script.js` — mobile navigation, reveal animations, footer year, mailto form behavior
- `assets/` — original SVG logo, favicon, hero art, and social card
- `robots.txt`, `sitemap.xml`, `netlify.toml`, `vercel.json` — deployment helpers
- `content-notes.md` — source-of-truth notes and launch checklist

## Local preview

From this folder:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Deployment

This is a dependency-free static site. It can be deployed to Netlify, Vercel, Cloudflare Pages, GitHub Pages, or any standard static host.

### Netlify

Drag this folder into Netlify Drop, or connect the repository. The included `netlify.toml` publishes from the project root.

### Vercel

Import the folder/repository as a static project. The included `vercel.json` sets static headers and routes missing pages to `404.html`.

## Replace before launch

1. Replace `hello@antandros.space` with the production email address in:
   - `index.html`
   - `technology.html`
   - `standards.html`
   - `roadmap.html`
   - `contact.html`
   - `script.js`
2. Replace `https://antandros.space/` in `sitemap.xml` with the final domain.
3. Confirm whether any external references are approved for public release; current copy intentionally keeps positioning conservative and public-safe.
4. Add the final company legal name, privacy policy, and terms links if collecting form submissions through a backend.
5. Replace placeholder logo/visual direction if an official brand identity exists.
6. Confirm the desired tone: investor-facing, customer-facing, government-program-facing, or recruiting-facing.

## Content posture

The site intentionally avoids claims of current operational servicing capability and frames future servicing support as staged roadmap capability. Inspection outputs are presented as assessment-support data, with standards alignment and compatibility planning as core themes.
