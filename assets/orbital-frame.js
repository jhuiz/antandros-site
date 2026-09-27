/* Original orientation schematic, constructed from an orthonormal 3-D frame. */
(() => {
  "use strict";

  const root = document.getElementById("orbital-frame-illustration");
  if (!root) return;

  const radians = Math.PI / 180;
  const raanDegrees = 40;
  const inclinationDegrees = 48;
  const argumentOfLatitudeDegrees = 65;
  const cameraAzimuthDegrees = 48;
  const cameraElevationDegrees = 27;
  const omega = raanDegrees * radians;
  const inclination = inclinationDegrees * radians;
  const azimuth = cameraAzimuthDegrees * radians;
  const elevation = cameraElevationDegrees * radians;
  const xAxis = [1, 0, 0];
  const yAxis = [0, 1, 0];
  const zAxis = [0, 0, 1];
  const node = [Math.cos(omega), Math.sin(omega), 0];
  const transverse = [-Math.sin(omega) * Math.cos(inclination), Math.cos(omega) * Math.cos(inclination), Math.sin(inclination)];
  const normal = [Math.sin(omega) * Math.sin(inclination), -Math.cos(omega) * Math.sin(inclination), Math.cos(inclination)];
  const screenRight = [-Math.sin(azimuth), Math.cos(azimuth), 0];
  const screenUp = [-Math.sin(elevation) * Math.cos(azimuth), -Math.sin(elevation) * Math.sin(azimuth), Math.cos(elevation)];
  const cameraDirection = [Math.cos(elevation) * Math.cos(azimuth), Math.cos(elevation) * Math.sin(azimuth), Math.sin(elevation)];
  const scaled = (vector, scale) => vector.map(value => value * scale);
  const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
  const combine = (a, aScale, b, bScale) => a.map((value, index) => value * aScale + b[index] * bScale);
  const orbitalPoint = u => combine(node, Math.cos(u), transverse, Math.sin(u));
  const spacecraft = orbitalPoint(argumentOfLatitudeDegrees * radians);

  Object.assign(root.dataset, {
    raanDegrees, inclinationDegrees, argumentOfLatitudeDegrees,
    cameraAzimuthDegrees, cameraElevationDegrees,
    nodeVector: JSON.stringify(node), transverseVector: JSON.stringify(transverse),
    normalVector: JSON.stringify(normal), spacecraftVector: JSON.stringify(spacecraft),
    screenRight: JSON.stringify(screenRight), screenUp: JSON.stringify(screenUp),
    cameraDirection: JSON.stringify(cameraDirection)
  });

  root.innerHTML = `
    <h3 class="orbital-frame-title" id="orbital-frame-title">An Earth-centered reference frame</h3>
    <p class="orbital-frame-view">Oblique view · fixed equatorial axes · illustrative orbit</p>
    <svg class="orbital-frame-geometry" id="orbital-frame-svg" role="img" aria-labelledby="orbital-frame-svg-title orbital-frame-svg-desc">
      <title id="orbital-frame-svg-title">Position and orbital-plane orientation in an Earth-centered equatorial frame</title>
      <desc id="orbital-frame-svg-desc">The origin is Earth's center. Positive X points toward the reference equinox, positive Z toward the reference north pole, and positive Y completes a right-handed frame. The shaded equatorial disk contains X and Y. A tilted circular orbit crosses the equator northbound at N; the nearby curved arrow shows motion from south to north. The position vector r ends at the spacecraft. The orbit normal h follows the right-hand rule for that motion. Omega is the equatorial angle from positive X toward positive Y to the ascending node. Inclination i is the angle between positive Z and h. Solid and dashed orbit halves are north and south of the equatorial plane, respectively. This orientation example uses Omega 40 degrees and inclination 48 degrees; it is not an operational orbit or a map.</desc>
    </svg>
    <ul class="orbital-frame-key" aria-label="Coordinate and angle key">
      <li><span>+X</span>Equinox reference</li>
      <li><span>+Y</span>Right-handed frame</li>
      <li><span>+Z</span>Reference north</li>
      <li><span class="orbital-frame-blue">N</span>Northbound crossing</li>
      <li><var class="orbital-frame-blue">r</var>Position vector</li>
      <li><var class="orbital-frame-blue">h</var>Orbit normal</li>
      <li><var class="orbital-frame-ochre">Ω</var>Node direction</li>
      <li><var class="orbital-frame-ochre">i</var>Inclination</li>
    </ul>
    <ul class="orbital-frame-plane-key" aria-label="Plane and orbit line key">
      <li><span class="orbital-frame-swatch orbital-frame-equator-swatch"></span>Equatorial plane</li>
      <li><span class="orbital-frame-swatch orbital-frame-north-swatch"></span>North orbit half</li>
      <li><span class="orbital-frame-swatch orbital-frame-south-swatch"></span>South orbit half</li>
    </ul>
  `;

  const ns = "http://www.w3.org/2000/svg";
  const svg = root.querySelector("#orbital-frame-svg");
  const make = (tag, attributes, parent = svg) => {
    const element = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
    parent.appendChild(element);
    return element;
  };
  const defs = make("defs", {});
  [
    ["axis", "var(--orbital-frame-axis)"],
    ["orbit", "var(--orbital-frame-blue)"],
    ["angle", "var(--orbital-frame-ochre)"]
  ].forEach(([name, color]) => {
    const marker = make("marker", { id: "orbital-frame-" + name + "-arrow", viewBox: "0 0 10 10", refX: 8.5, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto", markerUnits: "userSpaceOnUse" }, defs);
    make("path", { d: "M1 1L9 5L1 9Z", fill: color }, marker);
  });
  const drawing = make("g", { "data-orbital-frame-part": "drawing" });

  function draw() {
    const width = svg.getBoundingClientRect().width;
    if (!width) return;
    // Measured coordinates keep labels at their CSS-pixel size on narrow screens.
    const unit = Math.max(30, Math.min(226, (width - 64) / 2.22));
    const height = unit * 2.35 + 52;
    const cx = width / 2;
    const cy = height * 0.57;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("height", String(height));
    svg.dataset.projection = "orthographic";
    svg.dataset.unitPixels = unit;
    svg.dataset.origin = JSON.stringify([cx, cy]);
    drawing.replaceChildren();

    const project = vector => [cx + unit * dot(vector, screenRight), cy - unit * dot(vector, screenUp)];
    const pathThrough = (pointAt, start, end, count = 100) => {
      const points = [];
      for (let index = 0; index <= count; index++) {
        const point = project(pointAt(start + (end - start) * index / count));
        points.push((index ? "L" : "M") + point.map(value => value.toFixed(3)).join(" "));
      }
      return points.join(" ");
    };
    const path = (part, d, attributes = {}) => make("path", { "data-orbital-frame-part": part, d, fill: "none", ...attributes }, drawing);
    const line = (part, start, end, attributes = {}) => path(part, "M" + project(start).join(" ") + "L" + project(end).join(" "), attributes);
    const label = (part, text, vector, dx = 0, dy = 0, attributes = {}) => {
      const [x, y] = project(vector);
      const element = make("text", { "data-orbital-frame-label": part, x: x + dx, y: y + dy, "text-anchor": "middle", "dominant-baseline": "middle", ...attributes }, drawing);
      element.textContent = text;
      return element;
    };
    const equatorialPoint = angle => [1.06 * Math.cos(angle), 1.06 * Math.sin(angle), 0];

    // Both disks are projected 3-D circles. Dashed orbit means z < 0,
    // not occlusion or eclipse; the legend keeps that convention explicit.
    path("equatorial-plane", pathThrough(equatorialPoint, 0, 2 * Math.PI) + "Z", { fill: "var(--orbital-frame-equator)", stroke: "var(--orbital-frame-plane-edge)", "stroke-width": 1 });
    path("orbital-plane", pathThrough(orbitalPoint, 0, 2 * Math.PI) + "Z", { fill: "var(--orbital-frame-orbit-fill)" });
    path("south-half", pathThrough(orbitalPoint, Math.PI, 2 * Math.PI), { stroke: "var(--orbital-frame-blue)", "stroke-width": 1.7, "stroke-dasharray": "5 5" });
    line("line-of-nodes", scaled(node, -1), node, { stroke: "var(--orbital-frame-plane-edge)", "stroke-width": 1, "stroke-dasharray": "3 4" });

    const earthRadius = Math.max(12, unit * 0.115);
    make("circle", { cx, cy, r: earthRadius, fill: "var(--paper, #f3f0e8)", stroke: "var(--orbital-frame-plane-edge)", "stroke-width": 1.1, "data-orbital-frame-part": "earth" }, drawing);
    path("earth-equator", pathThrough(angle => [earthRadius / unit * Math.cos(angle), earthRadius / unit * Math.sin(angle), 0], 0, 2 * Math.PI), { stroke: "var(--orbital-frame-plane-edge)", "stroke-width": 0.8 });

    const origin = [0, 0, 0];
    [["x", xAxis, 1.42], ["y", yAxis, 1.42], ["z", zAxis, 1.33]].forEach(([name, direction, length]) => {
      line(name + "-axis", origin, scaled(direction, length), { stroke: "var(--orbital-frame-axis)", "stroke-width": 1.3, "marker-end": "url(#orbital-frame-axis-arrow)" });
    });
    line("orbit-normal", origin, scaled(normal, 1.23), { stroke: "var(--orbital-frame-blue)", "stroke-width": 1.8, "marker-end": "url(#orbital-frame-orbit-arrow)" });
    path("north-half", pathThrough(orbitalPoint, 0, Math.PI), { stroke: "var(--orbital-frame-blue)", "stroke-width": 2.2 });
    line("position-vector", origin, spacecraft, { stroke: "var(--orbital-frame-blue)", "stroke-width": 1.8, "marker-end": "url(#orbital-frame-orbit-arrow)" });

    // RAAN is a circle in XY; inclination is a circle in span(+Z, h).
    // The latter is parameterized about the node axis, so its 3-D angle is i.
    const angleRadius = 0.61;
    path("raan-arc", pathThrough(angle => [angleRadius * Math.cos(angle), angleRadius * Math.sin(angle), 0], 0, omega, 48), { stroke: "var(--orbital-frame-ochre)", "stroke-width": 1.8, "marker-end": "url(#orbital-frame-angle-arrow)" });
    const tiltDirection = [Math.sin(omega), -Math.cos(omega), 0];
    const inclinationPoint = angle => combine(zAxis, angleRadius * Math.cos(angle), tiltDirection, angleRadius * Math.sin(angle));
    path("inclination-arc", pathThrough(inclinationPoint, 0, inclination, 48), { stroke: "var(--orbital-frame-ochre)", "stroke-width": 1.8, "marker-end": "url(#orbital-frame-angle-arrow)" });

    // u increases through zero at N: dz/du = sin(i) > 0 there.
    path("northbound-approach", pathThrough(orbitalPoint, -0.20, 0, 16), { stroke: "var(--orbital-frame-blue)", "stroke-width": 2.8, "stroke-dasharray": "5 5" });
    path("northbound-motion", pathThrough(orbitalPoint, 0, 0.30, 24), { stroke: "var(--orbital-frame-blue)", "stroke-width": 2.8, "marker-end": "url(#orbital-frame-orbit-arrow)" });
    const [nx, ny] = project(node);
    path("ascending-node", `M${nx} ${ny - 5}L${nx + 5} ${ny}L${nx} ${ny + 5}L${nx - 5} ${ny}Z`, { fill: "var(--orbital-frame-blue)", stroke: "var(--paper, #f3f0e8)", "stroke-width": 1 });
    const [sx, sy] = project(spacecraft);
    make("circle", { "data-orbital-frame-part": "spacecraft", cx: sx, cy: sy, r: 4.3, fill: "var(--orbital-frame-blue)", stroke: "var(--paper, #f3f0e8)", "stroke-width": 1.4 }, drawing);
    make("circle", { cx, cy, r: 2.6, fill: "var(--ink, #08121c)" }, drawing);

    label("x", "+X", scaled(xAxis, 1.42), -8, 15);
    label("y", "+Y", scaled(yAxis, 1.42), 8, 15);
    label("z", "+Z", scaled(zAxis, 1.33), 0, -15);
    label("node", "N", node, -4, 17, { class: "orbital-frame-label-blue" });
    label("normal", "h", scaled(normal, 1.23), -12, -9, { class: "orbital-frame-label-blue orbital-frame-label-vector" });
    label("position", "r", scaled(spacecraft, 0.58), 9, 5, { class: "orbital-frame-label-blue orbital-frame-label-vector" });
    label("raan", "Ω", [0.79 * Math.cos(omega / 2), 0.79 * Math.sin(omega / 2), 0], 0, 6, { class: "orbital-frame-label-ochre" });
    label("inclination", "i", scaled(inclinationPoint(inclination / 2), 1.23), 0, -3, { class: "orbital-frame-label-ochre orbital-frame-label-vector" });
    label("earth", "Earth", origin, -earthRadius - 12, 0, { class: "orbital-frame-earth-label", "text-anchor": "end" });
    if (width >= 440) label("spacecraft", "Spacecraft", spacecraft, 12, -12, { class: "orbital-frame-small-label", "text-anchor": "start" });
  }

  if (typeof ResizeObserver === "function") {
    new ResizeObserver(draw).observe(root);
  } else {
    window.addEventListener("resize", draw);
  }
  draw();
})();
