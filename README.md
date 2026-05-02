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

## Replace before launch

1. Replace `hello@antandros.space` with the production email address in:
   - `index.html`
   - `technology.html`
   - `standards.html`
   - `roadmap.html`
   - `contact.html`
   - `script.js`
2. Replace `https://antandros.space/` in `sitemap.xml` with the final domain.
3. Confirm whether the public site should mention NASA SBIR, EXPAND.1.S26A, Flight Opportunities, CONFERS, Orbit Fab RAFTI, or OSAM-1. The current site keeps those details mostly out of public copy and uses conservative roadmap language.
4. Add the final company legal name, privacy policy, and terms links if collecting form submissions through a backend.
5. Replace placeholder logo/visual direction if an official brand identity exists.
6. Confirm the desired tone: investor-facing, customer-facing, government-program-facing, or recruiting-facing.

## Content posture

The site intentionally avoids claiming that Antandros currently operates a flight-qualified servicing spacecraft, has been awarded NASA funding, can diagnose all anomalies from inspection data, can dock/capture/refuel spacecraft today, or can support universal compatibility with all spacecraft. It presents the company as building a feasibility-backed, standards-aligned architecture with non-contact inspection as the first service and contact-capable functions as staged future extensions.
