/* Alternative initial states in a normalized, unforced two-body model. */
(() => {
  "use strict";

  const root = document.getElementById("state-coast-figure");
  if (!root || root.dataset.ready === "true") return;

  const tau = 2 * Math.PI;
  const ratio = 1.15;
  const a = 1 / (2 - ratio * ratio);
  const e = ratio * ratio - 1;
  const b = a * Math.sqrt(1 - e * e);
  const n = Math.pow(a, -1.5);
  const durationMs = 12000;
  const samples = 480;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let fraction = 0;
  let playing = false;
  let raf = null;
  let lastStamp = null;
  let lastWidth = 0;
  let layout;
  const marks = new Map();

  // mu = 1, r(0) = (1, 0). Time is a fraction of A's period, 2 pi.
  function pointAt(which, f) {
    const t = tau * f;
    if (which === "a") {
      return { x: Math.cos(t), y: Math.sin(t), vx: -Math.sin(t), vy: Math.cos(t) };
    }
    const mean = n * t;
    let E = mean;
    for (let k = 0; k < 16; k++) {
      const step = (E - e * Math.sin(E) - mean) / (1 - e * Math.cos(E));
      E -= step;
      if (Math.abs(step) < 1e-13) break;
    }
    const edot = n / (1 - e * Math.cos(E));
    return {
      x: a * (Math.cos(E) - e), y: b * Math.sin(E),
      vx: -a * Math.sin(E) * edot, vy: b * Math.cos(E) * edot
    };
  }

  const trails = new Map(["a", "b"].map(which => [which,
    Array.from({ length: samples + 1 }, (_, index) => pointAt(which, index / samples))
  ]));

  root.innerHTML = `
    <h3 class="coast-heading">Same position, different motion</h3>
    <p class="coast-context">Alternative initial states · same starting position and direction</p>
    <div class="coast-legend" role="group" aria-label="Alternative initial states">
      <span class="coast-key"><span class="coast-dot" aria-hidden="true"></span>A · initial speed v₀</span>
      <span class="coast-key"><span class="coast-diamond" aria-hidden="true"></span>B · initial speed 1.15 v₀</span>
    </div>
    <p class="coast-frame-note">Earth-centered · nonrotating axes</p>
    <div class="coast-scene">
      <svg class="coast-svg" role="img" aria-labelledby="coast-title coast-description">
        <title id="coast-title">Two alternative coast trajectories from the same starting position</title>
        <desc id="coast-description">Case A starts with circular speed and Case B starts fifteen percent faster in the same tangential direction. Both are ideal point-mass two-body coasts. They are alternative initial states, not two spacecraft flying together. Arrows show instantaneous velocity on a shared scale. Faint curves show the complete orbits; stronger trails show elapsed motion. The Earth symbol is not to scale.</desc>
        <g class="coast-drawing"></g>
      </svg>
    </div>
    <div class="coast-control" role="group" aria-label="Coasting comparison playback">
      <button type="button" class="coast-play" id="coast-play" aria-describedby="coast-motion-note">Play</button>
      <div class="coast-slider">
        <label class="coast-readout" for="coast-time">
          <span>Elapsed time</span><output id="coast-time-output" for="coast-time" aria-live="off">0.000 T₀</output>
        </label>
        <input type="range" id="coast-time" min="0" max="1" step="0.001" value="0" aria-valuetext="0.000 circular-orbit periods" aria-describedby="coast-time-note">
      </div>
    </div>
    <p class="coast-detail" id="coast-time-note">T₀: period of A · r₀: initial radius · arrows: velocity</p>
    <p class="coast-motion-note" id="coast-motion-note" hidden></p>
    <div class="coast-sr-only" id="coast-announcement" aria-live="polite" aria-atomic="true"></div>
  `;

  const scene = root.querySelector(".coast-scene");
  const svg = root.querySelector(".coast-svg");
  const drawing = root.querySelector(".coast-drawing");
  const slider = root.querySelector("#coast-time");
  const output = root.querySelector("#coast-time-output");
  const play = root.querySelector("#coast-play");
  const motionNote = root.querySelector("#coast-motion-note");
  const announcement = root.querySelector("#coast-announcement");
  root.dataset.model = "two-body-alternative-initial-states";
  root.dataset.fraction = "0";
  root.dataset.playing = "false";

  function make(tag, attributes = {}, text) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = text;
    drawing.appendChild(node);
    return node;
  }

  function draw() {
    const width = scene.getBoundingClientRect().width;
    if (width <= 0) return;
    lastWidth = width;
    const height = Math.min(470, Math.max(292, width * 0.7));
    const scale = Math.min((width - 50) / 3.8, (height - 70) / 3.4);
    const cx = width / 2 + 0.38 * scale;
    const cy = height / 2 + 3;
    const X = value => cx + value * scale;
    const Y = value => cy - value * scale;
    layout = { width, height, scale, cx, cy, X, Y };
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("height", String(height));
    drawing.replaceChildren();
    marks.clear();

    make("line", { x1: 8, x2: width - 8, y1: cy, y2: cy, class: "coast-axis" });
    make("line", { x1: cx, x2: cx, y1: 10, y2: height - 12, class: "coast-axis" });
    make("text", { x: width - 9, y: cy + 18, "text-anchor": "end" }, "X / r₀");
    make("text", { x: cx + 8, y: 21 }, "Y / r₀");
    for (const value of [-1, 1]) {
      make("line", { x1: X(value), x2: X(value), y1: cy - 3, y2: cy + 3, class: "coast-axis" });
      make("line", { x1: cx - 3, x2: cx + 3, y1: Y(value), y2: Y(value), class: "coast-axis" });
    }
    for (const which of ["a", "b"]) {
      let orbit = "";
      for (let j = 0; j <= 240; j++) {
        const angle = tau * j / 240;
        const px = which === "a" ? Math.cos(angle) : a * (Math.cos(angle) - e);
        const py = which === "a" ? Math.sin(angle) : b * Math.sin(angle);
        orbit += (j ? "L" : "M") + X(px).toFixed(3) + "," + Y(py).toFixed(3);
      }
      make("path", { d: orbit + "Z", class: "coast-orbit coast-case-" + which, "data-full-orbit": which });
      const trail = make("path", { class: "coast-trail coast-case-" + which, "data-trail": which });
      marks.set(which, { trail });
    }
    make("circle", { cx, cy, r: 9, class: "coast-earth" });
    make("circle", { cx, cy, r: 2, fill: "var(--coast-ink)" });
    make("text", { x: cx, y: cy + 25, "text-anchor": "middle" }, "Earth");
    make("circle", { cx: X(1), cy: Y(0), r: 3, fill: "var(--coast-ink)" });
    const startLabel = make("text", { x: X(1), y: cy + 51, "text-anchor": "end", "data-shared-start": "" }, "Shared start");
    layout.startLabel = startLabel;
    // The two markers nest at the same coordinates at the epoch; no artificial displacement.
    for (const which of ["b", "a"]) {
      const color = "var(--coast-" + which + ")";
      const velocity = make("line", { stroke: color, "stroke-width": 2, "stroke-dasharray": which === "b" ? "4 3" : "none", "data-velocity": which });
      const arrowhead = make("path", { fill: "none", stroke: color, "stroke-width": 2 });
      const marker = which === "a"
        ? make("circle", { r: 5, fill: color, "data-case": which })
        : make("path", { fill: "var(--coast-paper)", stroke: color, "stroke-width": 2, "data-case": which });
      const label = make("text", { "text-anchor": "middle", "data-case-label": which, class: "coast-case-label" }, which.toUpperCase());
      Object.assign(marks.get(which), { velocity, arrowhead, marker, label });
    }
    paintTime();
  }

  function paintTime() {
    slider.value = String(fraction);
    output.value = fraction.toFixed(3) + " T₀";
    slider.setAttribute("aria-valuetext", fraction.toFixed(3) + " circular-orbit periods");
    root.dataset.fraction = String(fraction);
    root.dataset.playing = String(playing);
    if (!layout) return;
    const { X, Y, scale, startLabel } = layout;
    startLabel.setAttribute("display", fraction === 0 ? "inline" : "none");
    for (const which of ["b", "a"]) {
      const state = pointAt(which, fraction);
      const elements = marks.get(which);
      const px = X(state.x);
      const py = Y(state.y);
      const dx = state.vx * 0.5 * scale;
      const dy = -state.vy * 0.5 * scale;
      const tx = px + dx;
      const ty = py + dy;
      const length = Math.hypot(dx, dy);
      const ux = dx / length;
      const uy = dy / length;
      for (const [key, value] of Object.entries(state)) elements.marker.dataset[key] = String(value);
      for (const [key, value] of Object.entries({ x1: px, y1: py, x2: tx, y2: ty })) elements.velocity.setAttribute(key, String(value));
      elements.arrowhead.setAttribute("d", "M" + (tx - 7 * ux - 3 * uy) + "," + (ty - 7 * uy + 3 * ux) + "L" + tx + "," + ty + "L" + (tx - 7 * ux + 3 * uy) + "," + (ty - 7 * uy - 3 * ux));
      if (which === "a") {
        elements.marker.setAttribute("cx", String(px));
        elements.marker.setAttribute("cy", String(py));
      } else {
        elements.marker.setAttribute("d", "M" + px + "," + (py - 7) + "L" + (px + 7) + "," + py + "L" + px + "," + (py + 7) + "L" + (px - 7) + "," + py + "Z");
      }
      elements.label.setAttribute("x", String(px + (which === "a" ? -12 : 12)));
      elements.label.setAttribute("y", String(py + (which === "a" ? 20 : -12)));
      let trail = "";
      const lastSample = Math.floor(fraction * samples);
      for (let j = 0; j <= lastSample; j++) {
        const point = trails.get(which)[j];
        trail += (j ? "L" : "M") + X(point.x).toFixed(3) + "," + Y(point.y).toFixed(3);
      }
      trail += "L" + px.toFixed(3) + "," + py.toFixed(3);
      elements.trail.setAttribute("d", trail);
    }
  }

  function updatePlayLabel() {
    const action = playing ? "Pause" : fraction >= 1 ? "Replay" : "Play";
    play.textContent = motion.matches ? "Motion off" : action;
    play.setAttribute("aria-label", motion.matches
      ? "Animation disabled for reduced motion; the time slider remains available"
      : action + " the coasting comparison");
  }

  function stop() {
    playing = false;
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    lastStamp = null;
    root.dataset.playing = "false";
    updatePlayLabel();
  }

  function tick(stamp) {
    if (!playing) return;
    if (document.hidden || motion.matches || scene.getBoundingClientRect().width <= 0) {
      stop();
      return;
    }
    if (lastStamp !== null) fraction = Math.min(1, fraction + (stamp - lastStamp) / durationMs);
    lastStamp = stamp;
    paintTime();
    if (fraction >= 1) {
      stop();
      announcement.textContent = "One circular-orbit period elapsed. Case B has not completed its longer orbit. Select Replay to return to the shared starting position.";
    } else {
      raf = requestAnimationFrame(tick);
    }
  }

  slider.addEventListener("input", () => {
    stop();
    fraction = Math.max(0, Math.min(1, Number(slider.value)));
    paintTime();
    updatePlayLabel();
    announcement.textContent = "";
  });
  play.addEventListener("click", () => {
    if (motion.matches || document.hidden) return;
    if (playing) {
      stop();
      return;
    }
    if (fraction >= 1) fraction = 0;
    playing = true;
    lastStamp = null;
    announcement.textContent = "";
    updatePlayLabel();
    paintTime();
    raf = requestAnimationFrame(tick);
  });

  function applyMotionPreference() {
    if (motion.matches) stop();
    play.disabled = motion.matches;
    root.dataset.reducedMotion = String(motion.matches);
    motionNote.textContent = motion.matches
      ? "Reduced motion: use the time slider to compare the coasts."
      : "";
    motionNote.hidden = !motion.matches;
    updatePlayLabel();
  }

  if (motion.addEventListener) motion.addEventListener("change", applyMotionPreference);
  else motion.addListener(applyMotionPreference);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  window.addEventListener("pagehide", stop);
  window.addEventListener("blur", stop);
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => {
      const width = scene.getBoundingClientRect().width;
      if (width <= 0) stop();
      else if (Math.abs(width - lastWidth) > 0.25) draw();
    }).observe(scene);
  } else {
    window.addEventListener("resize", draw);
  }
  if (typeof IntersectionObserver !== "undefined") {
    new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) stop();
    }).observe(root);
  }
  applyMotionPreference();
  draw();
  root.dataset.ready = "true";
})();
