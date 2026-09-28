/* Article 4: responsive versions of the original illustrative calculations.
 * Assumptions and sources are documented in the article and SVG metadata.
 * Static PNG figures remain available when JavaScript fails.
 */
(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const G0 = 9.80665;
  const DAY = 86400;
  const HALL_DV = 262.4695436105533;
  const CHEMICAL_DV = 262.3887989371143;
  const HALL_ISP = 1400;
  const EFFICIENCY = 0.30;
  const MONO_ISP = 220;
  const BI_ISP = 290;
  const MONO_RETAINED = 120;
  const COMMON_BUS = 100;
  const breakEven = MONO_RETAINED * Math.expm1(
    CHEMICAL_DV / G0 * (1 / MONO_ISP - 1 / BI_ISP)
  );
  const initialMono = MONO_RETAINED * Math.exp(CHEMICAL_DV / (G0 * MONO_ISP));
  const initialDifference = extra => (MONO_RETAINED + extra)
    * Math.exp(CHEMICAL_DV / (G0 * BI_ISP)) - initialMono;
  const massCeiling = (power, days) => {
    const exhaustSpeed = G0 * HALL_ISP;
    const thrust = 2 * EFFICIENCY * power / exhaustSpeed;
    return thrust * days * DAY / (exhaustSpeed * Math.expm1(HALL_DV / exhaustSpeed));
  };

  const close = (value, reference) => Math.abs(value - reference) < 1e-9;
  const checked = close(breakEven, 3.5749787707456426)
    && close(initialDifference(breakEven), 0)
    && close(initialMono, 135.5188689370743)
    && close(massCeiling(200, 30), 85.49302786650398)
    && close(massCeiling(1000, 30), 427.4651393325198)
    && close(massCeiling(200, 2), 5.6995351911002645)
    && close(massCeiling(1000, 2), 28.49767595550132);

  function element(parent, tag, attributes = {}, text) {
    const node = document.createElementNS(NS, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    if (text !== undefined) node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  function canvas(id, width, height, title, description, audit) {
    const svg = document.createElementNS(NS, 'svg');
    const attributes = {
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      role: 'img',
      'aria-labelledby': `${id}-title ${id}-description`,
      'data-article-four-chart': id,
      'data-model-checks': 'passed'
    };
    Object.entries(attributes).forEach(([key, value]) => svg.setAttribute(key, value));
    element(svg, 'title', { id: `${id}-title` }, title);
    element(svg, 'desc', { id: `${id}-description` }, description);
    element(svg, 'metadata', {}, JSON.stringify(audit));
    return svg;
  }

  function label(svg, x, y, text, extra = {}) {
    return element(svg, 'text', { x, y, class: 'chart-label', ...extra }, text);
  }

  function line(svg, x1, y1, x2, y2, className, extra = {}) {
    return element(svg, 'line', { x1, y1, x2, y2, class: className, ...extra });
  }

  function plotGrid(svg, bounds, sx, sy, xTicks, yTicks, xFormat, yFormat) {
    const { left, right, top, bottom } = bounds;
    for (const y of yTicks) {
      line(svg, left, sy(y), right, sy(y), 'chart-grid');
      label(svg, left - 8, sy(y) + 4, yFormat(y), { 'text-anchor': 'end' });
    }
    for (const x of xTicks) {
      line(svg, sx(x), top, sx(x), bottom, 'chart-grid');
      label(svg, sx(x), bottom + 21, xFormat(x), { 'text-anchor': 'middle' });
    }
    line(svg, left, top, left, bottom, 'chart-axis');
    line(svg, left, bottom, right, bottom, 'chart-axis');
  }

  function renderHall(width) {
    const narrow = width < 440;
    const height = narrow ? 410 : 448;
    const headingOffset = narrow ? 18 : 0;
    const bounds = { left: narrow ? 37 : 47, right: width - 19, top: 69 + headingOffset, bottom: height - 75 };
    const { left, right, top, bottom } = bounds;
    const sx = p => left + p / 1040 * (right - left);
    const sy = m => bottom - (m + 10) / 510 * (bottom - top);
    const checkpoints = {
      '30.0': { '200': massCeiling(200, 30), '1000': massCeiling(1000, 30) },
      '2.0': { '200': massCeiling(200, 2), '1000': massCeiling(1000, 2) }
    };
    const audit = {
      source: 'series_04_hall_power_mass_figure.py',
      delta_v_m_s: HALL_DV,
      assumed_total_propellant_isp_s: HALL_ISP,
      assumed_complete_input_efficiency: EFFICIENCY,
      assumed_operating_availability: 1,
      assumed_other_overhead_days: 0,
      deadlines_days: [30, 2],
      complete_input_power_range_w: [100, 1000],
      common_hardware_mass_only_kg: COMMON_BUS,
      checkpoints_mass_ceiling_kg_by_days_then_watts: checkpoints,
      mass_definition: 'All spacecraft mass remaining after the relocation: common bus and payload, propulsion/power/thermal hardware, and unspent consumables. Not payload alone or dry mass only.',
      boundary: 'Complete propulsion electrical input; separate hypothetical operating points, not one device throttle range.',
      fixed_and_variable_parameters: 'Specific impulse and efficiency are held fixed. Thrust increases with actual operating input power.',
      interpretation: 'Optimistic resource screen, not mission or hardware feasibility.'
    };
    const svg = canvas('hall-power-mass', width, height,
      'Maximum mass after relocation',
      'Illustrative Hall resource screen for a circular coplanar 500 to 1,000 km relocation. '
      + 'Assumed total-propellant specific impulse 1,400 s, 30% efficiency at complete propulsion electrical input, '
      + 'continuous firing (availability 1) and zero other overhead. The solid blue 30-day curve passes through '
      + '85.49 kg at 200 W and 427.47 kg at 1,000 W. The dashed brown 48-hour curve passes through 5.70 kg '
      + 'at 200 W and 28.50 kg at 1,000 W. Both share one mass scale. The dashed horizontal reference is '
      + '100 kg of common hardware alone, before propulsion equipment and retained consumables. '
      + 'The vertical axis is the maximum mass of the entire spacecraft remaining after relocation: '
      + 'common bus and payload, propulsion and additional power/thermal hardware, and unspent consumables. '
      + 'It is not payload alone or dry mass only. Specific impulse and efficiency are fixed; thrust '
      + 'increases with actual operating power. A maximum above 100 kg does not establish a feasible installation. '
      + 'Points from 100 to 1,000 W are separately sized hypothetical configurations, not a device throttle range.', audit);

    label(svg, 0, 18, narrow ? 'Maximum mass after' : 'Maximum mass after relocation (kg)', { class: 'chart-axis-label' });
    if (narrow) label(svg, 0, 36, 'relocation (kg)', { class: 'chart-axis-label' });
    line(svg, 2, 43 + headingOffset, 25, 43 + headingOffset, 'chart-curve chart-long');
    label(svg, 32, 47 + headingOffset, '30 days');
    line(svg, 116, 43 + headingOffset, 139, 43 + headingOffset, 'chart-curve chart-short');
    label(svg, 146, 47 + headingOffset, '48 hours');
    plotGrid(svg, bounds, sx, sy, narrow ? [0, 200, 600, 1000] : [0, 200, 400, 600, 800, 1000],
      [0, 100, 200, 300, 400, 500], x => x.toLocaleString('en-US'), String);

    line(svg, left, sy(COMMON_BUS), right, sy(COMMON_BUS), 'chart-common-mass', { 'data-reference-mass-kg': COMMON_BUS });
    label(svg, left + 7, sy(COMMON_BUS) - 9,
      narrow ? '100 kg bus only' : '100 kg common hardware alone', { class: 'chart-label chart-annotation' });

    for (const days of [30, 2]) {
      const points = [];
      for (let power = 100; power <= 1000; power += 10) {
        points.push(`${sx(power)},${sy(massCeiling(power, days))}`);
      }
      const className = days === 30 ? 'chart-long' : 'chart-short';
      element(svg, 'path', {
        d: `M ${points.join(' L ')}`,
        class: `chart-curve ${className}`,
        'data-deadline-days': days,
        'data-point-count': points.length,
        'data-min-power-w': 100,
        'data-max-power-w': 1000
      });
      for (const power of [200, 1000]) {
        const mass = massCeiling(power, days);
        const common = { class: `chart-marker ${className}`, 'data-power-w': power, 'data-mass-kg': mass, 'data-deadline-days': days };
        if (days === 30) {
          element(svg, 'circle', { cx: sx(power), cy: sy(mass), r: 4.5, ...common });
        } else {
          element(svg, 'rect', { x: sx(power) - 3.5, y: sy(mass) - 3.5, width: 7, height: 7, ...common });
        }
      }
    }
    label(svg, sx(1000) - 5, sy(massCeiling(1000, 30)) - 11, '427.5 kg', { 'text-anchor': 'end', class: 'chart-label chart-annotation' });
    if (!narrow) {
      label(svg, sx(200) + 10, sy(massCeiling(200, 30)) + 21, '85.5 kg', { class: 'chart-label chart-annotation' });
      label(svg, sx(200) + 10, sy(massCeiling(200, 2)) - 10, '5.7 kg', { class: 'chart-label chart-annotation' });
      label(svg, sx(1000) - 8, sy(massCeiling(1000, 2)) - 12, '28.5 kg', { 'text-anchor': 'end', class: 'chart-label chart-annotation' });
    }
    label(svg, (left + right) / 2, bottom + 46, 'Complete propulsion', { 'text-anchor': 'middle', class: 'chart-axis-label' });
    label(svg, (left + right) / 2, bottom + 64, 'electrical input (W)', { 'text-anchor': 'middle', class: 'chart-axis-label' });
    return { svg, audit };
  }

  function renderBreakEven(width) {
    const narrow = width < 440;
    const height = narrow ? 394 : 450;
    const bounds = { left: narrow ? 34 : 45, right: width - 15, top: 65, bottom: height - 78 };
    const { left, right, top, bottom } = bounds;
    const sx = extra => left + (extra + 0.25) / 8.5 * (right - left);
    const sy = difference => bottom - (difference + 5) / 11 * (bottom - top);
    const audit = {
      source: 'series_04_mass_break_even_figure.py',
      delta_v_m_s: CHEMICAL_DV,
      hydrazine_retained_mass_kg: MONO_RETAINED,
      hydrazine_isp_s: MONO_ISP,
      bipropellant_isp_s: BI_ISP,
      break_even_extra_retained_kg: breakEven,
      equal_initial_mass_kg: initialMono,
      initial_mass_difference_at_0_kg: initialDifference(0),
      initial_mass_difference_at_8_kg: initialDifference(8),
      plotted_extra_retained_mass_range_kg: [0, 8],
      interpretation: 'Retained mass includes dry hardware and retained consumables. Illustrative, not a sized installation or Aeterna result.'
    };
    const svg = canvas('mass-break-even', width, height,
      'When propellant savings offset added mass',
      'Illustrative mass comparison for the 500 to 1,000 km coplanar relocation, delta-v 262.3887989371143 m/s. '
      + 'The hydrazine reference retains 120 kg at 220 s specific impulse. The bipropellant reference has '
      + '290 s specific impulse and retains 120 kg plus the extra mass on the horizontal axis. The vertical axis '
      + 'is bipropellant initial mass minus hydrazine initial mass. Starting-mass difference is minus 3.92 kg '
      + 'at zero extra retained mass. It crosses zero at 3.5749787707456426 kg extra retained mass; both initial '
      + 'masses then equal 135.5188689370743 kg. Below the crossing the bipropellant spacecraft starts lighter; '
      + 'above it, heavier. The allowance includes equipment and retained consumables, not just dry hardware. '
      + 'This is not an equipment estimate, Aeterna performance result or comparison of remaining mission capability.', audit);

    label(svg, 0, 18, 'Starting-mass difference (kg)', { class: 'chart-axis-label' });
    label(svg, 0, 39, 'Bipropellant − hydrazine', { class: 'chart-label chart-secondary' });
    plotGrid(svg, bounds, sx, sy, [0, 2, 4, 6, 8], [-4, -2, 0, 2, 4, 6], String,
      y => y > 0 ? `+${y}` : String(y));
    line(svg, left, sy(0), right, sy(0), 'chart-zero', { 'data-zero-starting-mass-difference-kg': 0 });
    line(svg, sx(breakEven), sy(0), sx(breakEven), bottom, 'chart-guide');
    const points = [];
    for (let i = 0; i <= 160; i++) {
      const extra = i / 20;
      points.push(`${sx(extra)},${sy(initialDifference(extra))}`);
    }
    element(svg, 'path', { d: `M ${points.join(' L ')}`, class: 'chart-curve chart-long', 'data-point-count': points.length });
    element(svg, 'circle', {
      cx: sx(breakEven), cy: sy(0), r: 5.5, class: 'chart-marker chart-long',
      'data-break-even-kg': breakEven, 'data-starting-mass-difference-kg': initialDifference(breakEven)
    });
    element(svg, 'circle', { cx: sx(0), cy: sy(initialDifference(0)), r: 3.5, class: 'chart-marker chart-long' });

    const noteX = left + 8;
    const noteY = sy(0) - (narrow ? 76 : 85);
    label(svg, noteX, noteY, '3.57 kg added', { class: 'chart-label chart-emphasis' });
    label(svg, noteX, noteY + 19, 'Equal starting mass', { class: 'chart-label' });
    line(svg, noteX + 80, noteY + 28, sx(breakEven) - 4, sy(0) - 10, 'chart-leader');
    label(svg, right - 8, top + 20, narrow ? 'Starts heavier' : 'Bipropellant starts heavier', {
      'text-anchor': 'end', class: 'chart-label chart-annotation'
    });
    label(svg, left + 8, sy(-1), narrow ? 'Starts lighter' : 'Bipropellant starts lighter', { class: 'chart-label chart-annotation' });
    label(svg, sx(0) + 9, sy(initialDifference(0)) + 20, '−3.92 kg', { class: 'chart-label chart-annotation' });
    label(svg, (left + right) / 2, bottom + 46, 'Extra retained mass (kg)', { 'text-anchor': 'middle', class: 'chart-axis-label' });
    label(svg, (left + right) / 2, bottom + 65, 'Bipropellant − hydrazine', { 'text-anchor': 'middle', class: 'chart-label chart-secondary' });
    return { svg, audit };
  }

  function enhance(id, render) {
    const root = document.getElementById(id);
    if (!root || !checked) return;
    let lastWidth = 0;
    const redraw = () => {
      const width = Math.floor(root.getBoundingClientRect().width);
      if (width < 220 || width === lastWidth) return;
      try {
        const result = render(width);
        root.replaceChildren(result.svg);
        root.dataset.chartAudit = JSON.stringify(result.audit);
        root.dataset.modelChecks = 'passed';
        root.dataset.renderedWidth = width;
        root.dataset.chartReady = 'true';
        lastWidth = width;
      } catch (error) {
        // Do not remove the approved image if enhancement fails.
        root.dataset.chartError = 'Responsive rendering unavailable';
      }
    };
    redraw();
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(redraw);
      observer.observe(root);
    } else {
      window.addEventListener('resize', redraw, { passive: true });
    }
  }

  function init() {
    enhance('hall-power-mass-chart', renderHall);
    enhance('mass-break-even-chart', renderBreakEven);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
