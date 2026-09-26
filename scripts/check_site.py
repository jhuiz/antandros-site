"""Dependency-free checks for local links, metadata, and public page structure."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import base64
import re
import struct
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.ids = set()
        self.links = []
        self.headings = 0
        self.canonical = []
        self.scripts = []
        self.current_json = None
        self.errors = []
        self.feed(path.read_text(encoding="utf-8"))

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            value = attrs["id"]
            if value in self.ids:
                self.errors.append(f"duplicate id {value}")
            self.ids.add(value)
        if tag == "h1":
            self.headings += 1
        if tag == "img" and "alt" not in attrs:
            self.errors.append("image missing alt")
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical.append(attrs.get("href", ""))
        if tag in {"a", "link", "script", "img"}:
            value = attrs.get("href", attrs.get("src", ""))
            if value:
                self.links.append(value)
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.current_json = ""

    def handle_data(self, data):
        if self.current_json is not None:
            self.current_json += data

    def handle_endtag(self, tag):
        if tag == "script" and self.current_json is not None:
            self.scripts.append(json.loads(self.current_json))
            self.current_json = None


pages = {path.resolve(): Page(path) for path in ROOT.rglob("*.html") if ".git" not in path.parts}
errors = []
for path, page in pages.items():
    errors.extend(f"{path.relative_to(ROOT)}: {error}" for error in page.errors)
    for link in page.links:
        parsed = urlsplit(link)
        if parsed.scheme or parsed.netloc:
            continue
        target = (ROOT / unquote(parsed.path).lstrip("/")) if parsed.path.startswith("/") else path.parent / unquote(parsed.path)
        if not parsed.path:
            target = path
        if target.is_dir():
            target /= "index.html"
        target = target.resolve()
        if not target.is_relative_to(ROOT) or not target.is_file():
            errors.append(f"{path.relative_to(ROOT)}: missing local target {link}")
        elif parsed.fragment and target in pages and unquote(parsed.fragment) not in pages[target].ids:
            errors.append(f"{path.relative_to(ROOT)}: missing anchor {link}")

primary = ["index.html", "propulsion.html", "fluid-controls.html", "articles/index.html", "articles/why-spacecraft-need-maneuverability.html"]
for name in primary:
    page = pages[(ROOT / name).resolve()]
    assert page.headings == 1, f"{name}: expected one h1"
    assert len(page.canonical) == 1, f"{name}: expected one canonical"
    assert "main" in page.ids, f"{name}: skip-link target missing"
    assert "/propulsion.html" in page.links, f"{name}: dedicated propulsion link missing"
    assert "/#program" not in page.links, f"{name}: obsolete propulsion navigation"
    assert "/assets/favicon.svg?v=aeterna-mark-1" in page.links, f"{name}: current favicon link missing"

for name in ["index.html", "propulsion.html", "fluid-controls.html"]:
    assert not re.search(r"\b(?:1|20)\s*N(?:\b|-class)", (ROOT / name).read_text()), f"{name}: public thrust-class claim"

namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
urls = [element.text for element in ET.parse(ROOT / "sitemap.xml").findall("s:url/s:loc", namespace)]
expected = ["https://aeternasidera.com/" + ("" if name == "index.html" else name.replace("articles/index.html", "articles/")) for name in primary]
assert sorted(urls) == sorted(expected), "sitemap does not match primary pages"
assert (ROOT / "CNAME").read_text().strip() == "aeternasidera.com", "deployment domain changed"

# The favicon must embed the approved mark, not a substitute drawing.
favicon = ET.parse(ROOT / "assets/favicon.svg").getroot()
embedded = favicon.find("{http://www.w3.org/2000/svg}image").attrib["href"]
assert embedded.startswith("data:image/png;base64,"), "favicon must be self-contained"
assert base64.b64decode(embedded.split(",", 1)[1]) == (ROOT / "assets/aeterna-sidera-mark.png").read_bytes(), "favicon differs from approved mark"
ico = (ROOT / "favicon.ico").read_bytes()
assert struct.unpack_from("<HHH", ico) == (0, 1, 4), "invalid ICO directory"
for index, size in enumerate([16, 32, 48, 64]):
    width, height, _, _, planes, depth, length, offset = struct.unpack_from("<BBBBHHII", ico, 6 + 16 * index)
    assert (width, height, planes, depth) == (size, size, 1, 32), "invalid ICO frame metadata"
    frame = ico[offset:offset + length]
    assert len(frame) == length and frame.startswith(b"\x89PNG\r\n\x1a\n"), "invalid ICO frame"
    assert struct.unpack_from(">II", frame, 16) == (size, size), "ICO frame dimensions differ"
if errors:
    raise SystemExit("\n".join(errors))
print(f"PASS: {len(pages)} HTML pages; local links, anchors, IDs, metadata, JSON-LD, sitemap, copy guards, and approved-mark favicon")
