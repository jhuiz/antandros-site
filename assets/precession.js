/* Educational mean-Sun geometry; this is not numerical orbit propagation. */
(() => {
  "use strict";

  const root = document.getElementById("precession-illustration");
  if (!root) return;

  root.innerHTML = `
    <h3 class="precession-title" id="precession-title">Why a Sun-synchronous plane turns</h3>
    <p class="precession-view">Earth-centered · both views from the north pole · fixed equatorial axes</p>
    <div class="precession-control">
      <div class="precession-time-label">
        <label for="precession-year-position">Elapsed time</label>
        <output id="precession-elapsed" for="precession-year-position">Day 91.3 / 365.2</output>
      </div>
      <input id="precession-year-position" type="range" min="0" max="100" step="1" value="25" aria-describedby="precession-control-help">
      <p class="precession-sr-only" id="precession-control-help">Move through one year to compare an ideal Sun-synchronous orbital plane with an ideal fixed plane. The diamond identifies the ascending node, where the orbit crosses the equator northbound.</p>
    </div>
    <div class="precession-comparison">
      <section class="precession-panel" aria-labelledby="precession-follow-heading">
        <h4 id="precession-follow-heading">Sun-synchronous plane</h4>
        <p class="precession-plane-angle">Node rotation <span id="precession-follow-angle">90.0° east</span></p>
        <svg class="precession-geometry" id="precession-follow-svg" role="img" aria-labelledby="precession-follow-title precession-follow-desc">
          <title id="precession-follow-title">Sun-synchronous orbit viewed from the north pole</title>
          <desc id="precession-follow-desc">The ascending node and mean-Sun direction turn together through the year.</desc>
        </svg>
        <div class="precession-node-time"><span>Ascending-node local time</span><output id="precession-follow-time" for="precession-year-position">18:00</output></div>
      </section>
      <section class="precession-panel" aria-labelledby="precession-fixed-heading">
        <h4 id="precession-fixed-heading">Fixed plane · ideal reference</h4>
        <p class="precession-plane-angle">Node rotation <span>0.0°</span></p>
        <svg class="precession-geometry" id="precession-fixed-svg" role="img" aria-labelledby="precession-fixed-title precession-fixed-desc">
          <title id="precession-fixed-title">Ideal fixed orbital plane viewed from the north pole</title>
          <desc id="precession-fixed-desc">The ascending node stays fixed as the mean-Sun direction changes.</desc>
        </svg>
        <div class="precession-node-time"><span>Ascending-node local time</span><output id="precession-fixed-time" for="precession-year-position">12:00</output></div>
      </section>
    </div>
    <ul class="precession-legend" aria-label="Diagram legend">
      <li><svg viewBox="0 0 28 20" aria-hidden="true"><path d="M14 3L21 10L14 17L7 10Z" fill="currentColor"/></svg>Ascending node</li>
      <li><svg viewBox="0 0 28 20" aria-hidden="true"><path d="M2 10H25M20 6L25 10L20 14" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>Mean-Sun direction</li>
      <li><svg viewBox="0 0 28 20" aria-hidden="true"><path d="M2 10H26" stroke="currentColor" stroke-width="2"/></svg>North orbit half</li>
      <li><svg viewBox="0 0 28 20" aria-hidden="true"><path d="M2 10H26" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4"/></svg>South orbit half</li>
    </ul>
    <p class="precession-model-note">Mean local solar time · projected circular orbits · schematic scale</p>
    <p class="precession-sr-only" id="precession-accessible-summary" aria-live="polite" aria-atomic="true"></p>
  `;

  const ns = "http://www.w3.org/2000/svg";
  const periodDays = 365.2422;
  const inclination = 98.2 * Math.PI / 180;
  const initialNode = Math.PI / 2;
  const slider = root.querySelector("#precession-year-position");
  const elapsed = root.querySelector("#precession-elapsed");
  const angleOutput = root.querySelector("#precession-follow-angle");
  const followingTime = root.querySelector("#precession-follow-time");
  const fixedTime = root.querySelector("#precession-fixed-time");
  const accessible = root.querySelector("#precession-accessible-summary");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let progress = 25;
  let paintedProgress = progress;
  let animation = null;

  // alpha_mean = 2 pi t / year; Omega_SSO = alpha_mean + 90 degrees.
  // The ideal reference suppresses nodal precession. Both projections use
  // the same illustrative inclination and exaggerated Earth/orbit scale.
  function localTime(node, meanSun) {
    const hours = ((12 + (node - meanSun) * 12 / Math.PI) % 24 + 24) % 24;
    const minutes = Math.round(hours * 60) % 1440;
    return String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
  }

  function make(tag, attributes, parent) {
    const element = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
    parent.appendChild(element);
    return element;
  }

  function setup(svg, color, follows) {
    const defs = make("defs", {}, svg);
    const arrowId = svg.id + "-sun-arrow";
    const marker = make("marker", { id: arrowId, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" }, defs);
    make("path", { d: "M1 1L9 5L1 9", fill: "none", stroke: "var(--precession-ink)", "stroke-width": 1.4 }, marker);
    const layer = make("g", {}, svg);
    const axis = make("path", { fill: "none", stroke: "var(--precession-axis)", "stroke-width": 1 }, layer);
    const far = make("path", { "data-precession-part": "south-half", fill: "none", stroke: color, "stroke-width": 1.8, "stroke-dasharray": "4 4" }, layer);
    const earth = make("circle", { fill: "var(--precession-earth)", stroke: "var(--precession-axis)", "stroke-width": 1 }, layer);
    const near = make("path", { "data-precession-part": "north-half", fill: "none", stroke: color, "stroke-width": 2.2 }, layer);
    const sunArrow = make("path", { "data-precession-part": "sun-direction", fill: "none", stroke: "var(--precession-ink)", "stroke-width": 1.4, "marker-end": "url(#" + arrowId + ")" }, layer);
    const sun = make("circle", { "data-precession-part": "mean-sun", r: 6, fill: "var(--precession-paper)", stroke: "var(--precession-ink)", "stroke-width": 1.5 }, layer);
    const node = make("path", { "data-precession-part": "ascending-node", fill: color, stroke: "var(--precession-paper)", "stroke-width": 1.4 }, layer);
    const center = make("circle", { r: 2, fill: "var(--precession-ink)" }, layer);
    const earthLabel = make("text", { "text-anchor": "middle" }, layer);
    earthLabel.textContent = "Earth";
    return { svg, follows, axis, far, earth, near, sunArrow, sun, node, center, earthLabel };
  }

  const panels = [
    setup(root.querySelector("#precession-follow-svg"), "var(--precession-blue)", true),
    setup(root.querySelector("#precession-fixed-svg"), "var(--precession-orange)", false)
  ];

  function draw(panel, pct) {
    const width = panel.svg.getBoundingClientRect().width;
    if (!width) return;
    const height = Math.min(width, 360);
    const cx = width / 2;
    const cy = height / 2;
    const outer = Math.max(1, Math.min(width, height) / 2 - 24);
    const radius = outer * 0.78;
    const earthRadius = radius * 0.32;
    const meanSun = pct / 100 * 2 * Math.PI;
    const nodeAngle = initialNode + (panel.follows ? meanSun : 0);
    const direction = (angle, length) => [cx + length * Math.cos(angle), cy - length * Math.sin(angle)];

    // A measured viewBox keeps SVG text and strokes at their CSS pixel size.
    panel.svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    panel.svg.setAttribute("height", String(height));
    panel.axis.setAttribute("d", "M" + (cx - outer - 8) + " " + cy + "H" + (cx + outer + 8) + "M" + cx + " " + (cy - outer - 8) + "V" + (cy + outer + 8));
    panel.earth.setAttribute("cx", String(cx));
    panel.earth.setAttribute("cy", String(cy));
    panel.earth.setAttribute("r", String(earthRadius));
    panel.center.setAttribute("cx", String(cx));
    panel.center.setAttribute("cy", String(cy));

    // Orthographic projection of Rz(Omega) Rx(i) [r cos u, r sin u, 0].
    // z = r sin u sin i: u in (0, pi) is north of the equator.
    function arc(start, end) {
      const points = [];
      for (let index = 0; index <= 80; index++) {
        const u = start + (end - start) * index / 80;
        const x = radius * (Math.cos(nodeAngle) * Math.cos(u) - Math.sin(nodeAngle) * Math.sin(u) * Math.cos(inclination));
        const y = radius * (Math.sin(nodeAngle) * Math.cos(u) + Math.cos(nodeAngle) * Math.sin(u) * Math.cos(inclination));
        points.push((index ? "L" : "M") + (cx + x).toFixed(3) + " " + (cy - y).toFixed(3));
      }
      return points.join(" ");
    }
    panel.far.setAttribute("d", arc(Math.PI, 2 * Math.PI));
    panel.near.setAttribute("d", arc(0, Math.PI));
    const [nx, ny] = direction(nodeAngle, radius);
    panel.node.setAttribute("d", "M" + nx + " " + (ny - 6) + "L" + (nx + 6) + " " + ny + "L" + nx + " " + (ny + 6) + "L" + (nx - 6) + " " + ny + "Z");
    const [sx, sy] = direction(meanSun, outer);
    const [ax, ay] = direction(meanSun, earthRadius + 7);
    const [bx, by] = direction(meanSun, outer - 10);
    panel.sunArrow.setAttribute("d", "M" + ax + " " + ay + "L" + bx + " " + by);
    panel.sun.setAttribute("cx", String(sx));
    panel.sun.setAttribute("cy", String(sy));
    panel.earthLabel.setAttribute("x", String(cx));
    panel.earthLabel.setAttribute("y", String(height - 4));
    panel.svg.dataset.nodeDegrees = (nodeAngle * 180 / Math.PI).toFixed(6);
    panel.svg.dataset.meanSunDegrees = (meanSun * 180 / Math.PI).toFixed(6);
    panel.svg.dataset.localTime = localTime(nodeAngle, meanSun);
  }

  function paint(pct) {
    paintedProgress = pct;
    panels.forEach(panel => draw(panel, pct));
  }

  function stopAnimation() {
    if (animation !== null) window.cancelAnimationFrame(animation);
    animation = null;
  }

  function paintTarget(animate) {
    stopAnimation();
    if (!animate || reducedMotion.matches) {
      paint(progress);
      return;
    }
    const start = paintedProgress;
    const end = progress;
    const began = performance.now();
    function frame(now) {
      const ratio = Math.min(1, Math.max(0, (now - began) / 160));
      const eased = ratio * ratio * (3 - 2 * ratio);
      paint(start + (end - start) * eased);
      animation = ratio < 1 ? window.requestAnimationFrame(frame) : null;
    }
    animation = window.requestAnimationFrame(frame);
  }

  function update(animate = false, announce = false) {
    const meanSun = progress / 100 * 2 * Math.PI;
    const days = progress / 100 * periodDays;
    elapsed.textContent = "Day " + days.toFixed(1) + " / " + periodDays.toFixed(1);
    angleOutput.textContent = (progress * 3.6).toFixed(1) + "° east";
    followingTime.textContent = localTime(initialNode + meanSun, meanSun);
    fixedTime.textContent = localTime(initialNode, meanSun);
    slider.value = String(progress);
    slider.setAttribute("aria-valuetext", days.toFixed(1) + " days, " + progress + " percent of one year");
    if (announce) accessible.textContent = "Day " + days.toFixed(1) + ". Sun-synchronous ascending-node mean local time " + followingTime.textContent + "; fixed-plane reference " + fixedTime.textContent + ".";
    panels[0].svg.querySelector("desc").textContent = "Viewed from the north pole at day " + days.toFixed(1) + ", the ascending node has turned " + (progress * 3.6).toFixed(1) + " degrees east. Mean local time remains " + followingTime.textContent + ". The diamond marks the northbound equator crossing, not a spacecraft attitude. Solid and dashed curves mark the north and south orbit halves; illumination is not modeled.";
    panels[1].svg.querySelector("desc").textContent = "Viewed from the north pole at day " + days.toFixed(1) + ", the ideal reference node has not turned. The mean-Sun direction has turned " + (progress * 3.6).toFixed(1) + " degrees east; ascending-node mean local time is " + fixedTime.textContent + ". The diamond marks the northbound equator crossing.";
    paintTarget(animate);
  }

  slider.addEventListener("input", () => {
    progress = Math.max(0, Math.min(100, Number(slider.value)));
    update(true);
  });
  slider.addEventListener("change", () => update(false, true));
  reducedMotion.addEventListener("change", () => paintTarget(false));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) paintTarget(false);
  });
  window.addEventListener("pagehide", stopAnimation);
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => paint(paintedProgress));
    panels.forEach(panel => observer.observe(panel.svg.parentElement));
  } else {
    window.addEventListener("resize", () => paint(paintedProgress));
  }
  update();
})();
