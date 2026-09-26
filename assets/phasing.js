/* Original illustrative two-body phasing coast. All calculations use SI units. */
(() => {
  "use strict";

  const figure = document.getElementById("phasing-illustration");
  if (!figure) return;

  const controls = figure.querySelector(".phasing-controls");
  const slider = document.getElementById("phasing-time");
  const button = document.getElementById("phasing-play");
  const daysLabel = document.getElementById("phasing-days");
  const lagLabel = document.getElementById("phasing-lag");
  const readout = document.getElementById("phasing-readout");
  const description = document.getElementById("phasing-svg-description");
  const craft = figure.querySelector('[data-phasing-part="craft"]');
  const ray = figure.querySelector('[data-phasing-part="ray"]');
  const arc = figure.querySelector('[data-phasing-part="arc"]');
  const sector = figure.querySelector('[data-phasing-part="sector"]');
  if (![controls, slider, button, daysLabel, lagLabel, readout, description, craft, ray, arc, sector].every(Boolean)) return;

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mu = 3.986e14;
  const referenceSemimajorAxis = 7.078e6;
  const semimajorAxisOffset = 5000;
  const meanMotion = Math.sqrt(mu / referenceSemimajorAxis ** 3);
  const lagRadiansPerDay = 1.5 * meanMotion * semimajorAxisOffset / referenceSemimajorAxis * 86400;
  const endDay = 10;
  let day = 1.8;
  let animation = null;
  let lastTime = null;

  function setAttributes(element, attributes) {
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
  }

  function draw() {
    const angle = lagRadiansPerDay * day;
    const x = 300 + 150 * Math.cos(angle);
    const y = 180 + 150 * Math.sin(angle);
    const arcX = 300 + 85 * Math.cos(angle);
    const arcY = 180 + 85 * Math.sin(angle);
    const degrees = (angle * 180 / Math.PI).toFixed(2);
    setAttributes(craft, { x: x - 7, y: y - 7 });
    setAttributes(ray, { x2: x, y2: y });
    arc.setAttribute("d", day > 0 ? `M 385 180 A 85 85 0 0 1 ${arcX} ${arcY}` : "");
    sector.setAttribute("d", day > 0 ? `M 300 180 L 385 180 A 85 85 0 0 1 ${arcX} ${arcY} Z` : "");
    slider.value = String(day);
    daysLabel.textContent = day.toFixed(2);
    lagLabel.textContent = degrees;
    slider.setAttribute("aria-valuetext", `${day.toFixed(2)} days; ${degrees} degrees of phase lag`);
    description.textContent = `A frame rotating with the reference spacecraft. The higher spacecraft is ${degrees} degrees behind after ${day.toFixed(2)} days. The reference spacecraft stays at the right of the diagram; the higher spacecraft moves clockwise as its phase lag grows. Orbit spacing and Earth size are schematic.`;
  }

  function updateButton() {
    if (animation !== null) button.textContent = "Pause coast";
    else if (day >= endDay) button.textContent = motionPreference.matches ? "Reset coast" : "Replay coast";
    else button.textContent = motionPreference.matches ? "Advance 1 day" : "Play coast";
    button.setAttribute("aria-pressed", String(animation !== null));
  }

  function stop() {
    if (animation !== null) window.cancelAnimationFrame(animation);
    animation = null;
    lastTime = null;
    readout.setAttribute("aria-live", "polite");
    updateButton();
  }

  function tick(now) {
    if (lastTime !== null) day = Math.min(endDay, day + Math.max(0, now - lastTime) / 1000);
    lastTime = now;
    draw();
    if (day >= endDay) {
      stop();
      return;
    }
    animation = window.requestAnimationFrame(tick);
  }

  slider.addEventListener("input", () => {
    stop();
    day = Math.max(0, Math.min(endDay, Number(slider.value)));
    draw();
    updateButton();
  });

  button.addEventListener("click", () => {
    if (animation !== null) {
      stop();
      return;
    }
    if (motionPreference.matches) {
      day = day >= endDay ? 0 : Math.min(endDay, day + 1);
      draw();
      updateButton();
      return;
    }
    if (day >= endDay) day = 0;
    lastTime = null;
    readout.setAttribute("aria-live", "off");
    animation = window.requestAnimationFrame(tick);
    updateButton();
  });

  // Stop rather than advancing a large interval after a background tab returns.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
  motionPreference.addEventListener("change", stop);
  window.addEventListener("pagehide", stop);
  draw();
  updateButton();
  controls.hidden = false;
})();
