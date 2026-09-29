// Portable Article 5 figures. No host APIs or remote dependencies.
(() => {
      const root = document.getElementById('propulsion-architecture-map');
      if (!root) return;
      const svg = root.querySelector('.pam-map');
      const ns = 'http://www.w3.org/2000/svg';
      const modes = ['overview', 'shared', 'isolated'];
      const details = {
        overview: 'No firing shown; both branches share upstream functions and spacecraft interfaces.',
        shared: 'Concurrent demand acts on shared supply paths; delivered inlet conditions require assessment.',
        isolated: 'A loses both supplies; B remains connected. Remaining maneuver capability requires assessment.'
      };
      let mode = 'overview';
      let lastWidth = 0;
      function el(tag, attrs, parent = svg) {
        const node = document.createElementNS(ns, tag);
        for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, String(value));
        parent.appendChild(node);
        return node;
      }
      function label(text, x, y, { width = Infinity, small = false, weight = 400, anchor = 'middle' } = {}) {
        const node = el('text', { x, y, 'text-anchor': anchor, 'font-weight': weight, class: small ? 'text-small' : '' });
        let line = '';
        let span = el('tspan', { x, dy: 0 }, node);
        for (const word of text.split(' ')) {
          const proposed = line ? line + ' ' + word : word;
          span.textContent = proposed;
          if (line && span.getComputedTextLength() > width) {
            span.textContent = line;
            span = el('tspan', { x, dy: '1.35em' }, node);
            span.textContent = word;
            line = word;
          } else line = proposed;
        }
        return node;
      }
      function path(d, className, extra = {}) { return el('path', { d, class: className, ...extra }); }
      function dot(x, y, color) { el('circle', { cx: x, cy: y, r: 3, class: 'pam-junction', fill: `var(${color})` }); }
      function draw() {
        const width = Math.round(svg.getBoundingClientRect().width);
        if (width < 180) return;
        lastWidth = width;
        const narrow = width < 480;
        svg.querySelectorAll(':scope > :not(title):not(desc)').forEach(node => node.remove());
        const inset = 32;
        const gap = narrow ? 20 : 44;
        const boxWidth = (width - inset * 2 - gap) / 2;
        const centers = [inset + boxWidth / 2, width - inset - boxWidth / 2];
        const [a, b] = centers;
        const port = narrow ? 18 : 28;
        const top = narrow ? 166 : 132;
        const supplyHeight = narrow ? 211 : 168;
        const bottom = top + supplyHeight;
        const fuelY = bottom + 43;
        const oxY = bottom + 77;
        const gateY = bottom + 157;
        const groupY = gateY + 71;
        const groupH = narrow ? 94 : 78;
        const electricalY = groupY + groupH + 28;
        const thermalY = electricalY + 24;
        const h = thermalY + 28;
        svg.setAttribute('viewBox', `0 0 ${width} ${h}`);
        svg.setAttribute('height', h);
        const leftRail = 10;
        const rightRail = width - 10;
        const supplyTitle = top + 27;
        const states = mode === 'shared'
          ? ['Commanded firing', 'Commanded firing']
          : mode === 'isolated'
            ? ['Supply removed', 'Paths connected']
            : ['No firing shown', 'No firing shown'];

        // Common interfaces stay visible in every operating view. Junction dots
        // distinguish intentional connections from line crossings.
        centers.forEach((x, index) => {
          el('rect', { x: x - boxWidth / 2, y: 8, width: boxWidth, height: narrow ? 65 : 49, rx: 5, class: 'pam-node' });
          label(index === 0 ? 'Shared power / commands' : 'Spacecraft thermal interfaces', x, 28, { width: boxWidth - 14, small: true, weight: 500 });
        });
        const eY = narrow ? 94 : 77;
        const tY = eY + 22;
        path(`M ${a} ${narrow ? 73 : 57} V ${eY} H ${leftRail} V ${electricalY} H ${b - port}`, 'pam-electrical');
        path(`M ${a - port} ${eY} H ${b - port}`, 'pam-electrical');
        path(`M ${b} ${narrow ? 73 : 57} V ${tY} H ${rightRail} V ${thermalY} H ${a + port}`, 'pam-thermal');
        path(`M ${a + port} ${tY} H ${b + port}`, 'pam-thermal');
        centers.forEach(x => {
          path(`M ${x - port} ${eY} V ${top}`, 'pam-electrical');
          path(`M ${x + port} ${tY} V ${top}`, 'pam-thermal');
          path(`M ${x - port} ${electricalY} V ${groupY + groupH}`, 'pam-electrical');
          path(`M ${x + port} ${thermalY} V ${groupY + groupH}`, 'pam-thermal');
          [[x-port,eY],[x+port,tY],[x-port,electricalY],[x+port,thermalY]].forEach(([dx,dy]) => dot(dx,dy,'--muted-foreground'));
        });
        label('Supply functions · not a fixed device sequence', width / 2, top - (narrow ? 26 : 9), { small: true, width: width - 30 });
        centers.forEach((x, index) => {
          el('rect', { x: x - boxWidth / 2, y: top, width: boxWidth, height: supplyHeight, rx: 5, class: 'pam-node' });
          label(index === 0 ? (narrow ? 'Fuel' : 'Fuel supply') : (narrow ? 'Oxidizer' : 'Oxidizer supply'), x, supplyTitle, { width: boxWidth - 12, weight: 500 });
          ['Storage', 'Acquisition', 'Pressure management', 'State conditioning'].forEach((text, i) => {
            label(text, x, top + 57 + i * (narrow ? 41 : 29), { width: boxWidth - 12, small: true });
          });
        });

        // The fuel drop to B uses a crossing bridge over the oxidizer header.
        // Colored junction dots appear only on the matching header.
        path(`M ${a} ${bottom} V ${fuelY} M ${a-port} ${fuelY} H ${b-port}`, 'pam-fluid pam-fuel');
        path(`M ${b} ${bottom} V ${oxY} M ${a+port} ${oxY} H ${b+port}`, 'pam-fluid pam-oxidizer');
        dot(a, fuelY, '--viz-series-1');
        dot(b, oxY, '--viz-series-2');
        label('Shared distribution', width / 2, oxY + 29, { small: true, width: width - 50 });
        centers.forEach((x, index) => {
          const isolated = mode === 'isolated' && index === 0;
          const fx = x - port;
          const ox = x + port;
          const toGate = index === 1
            ? `M ${fx} ${fuelY} V ${oxY-9} Q ${fx+14} ${oxY} ${fx} ${oxY+9} V ${gateY-5}`
            : `M ${fx} ${fuelY} V ${gateY-5}`;
          path(toGate, 'pam-fluid pam-fuel');
          path(`M ${ox} ${oxY} V ${gateY-5}`, 'pam-fluid pam-oxidizer');
          dot(fx, fuelY, '--viz-series-1');
          dot(ox, oxY, '--viz-series-2');
          for (const [px, klass] of [[fx, 'pam-fuel'], [ox, 'pam-oxidizer']]) {
            if (isolated) {
              path(`M ${px-6} ${gateY-5} L ${px+6} ${gateY+5} M ${px+6} ${gateY-5} L ${px-6} ${gateY+5}`, 'pam-blocked');
              path(`M ${px} ${gateY+12} V ${groupY}`, `pam-fluid ${klass}`, { opacity: 0.35 });
            } else path(`M ${px} ${gateY-5} V ${groupY}`, `pam-fluid ${klass}`);
          }
          // This annotation is a paired functional boundary, not one valve
          // joining fuel and oxidizer or a prescribed valve count.
          el('rect', { x: x - boxWidth / 2, y: gateY + 16, width: boxWidth, height: 40, rx: 3, class: 'pam-node' });
          label(`Branch ${index === 0 ? 'A' : 'B'}`, x, gateY + 32, { small: true, weight: 500 });
          label(isolated ? 'Isolated' : (narrow ? 'Paths open' : 'Supply paths open'), x, gateY + 48, { small: true, width: boxWidth - 8 });
          el('rect', { x: x - boxWidth / 2, y: groupY, width: boxWidth, height: groupH, rx: 5, class: mode === 'shared' ? 'pam-node pam-active' : 'pam-node' });
          label(`Thruster group ${index === 0 ? 'A' : 'B'}`, x, groupY + 26, { width: boxWidth - 14, weight: 500 });
          label(states[index], x, groupY + (narrow ? 63 : 53), { small: true, width: boxWidth - 14 });
        });
        svg.querySelector('#pam-map-description').textContent =
          `Separate fuel and oxidizer supplies each provide storage, acquisition, pressure management and state conditioning functions. Both feed thruster groups A and B through shared distribution paths. Power and command connections and thermal coupling link both supply functions and thruster groups to spacecraft interfaces. ${details[mode]} Line widths do not represent flow quantities. Isolation is a functional boundary, not a valve-count prescription.`;
      }
      function update() {
        root.querySelectorAll('[data-pam-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.pamMode === mode)));
        root.querySelector('#pam-state-detail').textContent = details[mode];
        draw();
      }
      root.querySelectorAll('[data-pam-mode]').forEach(button => button.addEventListener('click', () => { mode = button.dataset.pamMode; update(); }));
      if ('ResizeObserver' in window) {
        new ResizeObserver(() => {
          if (Math.round(svg.getBoundingClientRect().width) !== lastWidth) draw();
        }).observe(svg);
      } else window.addEventListener('resize', draw);
      if (document.fonts) document.fonts.ready.then(draw);
      update();
    })();

(() => {
      const root = document.getElementById('propulsion-operating-timeline');
      if (!root) return;
      const svg = root.querySelector('.pot-chart');
      const ns = 'http://www.w3.org/2000/svg';
      let lastWidth = 0;
      function el(tag, attrs, parent = svg) {
        const node = document.createElementNS(ns, tag);
        for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, String(value));
        parent.appendChild(node);
        return node;
      }
      function line(d, klass = 'pot-rule') { return el('path', {d, class: klass}); }
      function text(value, x, y, width, options = {}) {
        const node = el('text', {x, y, 'text-anchor': options.anchor || 'middle', 'font-weight': options.bold ? 500 : 400, class: options.normal ? '' : 'text-small'});
        let span = el('tspan', {x, dy: 0}, node);
        let current = '';
        for (const word of value.split(' ')) {
          const next = current ? current + ' ' + word : word;
          span.textContent = next;
          if (current && span.getComputedTextLength() > width) {
            span.textContent = current;
            span = el('tspan', {x, dy: '1.4em'}, node);
            span.textContent = word;
            current = word;
          } else current = next;
        }
        const box = node.getBBox();
        return Math.max(y, box.y + box.height);
      }
      function draw() {
        const width = Math.round(svg.getBoundingClientRect().width);
        if (width < 180) return;
        lastWidth = width;
        svg.querySelectorAll(':scope > :not(title):not(desc)').forEach(node => node.remove());
        const small = width < 560;
        const margin = 8;
        const cell = (width - 2 * margin) / 5;
        const at = i => margin + i * cell;
        const center = i => at(i) + cell / 2;
        const defs = el('defs', {});
        const pattern = el('pattern', {id: 'pot-preparation-pattern', width: 7, height: 7, patternUnits: 'userSpaceOnUse'}, defs);
        el('path', {d: 'M -2 2 L 2 -2 M 0 7 L 7 0 M 5 9 L 9 5', class: 'pot-hatch', opacity: .3}, pattern);
        // This bracket keeps preparation within coast, rather than adding a
        // mandatory separate mission phase or an assumed delay.
        text('Coast / standby', (at(2)+at(4))/2, 13, cell*2-8, {bold: true});
        line(`M ${at(2)+3} 28 V 21 H ${at(4)-3} V 28`);
        const labels = small ? ['Burn', 'Off', 'Standby', 'Prepare*', 'Correct'] : ['Sustained firing', 'Shutdown', 'Standby', 'Prepare if needed', 'Later corrections'];
        let headingBottom = 0;
        labels.forEach((label, i) => headingBottom = Math.max(headingBottom, text(label, center(i), 48, cell-8, {bold: true})));
        let y = headingBottom + 37;
        function rowTitle(title) {
          const bottom = text(title, margin, y, width-2*margin, {anchor: 'start', normal: true, bold: true});
          y = bottom + 17;
        }
        rowTitle('Firing command — not calculated thrust');
        line(`M ${margin} ${y+7} H ${width-margin}`);
        el('rect', {x: at(0)+5, y, width: cell-10, height: 14, class: 'pot-command', 'data-pot-mark': 'sustained-command'});
        for (let i=0; i<3; i++) {
          el('rect', {x: at(4)+5+i*(cell-10)/3, y, width: (cell-10)/6, height: 14, class: 'pot-command', 'data-pot-mark': 'correction-command'});
        }
        y += 36;
        text('No firing commanded', (at(1)+at(4))/2, y, cell*3-12);
        y += 39;
        rowTitle('Thermal history — continues between firings');
        line(`M ${margin+3} ${y} H ${width-margin-3}`, 'pot-history');
        for (let i=1; i<5; i++) line(`M ${at(i)-4} ${y-3} L ${at(i)} ${y} L ${at(i)-4} ${y+3}`, 'pot-history');
        const heat = small
          ? ['Flow + heat', 'Heat can shift', 'Heat + thermal control', 'Set state*', 'Prior state matters']
          : ['Flow changes heat transfer', 'Heat redistribution may continue', 'Environment and thermal control', 'Establish operating conditions', 'Current state and prior operation'];
        let thermalBottom = y;
        heat.forEach((label, i) => thermalBottom = Math.max(thermalBottom, text(label, center(i), y+25, cell-8)));
        y = thermalBottom + 41;
        rowTitle('Standby option A · maintain readiness');
        el('rect', {x: at(2)+3, y, width: cell*2-6, height: 13, class: 'pot-ready', 'data-pot-mark': 'maintain-ready'});
        let aBottom = text(small ? 'Keep selected paths ready' : 'Keep selected paths within operating conditions', (at(2)+at(4))/2, y+33, cell*2-10);
        y = aBottom + 39;
        rowTitle('Standby option B · restore readiness');
        el('rect', {x: at(2)+3, y, width: cell-6, height: 13, class: 'pot-rest', 'data-pot-mark': 'survival-standby'});
        el('rect', {x: at(3)+3, y, width: cell-6, height: 13, fill: 'url(#pot-preparation-pattern)', 'data-pot-mark': 'conditional-preparation'});
        const b1 = text(small ? 'Storage / survival' : 'Storage and survival limits', center(2), y+33, cell-8);
        const b2 = text(small ? 'Restore if needed' : 'Restore operating conditions if needed', center(3), y+33, cell-8);
        y = Math.max(b1,b2) + 32;
        text(small ? '* Preparation only if needed' : 'Readiness strategies apply during coast; preparation is conditional.', margin, y, width-2*margin, {anchor:'start'});
        y = svg.lastElementChild.getBBox().y + svg.lastElementChild.getBBox().height + 13;
        svg.setAttribute('viewBox', `0 0 ${width} ${y}`);
        svg.setAttribute('height', y);
        root.querySelector('#pot-desc').textContent = 'A qualitative sequence of sustained firing, shutdown, coast and later corrections. Preparation, when needed, occurs within coast. Commanded-on marks and thermal evolution are shown on aligned lanes; command marks are not thrust, flow or durations. Both standby approaches are visible: maintain selected paths ready, or maintain storage and survival limits then restore operating conditions. No energy ranking, universal cooldown or temperature curve is implied. All stages remain visible without selection.';
      }
      if ('ResizeObserver' in window) {
        new ResizeObserver(() => { if (Math.round(svg.getBoundingClientRect().width) !== lastWidth) draw(); }).observe(svg);
      } else window.addEventListener('resize', draw);
      if (document.fonts) document.fonts.ready.then(draw);
      draw();
    })();
