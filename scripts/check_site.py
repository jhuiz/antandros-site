"""Dependency-free checks for local links, metadata, and public page structure."""
from html.parser import HTMLParser
from pathlib import Path
from datetime import date
from collections import Counter
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
        self.metadata = {}
        self.scripts = []
        self.times = []
        self.article_cards = []
        self.article_sections = []
        self.display_equations = []
        self.math_expressions = []
        self.article_tables = []
        self.images = []
        self.figures = []
        self.elements = []
        self.current_card = None
        self.current_json = None
        self.errors = []
        self.feed(path.read_text(encoding="utf-8"))

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.elements.append((tag, attrs))
        if "id" in attrs:
            value = attrs["id"]
            if value in self.ids:
                self.errors.append(f"duplicate id {value}")
            self.ids.add(value)
        if tag == "h1":
            self.headings += 1
        if tag == "section" and "article-section" in attrs.get("class", "").split():
            self.article_sections.append(attrs.get("id", ""))
        if tag == "math" and attrs.get("display") == "block":
            self.display_equations.append(attrs)
        if tag == "math":
            self.math_expressions.append(attrs)
        if tag == "table" and "article-table" in attrs.get("class", "").split():
            self.article_tables.append(attrs)
        if tag == "img":
            self.images.append(attrs)
        if tag == "figure":
            self.figures.append(attrs.get("id", ""))
        if tag == "meta":
            key = attrs.get("name", attrs.get("property", ""))
            self.metadata.setdefault(key, []).append(attrs.get("content", ""))
        if tag == "article" and "article-teaser" in attrs.get("class", "").split():
            self.current_card = {"links": [], "times": []}
            self.article_cards.append(self.current_card)
        if tag == "a" and self.current_card is not None:
            self.current_card["links"].append(attrs.get("href", ""))
        if tag == "time":
            self.times.append(attrs.get("datetime", ""))
            if self.current_card is not None:
                self.current_card["times"].append(attrs.get("datetime", ""))
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
        if tag == "article":
            self.current_card = None
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

articles = [
    "articles/why-spacecraft-need-maneuverability.html",
    "articles/why-orbits-change.html",
    "articles/from-mission-objectives-to-maneuver-requirements.html",
    "articles/matching-propulsion-to-the-mission.html",
    "articles/choosing-a-propulsion-system-architecture.html",
    "articles/turning-propulsion-architecture-into-dependable-hardware.html",
    "articles/establishing-readiness-for-customer-use.html",
]
primary = ["index.html", "propulsion.html", "fluid-controls.html", "articles/index.html", *articles]
canonical_urls = {name: "https://aeternasidera.com/" + ("" if name == "index.html" else name.replace("articles/index.html", "articles/")) for name in primary}
for name in primary:
    page = pages[(ROOT / name).resolve()]
    assert page.headings == 1, f"{name}: expected one h1"
    assert page.canonical == [canonical_urls[name]], f"{name}: incorrect canonical"
    robots = {value.strip().lower() for value in ",".join(page.metadata.get("robots", [])).split(",")}
    assert {"index", "follow"} <= robots and not robots.intersection({"noindex", "nofollow", "none"}), f"{name}: page is not indexable"
    assert page.metadata.get("og:url") == page.canonical, f"{name}: Open Graph URL differs from canonical"
    assert page.metadata.get("og:type") == ["article" if name in articles else "website"], f"{name}: incorrect Open Graph type"
    for key in ["description", "og:title", "og:description", "og:image", "og:image:alt"]:
        assert len(page.metadata.get(key, [])) == 1 and page.metadata[key][0], f"{name}: missing or duplicate {key}"
    assert page.metadata["og:image"] == ["https://aeternasidera.com/assets/og-card.png"], f"{name}: incorrect social preview"
    assert "main" in page.ids, f"{name}: skip-link target missing"
    assert "/propulsion.html" in page.links, f"{name}: dedicated propulsion link missing"
    assert "/#program" not in page.links, f"{name}: obsolete propulsion navigation"
    assert "/assets/favicon.svg?v=aeterna-mark-1" in page.links, f"{name}: current favicon link missing"

for name in ["index.html", "propulsion.html", "fluid-controls.html"]:
    assert not re.search(r"\b(?:1|20)\s*N(?:\b|-class)", (ROOT / name).read_text()), f"{name}: public thrust-class claim"

index_cards = pages[(ROOT / "articles/index.html").resolve()].article_cards
assert len(index_cards) == len(articles), "article index card count differs from published articles"
for name in articles:
    article = pages[(ROOT / name).resolve()]
    metadata = [item for item in article.scripts if item.get("@type") == "Article"]
    assert len(metadata) == 1, f"{name}: expected one Article JSON-LD object"
    article_metadata = metadata[0]
    assert article_metadata.get("@context") == "https://schema.org", f"{name}: invalid schema context"
    assert article_metadata.get("mainEntityOfPage") == canonical_urls[name], f"{name}: JSON-LD URL differs from canonical"
    assert article_metadata.get("headline") and article_metadata.get("author", {}).get("name"), f"{name}: incomplete Article metadata"
    published = article_metadata["datePublished"]
    assert date.fromisoformat(published).isoformat() == published, f"{name}: invalid publication date"
    if "dateModified" in article_metadata:
        modified = article_metadata["dateModified"]
        assert date.fromisoformat(modified).isoformat() == modified and modified >= published, f"{name}: invalid modification date"
    assert published in article.times, f"{name}: visible publication date differs from metadata"
    if name in articles[3:]:
        assert article.metadata.get("article:published_time") == [published], f"{name}: Open Graph publication date differs"
    cards = [card for card in index_cards if "/" + name in card["links"]]
    assert len(cards) == 1, f"{name}: missing or duplicate article index card"
    assert cards[0]["times"] == [published], f"{name}: index card publication date differs"

article_three = pages[(ROOT / articles[2]).resolve()]
assert len(article_three.article_sections) == 6, "Article 3: expected six sections"
assert len(article_three.display_equations) == 2, "Article 3: expected two display equations"
assert all(equation.get("xmlns") == "http://www.w3.org/1998/Math/MathML" and equation.get("aria-label") for equation in article_three.display_equations), "Article 3: equations need native MathML and accessible descriptions"
assert article_three.figures == ["state-comparison", "apsis-comparison"], "Article 3: expected coast and apsis figures"
assert {"state-coast-figure", "apsis-burn-figure"} <= article_three.ids, "Article 3: diagram containers missing"

article_four = pages[(ROOT / articles[3]).resolve()]
assert len(article_four.article_sections) == 6, "Article 4: expected five numbered sections and reference notes"
assert "calculation-and-reference-notes" in article_four.article_sections, "Article 4: calculation provenance section missing"
assert len(article_four.display_equations) == 3, "Article 4: expected three display equations"
assert len(article_four.math_expressions) == 10, "Article 4: expected ten display/inline math expressions"
assert all(equation.get("xmlns") == "http://www.w3.org/1998/Math/MathML" and equation.get("aria-label", "").strip() for equation in article_four.math_expressions), "Article 4: all math needs native MathML and accessible descriptions"
assert len(article_four.article_tables) == 6, "Article 4: expected six comparison tables"
assert article_four.figures == ["hall-power-mass-figure", "mass-break-even-figure"], "Article 4: comparison figures missing or reordered"
assert {"hall-power-mass-chart", "mass-break-even-chart"} <= article_four.ids, "Article 4: responsive chart containers missing"
article_four_text = (ROOT / articles[3]).read_text(encoding="utf-8")
assert not re.search(r"Private preview|Not published|draft-notice|Internal editorial notes|/mnt/|/home/|C:\\Users", article_four_text, re.I), "Article 4: private review material leaked into public copy"
article_four_sources = {
    "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/",
    "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/",
    "https://www.nasa.gov/smallsat-institute/sst-soa/in-space_propulsion/",
    "https://descanso.jpl.nasa.gov/SciTechBook/series4/Electric_Propulsion_2nd_edition.pdf",
    "https://earth-info.nga.mil/?action=wgs84&dir=wgs84",
    "https://science.nasa.gov/learn/basics-of-space-flight/chapter4-1/",
    "https://www.moog.com/content/dam/moog/literature/sdg/space/propulsion/moog-coldgasthrusters-datasheet.pdf",
    "https://space-propulsion.com/brochures/hydrazine-thrusters/hydrazine-thrusters.pdf",
    "https://space-propulsion.com/brochures/bipropellant-thrusters/bipropellant-thrusters.pdf",
    "https://www.busek.com/bht200",
    "https://www.busek.com/s/BHT_600_v11.pdf",
}
actual_sources = {link for link in article_four.links if link.startswith("https://") and urlsplit(link).hostname != "aeternasidera.com"}
assert actual_sources == article_four_sources, "Article 4: reference URLs differ from approved manuscript"
for stem in ["series-04-hall-power-mass", "series-04-mass-break-even"]:
    png_link, svg_link = f"/assets/{stem}.png", f"/assets/{stem}.svg"
    assert png_link in article_four.links and svg_link in article_four.links, f"Article 4: fallback or full-size link missing for {stem}"
    matching_images = [image for image in article_four.images if image.get("src") == png_link]
    assert len(matching_images) == 1 and matching_images[0].get("alt", "").strip(), f"Article 4: fallback image needs descriptive alt text: {stem}"
    assert (ROOT / png_link.lstrip("/")).read_bytes().startswith(b"\x89PNG\r\n\x1a\n"), f"Article 4: invalid PNG fallback {stem}"
    figure_svg = ET.parse(ROOT / svg_link.lstrip("/")).getroot()
    assert figure_svg.tag == "{http://www.w3.org/2000/svg}svg", f"Article 4: invalid full-size SVG {stem}"
    assert not figure_svg.findall(".//{http://www.w3.org/2000/svg}script"), f"Article 4: static SVG contains script {stem}"
assert "/assets/article-four.css" in article_four.links and "/assets/article-four-charts.js" in article_four.links, "Article 4: presentation assets missing"

article_five = pages[(ROOT / articles[4]).resolve()]
article_five_metadata = next(item for item in article_five.scripts if item.get("@type") == "Article")
assert article_five_metadata.get("headline") == "Choosing a Propulsion System Architecture", "Article 5: incorrect headline metadata"
assert article_five_metadata.get("datePublished") == "2026-09-29", "Article 5: incorrect publication date"
assert article_five.article_sections == [
    "follow-the-operating-sequence",
    "store-propellant-and-make-it-available",
    "decide-which-pressure-variation-to-accept-or-control",
    "supply-and-command-a-network-of-thrusters",
    "make-thermal-management-part-of-availability",
    "compare-complete-architectures-over-the-operating-sequence",
], "Article 5: expected six approved sections in order"
assert len(article_five.article_tables) == 2, "Article 5: expected operating-stage and architecture-comparison tables"
assert {"figure-propulsion-architecture-map", "propulsion-architecture-map", "figure-propulsion-operating-timeline", "propulsion-operating-timeline"} <= article_five.ids, "Article 5: visual roots missing"
article_five_text = (ROOT / articles[4]).read_text(encoding="utf-8")
assert not re.search(r"Private preview|Not published|draft-notice|preview-status|Internal editorial notes|Prepared:|/mnt/|/home/|C:\\Users|localhost:", article_five_text, re.I), "Article 5: private review material leaked into public copy"
assert not re.search(r"\bour (?:spacecraft|example|configuration|architecture|propellant)\b", article_five_text, re.I), "Article 5: generic educational scenario presented as Aeterna's selected design"
assert "not an Aeterna configuration" in article_five_text, "Article 5: architecture-map boundary missing"
assert "does not report Aeterna hardware performance, qualification or flight results" in article_five_text, "Article 5: evidence boundary missing"
assert "Widths are not durations" in article_five_text, "Article 5: qualitative timeline boundary missing"
assert article_five_text.count("<noscript>") == 2, "Article 5: both visuals need no-JavaScript descriptions"
assert set(re.findall(r'data-pam-mode="([^"]+)"', article_five_text)) == {"overview", "shared", "isolated"}, "Article 5: architecture map modes changed"
assert "<iframe" not in article_five_text.lower(), "Article 5: visuals should be integrated, not nested iframe previews"
article_five_sources = {
    "https://www.nasa.gov/smallsat-institute/sst-soa/in-space_propulsion/",
    "https://ntrs.nasa.gov/api/citations/20170000667/downloads/20170000667.pdf",
    "https://www.nasa.gov/wp-content/uploads/static/history/alsj/16_Reaction_Control_Subsystem_pp147-158.pdf",
    "https://wtt-lite.nist.gov/wtt-lite/help/properties/LG_pressure.html",
    "https://elib.dlr.de/197901/1/EUCASS2023-596.pdf",
    "https://ntrs.nasa.gov/api/citations/20240003278/downloads/Paper_Transit_Habitat_Prop_Concept_JANNAF_V4.pdf",
    "https://resilience.esa.int/archives/projects/electronic-pressure-regulator",
    "https://blogs.esa.int/orion/2022/11/21/how-to-fly-orion-propulsion/",
    "https://ntrs.nasa.gov/api/citations/19740002611/downloads/19740002611.pdf",
    "https://ntrs.nasa.gov/api/citations/19720014237/downloads/19720014237.pdf",
    "https://ntrs.nasa.gov/api/citations/20250004573/downloads/Lesson%20Learned%20and%20Prop%20Stand%20TIM%206-13-25%20R3.pdf",
    "https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/",
    "https://ntrs.nasa.gov/api/citations/19830016280/downloads/19830016280.pdf",
    "https://blogs.esa.int/orion/2023/02/03/how-to-fly-orion-thermal/",
    "https://www.nasa.gov/reference/6-8-decision-analysis/",
}
actual_sources = {link for link in article_five.links if link.startswith("https://") and urlsplit(link).hostname != "aeternasidera.com"}
assert actual_sources == article_five_sources, "Article 5: reference URLs differ from approved manuscript"
for asset in ["article-five.css", "article-five-visuals.css", "article-five-visuals.js"]:
    assert f"/assets/{asset}" in article_five.links, f"Article 5: missing presentation asset {asset}"
article_five_js = (ROOT / "assets/article-five-visuals.js").read_text(encoding="utf-8")
assert not re.search(r"window\.openai|openai:set_globals|\bfetch\s*\(|XMLHttpRequest|WebSocket", article_five_js), "Article 5: figures must work without host APIs or network calls"

article_six = pages[(ROOT / articles[5]).resolve()]
article_six_metadata = next(item for item in article_six.scripts if item.get("@type") == "Article")
assert article_six_metadata.get("headline") == "Turning Propulsion Architecture into Dependable Hardware", "Article 6: incorrect headline metadata"
assert article_six_metadata.get("datePublished") == "2026-09-30", "Article 6: incorrect publication date"
assert article_six.article_sections == [
    "define-the-component-s-job",
    "engineer-the-requirements-together",
    "design-for-variation",
    "preserve-performance-through-use-and-storage",
    "make-the-design-reproducible",
    "keep-the-hardware-definition-and-evidence-connected",
], "Article 6: expected six approved sections in order"
assert len(article_six.article_tables) == 1, "Article 6: expected one valve-state table"
assert len(article_six.display_equations) == 2 and len(article_six.math_expressions) == 10, "Article 6: expected two display and eight inline expressions"
assert all(equation.get("xmlns") == "http://www.w3.org/1998/Math/MathML" and equation.get("aria-label", "").strip() for equation in article_six.math_expressions), "Article 6: equations need accessible native MathML"
assert [equation.get("data-tex") for equation in article_six.display_equations] == [
    r"F_p \approx |\Delta p|\,A_{\mathrm{eff}}",
    r"\Delta c \approx \alpha_bD_b\Delta T_b-\alpha_sD_s\Delta T_s",
], "Article 6: explanatory force or differential-clearance expression changed"
assert article_six.figures == ["figure-valve-command-dependencies", "figure-thermal-guide-clearance"], "Article 6: expected two static figures in order"
assert {"valve-command-dependencies", "thermal-guide-clearance", "vcd-title", "vcd-summary", "tgc-title"} <= article_six.ids, "Article 6: static figure content missing"
article_six_text = (ROOT / articles[5]).read_text(encoding="utf-8")
assert not re.search(r"Private preview|Not published|draft-notice|preview-status|Private editorial notes|Internal editorial notes|END ARTICLE BODY|/mnt/|/home/|C:\\Users|localhost:|window\.openai", article_six_text, re.I), "Article 6: private review material leaked"
assert not re.search(r"\bour (?:spacecraft|example|configuration|architecture|propellant)\b", article_six_text, re.I), "Article 6: illustrative hardware presented as selected Aeterna design"
for boundary in ["not a disclosed Aeterna product configuration", "not a complete actuator-sizing equation", "not a valve design or demonstrated performance"]:
    assert boundary in article_six_text, f"Article 6: evidence/model boundary missing: {boundary}"
assert not re.search(r"<(?:iframe|button|select|input|textarea)\b", article_six_text, re.I), "Article 6: static figures must not require controls or nested previews"
assert re.findall(r'<script\b[^>]*\bsrc="([^"]+)"', article_six_text) == ["/script.js"], "Article 6: figures and equations must not require JavaScript"
without_tex_attributes = re.sub(r'\sdata-tex="[^"]*"', "", article_six_text)
assert not re.search(r"\\(?:\[|\]|\(|\)|Delta|alpha|mathrm|approx|begin|end)|\$\$", without_tex_attributes), "Article 6: unrendered LaTeX outside math audit attributes"
for references in re.findall(r'aria-(?:labelledby|describedby)="([^"]+)"', article_six_text):
    assert set(references.split()) <= article_six.ids, "Article 6: broken accessible-name/description references"
svgs = re.findall(r"<svg\b.*?</svg>", article_six_text, re.S)
assert len(svgs) == 2, "Article 6: expected reference and changed-clearance SVGs"
for svg_text in svgs:
    svg = ET.fromstring(svg_text)
    assert svg.attrib.get("role") == "img", "Article 6: diagram needs image semantics"
    for tag in ["title", "desc"]:
        element = svg.find("{http://www.w3.org/2000/svg}" + tag)
        assert element is not None and element.text and element.text.strip(), f"Article 6: SVG missing {tag}"
    assert not svg.findall(".//{http://www.w3.org/2000/svg}script"), "Article 6: static SVG contains script"
# Preserve every approved source-link occurrence, including figure citations.
article_six_sources = Counter({
    "https://www.nasa.gov/reference/appendix-c-how-to-write-a-good-requirement/": 1,
    "https://ntrs.nasa.gov/api/citations/19740018866/downloads/19740018866.pdf": 7,
    "https://www.nasa.gov/reference/4-2-technical-requirements-definition/": 1,
    "https://ntrs.nasa.gov/api/citations/19740019163/downloads/19740019163.pdf": 6,
    "https://www.ti.com/lit/an/slvae59a/slvae59a.pdf": 3,
    "https://openstax.org/books/university-physics-volume-2/pages/1-3-thermal-expansion": 2,
    "https://standards.nasa.gov/sites/default/files/standards/NASA/B/2022-12-06-NASA-STD-5017B-Approved.pdf": 2,
    "https://www.nasa.gov/reference/6-5-configuration-management/": 2,
    "https://www.nasa.gov/reference/5-3-product-verification/": 1,
})
actual_sources = Counter(link for link in article_six.links if link.startswith("https://") and urlsplit(link).hostname != "aeternasidera.com")
assert actual_sources == article_six_sources, "Article 6: reference URLs or occurrence counts differ from approved copy"
for asset in ["article-six.css", "article-six-visuals.css"]:
    assert f"/assets/{asset}" in article_six.links, f"Article 6: missing presentation asset {asset}"
    css = (ROOT / "assets" / asset).read_text(encoding="utf-8")
    assert not re.search(r"@import|https?://|window\.openai", css), f"Article 6: {asset} must remain self-contained"
assert "/" + articles[4] in article_six.links, "Article 6: previous-article link missing"
assert "/" + articles[5] in article_five.links, "Article 5: next-article link missing"

article_seven = pages[(ROOT / articles[6]).resolve()]
article_seven_metadata = next(item for item in article_seven.scripts if item.get("@type") == "Article")
assert article_seven_metadata.get("headline") == "Establishing Readiness for Customer Use", "Article 7: incorrect headline metadata"
assert article_seven_metadata.get("datePublished") == "2026-10-02", "Article 7: incorrect publication date"
assert article_seven.article_sections == [
    "define-what-ready-means",
    "separate-the-questions-different-evidence-answers",
    "represent-the-installation-and-operating-sequence",
    "turn-results-into-a-defensible-acceptance-decision",
    "deliver-the-hardware-with-usable-information",
    "preserve-that-basis-after-delivery",
], "Article 7: expected six approved sections in order"
assert len(article_seven.article_tables) == 1, "Article 7: expected one evidence-comparison table"
assert len(article_seven.display_equations) == 1 and len(article_seven.math_expressions) == 4, "Article 7: expected one display and three inline expressions"
assert all(equation.get("xmlns") == "http://www.w3.org/1998/Math/MathML" and equation.get("aria-label", "").strip() for equation in article_seven.math_expressions), "Article 7: equations need accessible native MathML"
assert [equation.get("data-tex") for equation in article_seven.display_equations] == [r"y+U\leq L"], "Article 7: illustrative guarded-acceptance expression changed"
assert article_seven.figures == ["figure-test-installation-interfaces", "figure-measurement-guarded-acceptance"], "Article 7: expected two static figures in order"
assert {"test-installation-interfaces", "measurement-guarded-acceptance", "tii-title", "tii-lab-title", "tii-installed-title", "tii-pressure-title", "mga-title", "mga-plot-description"} <= article_seven.ids, "Article 7: static figure content missing"
article_seven_text = (ROOT / articles[6]).read_text(encoding="utf-8")
assert not re.search(r"Private preview|Not published|draft-notice|preview-status|Private editorial notes|Internal editorial notes|END ARTICLE BODY|Prepared:|/mnt/|/home/|C:\\Users|localhost:|window\.openai", article_seven_text, re.I), "Article 7: private review material leaked"
assert not re.search(r"\bour (?:spacecraft|example|configuration|architecture|propellant|valve)\b", article_seven_text, re.I), "Article 7: illustrative hardware presented as selected Aeterna design"
for boundary in [
    "rather than presenting an Aeterna product or qualification result",
    "not an Aeterna system layout or calculated operating conditions",
    "not Aeterna measurements or a claimed coverage probability",
    "uncertainty intervals are not absolute error bounds",
    "not as universal contractual requirements or evidence of Aeterna compliance",
]:
    assert boundary in article_seven_text, f"Article 7: evidence/model boundary missing: {boundary}"
assert not re.search(r"<(?:iframe|button|select|input|textarea)\b", article_seven_text, re.I), "Article 7: static figures must not require controls or nested previews"
assert re.findall(r'<script\b[^>]*\bsrc="([^"]+)"', article_seven_text) == ["/script.js"], "Article 7: figures and equations must not require JavaScript"
without_tex_attributes = re.sub(r'\sdata-tex="[^"]*"', "", article_seven_text)
assert not re.search(r"\\(?:\[|\]|\(|\)|leq|mathrm|begin|end)|\$\$", without_tex_attributes), "Article 7: unrendered LaTeX outside math audit attributes"
for references in re.findall(r'aria-(?:labelledby|describedby)="([^"]+)"', article_seven_text):
    assert set(references.split()) <= article_seven.ids, "Article 7: broken accessible-name/description references"
interfaces = Counter(attrs["data-tii-interface"] for _, attrs in article_seven.elements if "data-tii-interface" in attrs)
assert interfaces == Counter({"electrical": 2, "fluid": 2, "mechanical": 2, "thermal": 2}), "Article 7: both installations need the four compared interfaces"
plots = [attrs for _, attrs in article_seven.elements if "mga-plot" in attrs.get("class", "").split()]
assert len(plots) == 1 and plots[0].get("role") == "img" and plots[0].get("aria-labelledby") == "mga-title mga-plot-description", "Article 7: guarded-acceptance plot needs its accessible explanation"
guardband_cases = [
    tuple(attrs.get(key) for key in ["data-mga-case", "data-mga-reading", "data-mga-lower", "data-mga-upper"])
    for _, attrs in article_seven.elements if "data-mga-case" in attrs
]
assert guardband_cases == [("a", "0.75", "0.65", "0.85"), ("b", "0.95", "0.85", "1.05")], "Article 7: approved hypothetical readings or uncertainty intervals changed"
assert [attrs["data-mga-threshold"] for _, attrs in article_seven.elements if "data-mga-threshold" in attrs] == ["0.90", "1.00"], "Article 7: acceptance and specification thresholds changed"
article_seven_sources = Counter({
    "https://www.nasa.gov/reference/5-5-product-transition/": 2,
    "https://www.nasa.gov/reference/5-3-product-verification/": 4,
    "https://ecss.nl/wp-content/uploads/2022/05/ECSS-E-ST-10-03-Rev.1%2831May2022%29.pdf": 1,
    "https://www.nasa.gov/reference/6-0-crosscutting-technical-management/": 2,
    "https://standards.nasa.gov/sites/default/files/standards/MSFC/Baseline/0/MSFC-HDBK-3701.pdf": 2,
    "https://ntrs.nasa.gov/api/citations/20140010169/downloads/20140010169.pdf": 1,
    "https://www.bipm.org/documents/20126/2071204/JCGM_106_2012_E.pdf": 2,
    "https://ecss.nl/wp-content/uploads/2018/06/ECSS-Q-ST-20C-Rev.2%281February2018%29.pdf": 1,
    "https://www.nasa.gov/reference/6-5-configuration-management/": 1,
    "https://ecss.nl/item/?glossary_id=2684": 1,
})
actual_sources = Counter(link for link in article_seven.links if link.startswith("https://") and urlsplit(link).hostname != "aeternasidera.com")
assert actual_sources == article_seven_sources, "Article 7: reference URLs or occurrence counts differ from approved copy"
for asset in ["article-seven.css", "article-seven-visuals.css"]:
    assert f"/assets/{asset}" in article_seven.links, f"Article 7: missing presentation asset {asset}"
    css = (ROOT / "assets" / asset).read_text(encoding="utf-8")
    assert not re.search(r"@import|https?://|window\.openai|Private preview|preview-status|draft-notice", css, re.I), f"Article 7: {asset} must remain self-contained and free of private-preview material"
assert "/" + articles[5] in article_seven.links, "Article 7: previous-article link missing"
assert "/" + articles[6] in article_six.links, "Article 6: next-article link missing"

namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
urls = [element.text for element in ET.parse(ROOT / "sitemap.xml").findall("s:url/s:loc", namespace)]
expected = list(canonical_urls.values())
assert sorted(urls) == sorted(expected), "sitemap does not match primary pages"
sitemap_lastmods = {
    element.findtext("s:loc", namespaces=namespace): element.findtext("s:lastmod", namespaces=namespace)
    for element in ET.parse(ROOT / "sitemap.xml").findall("s:url", namespace)
}
assert sitemap_lastmods[canonical_urls[articles[6]]] == article_seven_metadata.get("dateModified", article_seven_metadata["datePublished"]), "Article 7: sitemap date differs from release metadata"
assert (ROOT / "CNAME").read_text().strip() == "aeternasidera.com", "deployment domain changed"

# Keep source PNGs, but do not serve their full download cost on the homepage.
homepage = pages[(ROOT / "index.html").resolve()]
image_bytes = 0
for name in ["orbital-operations-concept", "jesus-huizar-portrait"]:
    derivative = f"/assets/{name}.webp"
    assert derivative in homepage.links, f"homepage missing optimized {name}"
    assert f"/assets/{name}.png" not in homepage.links, f"homepage loads source PNG {name}"
    assert (ROOT / f"assets/{name}.png").is_file(), f"source original missing: {name}"
    data = (ROOT / derivative.lstrip("/")).read_bytes()
    assert data[:4] == b"RIFF" and data[8:12] == b"WEBP", f"invalid WebP: {name}"
    image_bytes += len(data)
assert image_bytes < 400_000, "homepage artwork and portrait exceed the 400 kB combined review budget"

social_card = ET.parse(ROOT / "assets/og-card.svg").getroot()
social_mark = social_card.find("{http://www.w3.org/2000/svg}image")
assert social_mark is not None and social_mark.attrib["href"] == "aeterna-sidera-mark.png", "social card must reference the approved mark"
social_png = (ROOT / "assets/og-card.png").read_bytes()
assert social_png.startswith(b"\x89PNG\r\n\x1a\n") and struct.unpack_from(">II", social_png, 16) == (1200, 630), "invalid social card PNG"

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
