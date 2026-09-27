/* Normalized local linear longitude libration; an undamped educational model. */
(() => {
  "use strict";

  const root = document.getElementById("geo-libration-illustration");
  if (!root || root.dataset.chartReady === "true") return;

  const sampleIntervals = 1200;
  const extentT = [0, 3];
  const series = [
    { id: "smaller", name: "Smaller", amplitude: 0.5, color: "var(--geo-smaller)", dash: null },
    { id: "larger", name: "Larger", amplitude: 1.8, color: "var(--geo-larger)", dash: "7 4" }
  ];

  // q = longitude offset / illustrative band half-width; tau = t / libration period.
  // q = A sin(2 pi tau), q(0) = 0, and dq/dtau(0) = 2 pi A, without damping or control.
  for (const item of series) {
    item.values = Array.from({ length: sampleIntervals + 1 }, (_, index) => {
      const t = 3 * index / sampleIntervals;
      return { t, q: item.amplitude * Math.sin(2 * Math.PI * t) };
    });
  }

  const allQ = series.flatMap(item => item.values.map(point => point.q));
  const extentQ = [Math.min(...allQ, -1, 0, 1), Math.max(...allQ, -1, 0, 1)];
  const padT = (extentT[1] - extentT[0]) * 0.01;
  const padQ = (extentQ[1] - extentQ[0]) * 0.065;
  const domainT = [extentT[0] - padT, extentT[1] + padT];
  const domainQ = [extentQ[0] - padQ, extentQ[1] + padQ];
  const visible = new Set(series.map(item => item.id));
  let selectedT = null;
  let hoverT = null;
  let box;
  let x;
  let y;
  let guide;
  let markerLayer;
  let lastWidth = 0;
  let currentT = 0;
  let playing = false;
  let animationFrame = null;
  let previousFrame = null;
  let detailPointerY;
  const secondsPerPeriod = 6;
  const anglePerQ = 0.48; // Display magnification only: not a physical longitude conversion.
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const dialMarkers = new Map();
  let dialCenter = 0;
  const dialY = 131;
  const dialRadius = 82; // Shared schematic marker radius; not orbital radius or altitude.

  root.innerHTML = `
    <h3 class="geo-heading">Bounded motion can still exceed a limit</h3>
    <p class="geo-context">GEO longitude · local linear model · same equilibrium, different initial drift</p>
    <div class="geo-comparison">
      <svg id="geo-longitude-dial" class="geo-dial" role="img" aria-labelledby="geo-dial-title geo-dial-description">
        <title id="geo-dial-title">Earth-fixed longitude, viewed from above the north pole</title>
        <desc id="geo-dial-description">Earth and the reference meridian stay fixed. An ideal geostationary reference remains at the same equilibrium used for the two undamped oscillations. Positive longitude is counterclockwise toward the east; negative longitude is clockwise toward the west. The shaded angular band represents offsets from minus one to plus one. Marker excursions are magnified and their common diagram radius does not represent an orbit or altitude. At equal longitudes, the diamond, circle and square nest at the same position.</desc>
      </svg>
      <div class="geo-readouts" aria-label="Longitude at the selected time">
        <p class="geo-view-label">Earth-fixed · north-pole view</p>
        <div class="geo-readout" data-geo-readout="reference">
          <svg class="geo-symbol" viewBox="0 0 28 24" aria-hidden="true"><rect x="10" y="8" width="8" height="8" fill="var(--geo-ink)"/></svg>
          <div><span class="geo-case-name">Ideal geostationary reference</span><output data-geo-value="reference">0.00 · fixed at equilibrium</output></div>
        </div>
        <div class="geo-readout" data-geo-readout="smaller">
          <svg class="geo-symbol" viewBox="0 0 28 24" aria-hidden="true"><circle cx="14" cy="12" r="6" fill="var(--geo-paper)" stroke="var(--geo-smaller)" stroke-width="2"/></svg>
          <div><span class="geo-case-name">Smaller oscillation</span><output data-geo-value="smaller"></output></div>
        </div>
        <div class="geo-readout" data-geo-readout="larger">
          <svg class="geo-symbol" viewBox="0 0 28 24" aria-hidden="true"><path d="M14 2L24 12L14 22L4 12Z" fill="none" stroke="var(--geo-larger)" stroke-width="2"/></svg>
          <div><span class="geo-case-name">Larger oscillation</span><output data-geo-value="larger"></output></div>
        </div>
        <p class="geo-diagram-note">Offsets are × limit. Excursions magnified; marker radius is schematic, not an orbit or altitude.</p>
      </div>
    </div>
    <div class="geo-controls" role="group" aria-label="Shared animation and plot time">
      <button id="geo-play" class="geo-play" type="button" aria-describedby="geo-motion-note">Play</button>
      <div class="geo-time-control">
        <label for="geo-time">Time <output id="geo-time-output" for="geo-time">0.000 / 3 periods</output></label>
        <input id="geo-time" type="range" min="0" max="3" step="0.001" value="0" aria-label="Time in longitude-libration periods" />
      </div>
    </div>
    <p id="geo-motion-note" class="geo-motion-note">Playback: 6 seconds per libration period.</p>
    <svg id="geo-libration-chart" class="geo-chart" role="img" aria-labelledby="geo-libration-title geo-libration-description">
      <title id="geo-libration-title">Two bounded longitude oscillations compared with a fixed ideal GEO reference</title>
      <desc id="geo-libration-description">Two undamped oscillations start at the same equilibrium longitude as the ideal reference, which remains at zero. The smaller reaches half the illustrative limit and stays within the band; the larger reaches 1.8 times the limit and repeatedly crosses it. Both repeat for three longitude-libration periods. These are not orbital periods or days. Solid blue denotes the smaller oscillation; dashed ochre denotes the larger. The shaded band extends from minus one to plus one. The time cursor is shared with the Earth-fixed view above.</desc>
    </svg>
    <div class="geo-legend" role="group" aria-label="Visible trajectories">
      <span class="geo-reference-key">
        <svg class="geo-legend-key" viewBox="0 0 30 16" aria-hidden="true"><path d="M1 8H29" fill="none" stroke="var(--geo-ink)" stroke-width="1.4"/><rect x="12" y="5" width="6" height="6" fill="var(--geo-ink)"/></svg>
        <span>Geostationary reference · 0</span>
      </span>
      <button class="geo-series-toggle" type="button" aria-pressed="true" data-series="smaller" aria-label="Smaller oscillation, amplitude 0.5 times the illustrative limit">
        <svg class="geo-legend-key" viewBox="0 0 30 16" aria-hidden="true"><path d="M1 8H29" fill="none" stroke="var(--geo-smaller)" stroke-width="2.1"/></svg>
        <span>Smaller · 0.5 × limit</span>
      </button>
      <button class="geo-series-toggle" type="button" aria-pressed="true" data-series="larger" aria-label="Larger oscillation, amplitude 1.8 times the illustrative limit">
        <svg class="geo-legend-key" viewBox="0 0 30 16" aria-hidden="true"><path d="M1 8H29" fill="none" stroke="var(--geo-larger)" stroke-width="2.1" stroke-dasharray="7 4"/></svg>
        <span>Larger · 1.8 × limit</span>
      </button>
      <span class="geo-band-key">
        <svg class="geo-legend-key" viewBox="0 0 30 16" aria-hidden="true"><rect x="1" y="2" width="28" height="12" fill="var(--geo-band)" stroke="var(--geo-line)"/></svg>
        <span>Illustrative range: −1 to +1</span>
      </span>
    </div>
    <p class="geo-model-note">Undamped, normalized example · zero offset is equilibrium</p>
    <p class="geo-interaction-note">Play or scrub to compare. Exploring the plot pauses playback. Tap to pin; tap the same point to release. Select a legend label to hide or show an oscillation.</p>
    <div class="geo-tooltip" id="geo-libration-tooltip" role="tooltip" hidden></div>
    <div id="geo-libration-announcement" class="geo-sr-only" aria-live="polite" aria-atomic="true"></div>
  `;

  const svg = root.querySelector("#geo-libration-chart");
  const dial = root.querySelector("#geo-longitude-dial");
  const timeInput = root.querySelector("#geo-time");
  const timeOutput = root.querySelector("#geo-time-output");
  const playButton = root.querySelector("#geo-play");
  const motionNote = root.querySelector("#geo-motion-note");
  const tooltip = root.querySelector("#geo-libration-tooltip");
  const announcement = root.querySelector("#geo-libration-announcement");
  const clipId = "geo-libration-plot-clip";
  root.dataset.model = "local-linear-undamped";
  root.dataset.sampleCount = String(sampleIntervals + 1);
  root.dataset.amplitudes = "0.5,1.8";
  root.dataset.timeExtent = "0,3";
  root.dataset.operatingBand = "-1,1";
  root.dataset.domainT = domainT.join(",");
  root.dataset.domainQ = domainQ.join(",");
  root.dataset.pinned = "false";
  root.dataset.time = "0.00000000";
  root.dataset.playing = "false";
  root.dataset.secondsPerPeriod = String(secondsPerPeriod);
  root.dataset.anglePerQ = String(anglePerQ);
  root.dataset.referenceQ = "0";

  function addSvg(parent, tag, attributes = {}, text) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [name, value] of Object.entries(attributes)) {
      if (value !== null) element.setAttribute(name, String(value));
    }
    if (text !== undefined) element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function linear(domain, range) {
    const scale = value => range[0] + (value - domain[0]) / (domain[1] - domain[0]) * (range[1] - range[0]);
    scale.invert = value => domain[0] + (value - range[0]) / (range[1] - range[0]) * (domain[1] - domain[0]);
    return scale;
  }

  function interpolate(item, t) {
    let low = 0;
    let high = item.values.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (item.values[middle].t < t) low = middle + 1;
      else high = middle;
    }
    if (low === 0) return item.values[0].q;
    if (low === item.values.length) return item.values[item.values.length - 1].q;
    const before = item.values[low - 1];
    const after = item.values[low];
    return before.q + (after.q - before.q) * (t - before.t) / (after.t - before.t);
  }

  function signedNumber(value) {
    const rounded = Math.abs(value) < 0.0005 ? 0 : value;
    return (rounded > 0 ? "+" : "") + rounded.toFixed(2);
  }

  function inBand(q) {
    return Math.abs(q) <= 1 + 1e-10;
  }

  function dialPoint(q, radius = dialRadius) {
    const angle = q * anglePerQ;
    // Screen y points downward: positive east longitude goes left from the top meridian.
    return [dialCenter - radius * Math.sin(angle), dialY - radius * Math.cos(angle)];
  }

  function arcPath(fromQ, toQ, radius) {
    const a = dialPoint(fromQ, radius);
    const b = dialPoint(toQ, radius);
    return "M" + a.join(",") + "A" + radius + "," + radius + " 0 0 " + (toQ > fromQ ? 0 : 1) + " " + b.join(",");
  }

  function drawDial() {
    const width = dial.getBoundingClientRect().width;
    if (width <= 0) return;
    dialCenter = width / 2;
    dial.setAttribute("viewBox", "0 0 " + width + " 215");
    dial.setAttribute("height", "215");
    for (const child of [...dial.children]) {
      if (child.localName !== "title" && child.localName !== "desc") child.remove();
    }
    dialMarkers.clear();
    const outsideStart = dialPoint(-1, 94);
    const outsideEnd = dialPoint(1, 94);
    const insideEnd = dialPoint(1, 70);
    const insideStart = dialPoint(-1, 70);
    addSvg(dial, "path", {
      id: "geo-dial-band", "data-geo-part": "band", "data-q-min": -1, "data-q-max": 1,
      d: "M" + outsideStart.join(",") + "A94,94 0 0 0 " + outsideEnd.join(",") +
        "L" + insideEnd.join(",") + "A70,70 0 0 1 " + insideStart.join(",") + "Z",
      fill: "var(--geo-band)"
    });
    addSvg(dial, "path", {
      id: "geo-dial-longitude-guide", "data-geo-part": "longitude-guide",
      d: arcPath(-2, 2, dialRadius), fill: "none", stroke: "var(--geo-line)", "stroke-width": 1
    });
    for (const q of [-1, 1]) {
      const a = dialPoint(q, 70);
      const b = dialPoint(q, 94);
      addSvg(dial, "line", { "data-geo-band-limit": q, x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: "var(--geo-muted)", "stroke-width": 1 });
      addSvg(dial, "text", { x: b[0] + (q > 0 ? -5 : 5), y: b[1] - 7, "text-anchor": "middle" }, q > 0 ? "+1" : "−1");
    }
    addSvg(dial, "circle", {
      id: "geo-dial-earth", "data-geo-part": "earth", cx: dialCenter, cy: dialY, r: 42,
      fill: "var(--geo-earth)", stroke: "var(--geo-muted)", "stroke-width": 1
    });
    addSvg(dial, "line", {
      id: "geo-dial-meridian", "data-geo-part": "reference-meridian",
      x1: dialCenter, y1: dialY, x2: dialCenter, y2: 29,
      stroke: "var(--geo-muted)", "stroke-width": 1, "stroke-dasharray": "3 3"
    });
    addSvg(dial, "text", { x: dialCenter, y: 15, "text-anchor": "middle" }, "Equilibrium · q = 0");
    addSvg(dial, "text", { x: 9, y: 83 }, "East +");
    addSvg(dial, "text", { x: width - 9, y: 83, "text-anchor": "end" }, "− West");
    addSvg(dial, "circle", { cx: dialCenter, cy: dialY, r: 2.5, fill: "var(--geo-ink)" });
    addSvg(dial, "text", { x: dialCenter, y: dialY - 13, "text-anchor": "middle" }, "N");
    addSvg(dial, "text", { x: dialCenter, y: dialY + 23, "text-anchor": "middle" }, "Earth");
    addSvg(dial, "text", { x: dialCenter, y: 201, "text-anchor": "middle" }, "Earth and meridian fixed");
    // Nested symbols share exactly the same radius and position when their q values agree.
    for (const id of ["larger", "smaller", "reference"]) {
      const marker = addSvg(dial, "g", { id: "geo-dial-marker-" + id, "data-geo-marker": id });
      if (id === "larger") addSvg(marker, "path", { d: "M0,-12L12,0L0,12L-12,0Z", fill: "none", stroke: "var(--geo-larger)", "stroke-width": 2 });
      else if (id === "smaller") addSvg(marker, "circle", { r: 6, fill: "var(--geo-paper)", stroke: "var(--geo-smaller)", "stroke-width": 2 });
      else addSvg(marker, "rect", { x: -3, y: -3, width: 6, height: 6, fill: "var(--geo-ink)" });
      dialMarkers.set(id, marker);
    }
  }

  function paintTime() {
    const values = { reference: 0 };
    for (const item of series) values[item.id] = interpolate(item, currentT);
    root.dataset.time = currentT.toFixed(8);
    root.dataset.modelValues = JSON.stringify(values);
    root.dataset.playing = String(playing);
    timeInput.value = String(currentT);
    timeInput.setAttribute("aria-valuetext", currentT.toFixed(3) + " longitude-libration periods");
    timeOutput.value = currentT.toFixed(3) + " / 3 periods";
    for (const [id, marker] of dialMarkers) {
      const q = values[id];
      const on = id === "reference" || visible.has(id);
      const position = dialPoint(q);
      marker.setAttribute("transform", "translate(" + position.join(",") + ")");
      marker.dataset.q = String(q);
      marker.dataset.angleRad = String(q * anglePerQ);
      marker.dataset.x = String(position[0]);
      marker.dataset.y = String(position[1]);
      marker.dataset.inBand = String(inBand(q));
      if (on) marker.removeAttribute("display");
      else marker.setAttribute("display", "none");
      root.querySelector('[data-geo-readout="' + id + '"]').hidden = !on;
      if (id !== "reference") {
        root.querySelector('[data-geo-value="' + id + '"]').value = signedNumber(q) + " · " + (inBand(q) ? "in band" : "outside band");
      }
    }
    if (!x || !guide || !markerLayer) return;
    const px = x(currentT);
    guide.setAttribute("x1", String(px));
    guide.setAttribute("x2", String(px));
    guide.dataset.time = String(currentT);
    markerLayer.replaceChildren();
    for (const item of series.filter(item => visible.has(item.id))) {
      addSvg(markerLayer, "circle", {
        "data-playhead-marker": item.id, "data-q": values[item.id], cx: px, cy: y(values[item.id]), r: 4.5,
        fill: item.color, stroke: "var(--geo-paper)", "stroke-width": 1.5
      });
    }
    addSvg(markerLayer, "rect", {
      "data-playhead-marker": "reference", "data-q": 0,
      x: px - 2.5, y: y(0) - 2.5, width: 5, height: 5, fill: "var(--geo-ink)"
    });
    showDetail(selectedT === null ? hoverT : currentT, detailPointerY);
  }

  function setTime(t) {
    currentT = Math.max(extentT[0], Math.min(extentT[1], t));
    paintTime();
  }

  function showDetail(t, pointerY, announce = false) {
    for (const marker of root.querySelectorAll("[data-chart-hover-marker]")) marker.removeAttribute("data-chart-hover-marker");
    if (t === null || !x) {
      tooltip.hidden = true;
      delete root.dataset.hoverTime;
      delete root.dataset.hoverValues;
      return;
    }
    t = Math.max(extentT[0], Math.min(extentT[1], t));
    const active = series.filter(item => visible.has(item.id)).map(item => ({ ...item, q: interpolate(item, t) }));
    const px = x(t);
    for (const item of active) {
      const marker = markerLayer.querySelector('[data-playhead-marker="' + item.id + '"]');
      if (marker) marker.setAttribute("data-chart-hover-marker", item.id);
    }
    tooltip.replaceChildren();
    const heading = document.createElement("div");
    heading.className = "geo-tip-title";
    heading.textContent = "Time " + t.toFixed(3) + " periods";
    tooltip.appendChild(heading);
    const reference = document.createElement("div");
    reference.className = "geo-tip-reference";
    reference.textContent = "Ideal reference · 0.00 · fixed";
    tooltip.appendChild(reference);
    for (const item of active) {
      const row = document.createElement("div");
      row.className = "geo-tip-row";
      row.dataset.tooltipSeries = item.id;
      const name = document.createElement("span");
      name.textContent = item.name;
      const value = document.createElement("span");
      value.textContent = signedNumber(item.q) + " · " + (inBand(item.q) ? "in band" : "outside");
      row.append(name, value);
      tooltip.appendChild(row);
    }
    tooltip.hidden = false;
    const rootBounds = root.getBoundingClientRect();
    const svgBounds = svg.getBoundingClientRect();
    const tipBounds = tooltip.getBoundingClientRect();
    const svgX = svgBounds.left - rootBounds.left;
    const svgY = svgBounds.top - rootBounds.top;
    const preferredLeft = px > (box.left + box.right) / 2 ? svgX + px - tipBounds.width - 14 : svgX + px + 14;
    const preferredTop = svgY + (Number.isFinite(pointerY) ? pointerY : box.top + 8) - tipBounds.height - 12;
    tooltip.style.left = Math.max(4, Math.min(rootBounds.width - tipBounds.width - 4, preferredLeft)) + "px";
    tooltip.style.top = Math.max(svgY + box.top + 4, Math.min(svgY + box.bottom - tipBounds.height - 4, preferredTop)) + "px";
    root.dataset.hoverTime = t.toFixed(8);
    root.dataset.hoverValues = JSON.stringify(active.map(item => ({ id: item.id, q: item.q })));
    if (announce) {
      announcement.textContent = heading.textContent + ". " + active.map(item => item.name + " offset " + signedNumber(item.q) + " times the limit, " + (inBand(item.q) ? "in band" : "outside the band")).join(". ");
    }
  }

  function syncVisibility() {
    for (const button of root.querySelectorAll("button[data-series]")) {
      const on = visible.has(button.dataset.series);
      button.setAttribute("aria-pressed", String(on));
      const trajectory = svg.querySelector('[data-trajectory="' + button.dataset.series + '"]');
      if (trajectory) {
        if (on) trajectory.removeAttribute("display");
        else trajectory.setAttribute("display", "none");
      }
    }
    root.dataset.visibleSeries = series.filter(item => visible.has(item.id)).map(item => item.id).join(",");
    paintTime();
  }

  function pointerPosition(event) {
    const bounds = svg.getBoundingClientRect();
    return [
      (event.clientX - bounds.left) * svg.viewBox.baseVal.width / bounds.width,
      (event.clientY - bounds.top) * svg.viewBox.baseVal.height / bounds.height
    ];
  }

  function draw() {
    const width = svg.getBoundingClientRect().width;
    if (width <= 0) return;
    lastWidth = width;
    const height = width < 400 ? 330 : 350;
    box = { left: 62, right: width - 12, top: 14, bottom: height - 56 };
    x = linear(domainT, [box.left + 5, box.right - 5]);
    y = linear(domainQ, [box.bottom - 5, box.top + 5]);
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("height", String(height));
    for (const child of [...svg.children]) {
      if (child.localName !== "title" && child.localName !== "desc") child.remove();
    }
    drawDial();

    const defs = addSvg(svg, "defs");
    const clip = addSvg(defs, "clipPath", { id: clipId });
    addSvg(clip, "rect", { x: box.left, y: box.top, width: box.right - box.left, height: box.bottom - box.top });
    const plot = addSvg(svg, "g", { "clip-path": "url(#" + clipId + ")" });
    addSvg(plot, "rect", {
      "data-operating-band": "", x: box.left, y: y(1), width: box.right - box.left,
      height: y(-1) - y(1), fill: "var(--geo-band)"
    });
    const yTicks = [-2, -1, 0, 1, 2];
    const xTicks = width < 400 ? [0, 1, 2, 3] : [0, 0.5, 1, 1.5, 2, 2.5, 3];
    for (const value of yTicks) {
      addSvg(plot, "line", {
        class: "geo-grid", x1: box.left, x2: box.right, y1: y(value), y2: y(value),
        stroke: "var(--geo-line)", "stroke-width": 1
      });
    }
    for (const value of [-1, 1]) {
      addSvg(plot, "line", {
        "data-band-limit": value, x1: box.left, x2: box.right, y1: y(value), y2: y(value),
        stroke: "var(--geo-muted)", "stroke-width": 1
      });
    }
    addSvg(plot, "line", {
      id: "geo-ideal-reference-line", "data-trajectory": "reference", "data-geo-part": "reference-baseline",
      x1: box.left, x2: box.right, y1: y(0), y2: y(0),
      stroke: "var(--geo-ink)", "stroke-width": 1.4
    });
    for (const item of series) {
      const path = item.values.map((point, index) => (index ? "L" : "M") + x(point.t).toFixed(3) + "," + y(point.q).toFixed(3)).join("");
      addSvg(plot, "path", {
        "data-trajectory": item.id, "data-sample-count": item.values.length, d: path,
        fill: "none", stroke: item.color, "stroke-width": 2.1, "stroke-dasharray": item.dash
      });
    }
    addSvg(svg, "rect", {
      "data-chart-frame": "", x: box.left, y: box.top, width: box.right - box.left,
      height: box.bottom - box.top, fill: "none", stroke: "var(--geo-line)", "stroke-width": 1
    });

    const yAxis = addSvg(svg, "g", { class: "geo-y-axis" });
    for (const value of yTicks) {
      const tick = addSvg(yAxis, "g", { class: "geo-tick" });
      addSvg(tick, "text", { x: box.left - 10, y: y(value), dy: "0.32em", "text-anchor": "end" }, value > 0 ? "+" + value : String(value));
    }
    const xAxis = addSvg(svg, "g", { class: "geo-x-axis" });
    xTicks.forEach((value, index) => {
      const tick = addSvg(xAxis, "g", { class: "geo-tick" });
      addSvg(tick, "text", {
        x: x(value), y: box.bottom + 10, dy: "0.71em",
        "text-anchor": index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle"
      }, String(value));
    });
    addSvg(svg, "text", {
      class: "geo-axis-title", "data-axis": "y",
      transform: "translate(15," + ((box.top + box.bottom) / 2) + ") rotate(-90)", "text-anchor": "middle"
    }, "Longitude offset (× limit)");
    addSvg(svg, "text", {
      class: "geo-axis-title", "data-axis": "x", x: (box.left + box.right) / 2,
      y: height - 7, "text-anchor": "middle"
    }, "Time (libration periods)");

    guide = addSvg(plot, "line", {
      "data-chart-hover-guide": "", "data-playhead": "", y1: box.top, y2: box.bottom,
      stroke: "var(--geo-muted)", "stroke-width": 1
    });
    markerLayer = addSvg(plot, "g");
    const hit = addSvg(svg, "rect", {
      "data-chart-hit": "", "data-chart-hover-overlay": "cross-series", x: x(extentT[0]), y: box.top,
      width: x(extentT[1]) - x(extentT[0]), height: box.bottom - box.top, fill: "transparent"
    });
    hit.addEventListener("pointermove", event => {
      if (event.pointerType === "touch" || selectedT !== null) return;
      pause();
      const point = pointerPosition(event);
      hoverT = Math.max(extentT[0], Math.min(extentT[1], x.invert(point[0])));
      detailPointerY = point[1];
      setTime(hoverT);
    });
    hit.addEventListener("pointerleave", () => {
      hoverT = null;
      if (selectedT === null) showDetail(null);
    });
    hit.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      pause();
      const point = pointerPosition(event);
      const t = Math.max(extentT[0], Math.min(extentT[1], x.invert(point[0])));
      selectedT = selectedT !== null && Math.abs(x(selectedT) - point[0]) < 12 ? null : t;
      hoverT = selectedT;
      root.dataset.pinned = String(selectedT !== null);
      detailPointerY = point[1];
      setTime(t);
      showDetail(selectedT, point[1], true);
      if (selectedT === null) announcement.textContent = "Pinned point released.";
    });
    syncVisibility();
    root.dataset.chartReady = "true";
  }

  function pause() {
    playing = false;
    root.dataset.playing = "false";
    playButton.textContent = "Play";
    playButton.setAttribute("aria-label", "Play longitude comparison");
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    previousFrame = null;
  }

  function clearExploration() {
    selectedT = null;
    hoverT = null;
    detailPointerY = undefined;
    root.dataset.pinned = "false";
    showDetail(null);
  }

  function tick(timestamp) {
    if (!playing) return;
    if (document.hidden || reducedMotion.matches || root.getBoundingClientRect().width === 0) {
      pause();
      return;
    }
    if (previousFrame !== null) setTime(currentT + (timestamp - previousFrame) / (secondsPerPeriod * 1000));
    previousFrame = timestamp;
    if (currentT >= extentT[1]) {
      pause();
      announcement.textContent = "Playback complete at three libration periods. Select Play to replay.";
      return;
    }
    animationFrame = requestAnimationFrame(tick);
  }

  function syncMotionPreference() {
    root.dataset.reducedMotion = String(reducedMotion.matches);
    playButton.disabled = reducedMotion.matches;
    motionNote.textContent = reducedMotion.matches
      ? "Reduced motion: use the time slider to compare."
      : "Playback: 6 seconds per libration period.";
    if (reducedMotion.matches) pause();
  }

  playButton.addEventListener("click", () => {
    if (playing) {
      pause();
      return;
    }
    if (reducedMotion.matches || document.hidden) return;
    clearExploration();
    if (currentT >= extentT[1]) setTime(extentT[0]);
    playing = true;
    root.dataset.playing = "true";
    playButton.textContent = "Pause";
    playButton.setAttribute("aria-label", "Pause longitude comparison");
    previousFrame = null;
    animationFrame = requestAnimationFrame(tick);
  });
  timeInput.addEventListener("input", () => {
    pause();
    clearExploration();
    setTime(Number(timeInput.value));
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
  window.addEventListener("pagehide", pause);
  window.addEventListener("blur", pause);
  if (reducedMotion.addEventListener) reducedMotion.addEventListener("change", syncMotionPreference);
  else reducedMotion.addListener(syncMotionPreference);

  for (const button of root.querySelectorAll("button[data-series]")) {
    button.addEventListener("click", () => {
      const id = button.dataset.series;
      if (visible.has(id)) visible.delete(id);
      else visible.add(id);
      syncVisibility();
      const names = series.filter(item => visible.has(item.id)).map(item => item.name);
      announcement.textContent = names.length ? names.join(" and ") + " trajectories visible." : "Both trajectories hidden. Select a legend label to show a curve.";
    });
  }
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => {
      if (Math.abs(svg.getBoundingClientRect().width - lastWidth) > 0.5) draw();
    }).observe(root);
  } else {
    window.addEventListener("resize", draw);
  }
  syncMotionPreference();
  draw();
})();
