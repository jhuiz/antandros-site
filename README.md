# Antandros website v2

Static website package for Antandros using the new public-facing space asset management positioning.

## Positioning

Antandros supports space asset management through advanced in-orbit inspection and spacecraft-side serviceability components.

## Pages

- `index.html` — homepage
- `inspection.html` — advanced in-orbit inspection
- `serviceability.html` — spacecraft-side serviceability components
- `life-extension.html` — future life-extension and decommissioning support
- `contact.html` — mailto-based contact page
- `404.html` — not-found page
- `technology.html`, `standards.html`, `roadmap.html` — compatibility redirects for the old navigation

## Notes

- `hello@antandros.space` is treated as the production inbox.
- `antandros.space` is treated as the production domain.
- Future servicing support is framed as roadmap capability, not current operational service.
- Inspection outputs are framed as assessment-support data.

## Local preview

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.
