# Antandros website

Static, responsive website for Antandros, a spacecraft-servicing company developing a standards-aligned servicer-side architecture for advanced non-contact inspection and servicing-readiness verification of cooperative client spacecraft.

## What is included

- `index.html` — landing page
- `technology.html` — servicer-side architecture and inspection-first technical framing
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

## Launch readiness

1. Confirm company legal name, privacy policy, and terms links if collecting form submissions through a backend.
2. Confirm whether additional customer proof points or mission examples should be published.
3. Replace placeholder logo/visual direction if an official brand identity exists.
4. Confirm the desired tone: investor-facing, customer-facing, partner-facing, or recruiting-facing.

## Content posture

The site intentionally avoids claiming current operational servicing capability, universal compatibility, or full anomaly diagnosis from inspection data. It presents Antandros as developing standards-aligned spacecraft readiness and servicing infrastructure with non-contact inspection and assessment support first, and future servicing support as staged roadmap capability only.
