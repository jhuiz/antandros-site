/* Original calculated two-body orbits: independent ideal impulses, not a sequence. */
(() => {
  'use strict';
  const root = document.getElementById('apsis-burn-figure');
  if (!root) return;
  const original = { rp: 1, ra: 2, a: 1.5, e: 1/3 };
  const dv = .05;
  function afterBurn(atPerigee) {
    const radius = atPerigee ? original.rp : original.ra;
    const beforeSpeed = Math.sqrt(2/radius - 1/original.a);
    const speed = beforeSpeed + dv;
    const a = 1/(2/radius - speed*speed);
    const otherRadius = 2*a-radius;
    const rp = atPerigee ? radius : otherRadius;
    const ra = atPerigee ? otherRadius : radius;
    return { rp, ra, a, e:(ra-rp)/(ra+rp), radius, beforeSpeed, speed };
  }
  const cases = [
    { id:'perigee', atPerigee:true, ...afterBurn(true) },
    { id:'apogee', atPerigee:false, ...afterBurn(false) }
  ];
  const maxLeft = Math.max(original.ra, ...cases.map(c=>c.ra));
  const maxRight = Math.max(original.rp, ...cases.map(c=>c.rp));
  const maxB = Math.max(...[original,...cases].map(c=>c.a*Math.sqrt(1-c.e*c.e)));
  root.innerHTML = `
    <h3 class="apsis-heading">Same speed increase, different firing point</h3>
    <ul class="apsis-legend" aria-label="Orbit comparison legend">
      <li><span class="apsis-swatch apsis-swatch-before" aria-hidden="true"></span>Original orbit</li>
      <li><span class="apsis-swatch" aria-hidden="true"></span>After the impulse</li>
      <li><span class="apsis-legend-arrow" aria-hidden="true">↑</span>Δv along motion</li>
    </ul>
    <div class="apsis-panels">
      <section class="apsis-panel" aria-labelledby="apsis-perigee-heading">
        <h4 id="apsis-perigee-heading">Increase speed at perigee</h4>
        <p class="apsis-result-note">Apogee moves farther from Earth.</p>
        <svg class="apsis-svg" id="apsis-perigee-svg" role="img" aria-labelledby="apsis-perigee-title apsis-perigee-desc">
          <title id="apsis-perigee-title">A prograde impulse at perigee raises apogee</title>
          <desc id="apsis-perigee-desc">Perigee is the nearest point to Earth and apogee the farthest. The original dashed ellipse and new solid ellipse meet at the right-hand perigee. The upward arrow there shows the forward velocity change. The new apogee lies farther left, farther from Earth, while the burn-point radius is unchanged.</desc>
          <g></g>
        </svg>
      </section>
      <section class="apsis-panel" aria-labelledby="apsis-apogee-heading">
        <h4 id="apsis-apogee-heading">Increase speed at apogee</h4>
        <p class="apsis-result-note">Perigee moves farther from Earth.</p>
        <svg class="apsis-svg" id="apsis-apogee-svg" role="img" aria-labelledby="apsis-apogee-title apsis-apogee-desc">
          <title id="apsis-apogee-title">A prograde impulse at apogee raises perigee</title>
          <desc id="apsis-apogee-desc">The same initial ellipse is used as an independent alternative. The downward arrow at the left-hand apogee shows the same forward velocity change for counterclockwise motion. The new perigee lies farther right, farther from Earth. Apogee remains fixed because this impulse is below circularization speed.</desc>
          <g></g>
        </svg>
      </section>
    </div>
    <p class="apsis-scale-note">Independent alternatives · common distance scale · counterclockwise motion · Earth not to scale</p>
  `;
  const ns = 'http://www.w3.org/2000/svg';
  function draw(c) {
    const svg = root.querySelector('#apsis-' + c.id + '-svg');
    const width = svg.parentElement.getBoundingClientRect().width;
    if (width <= 0) return;
    const scale = Math.max(1, (width-96)/(maxLeft+maxRight));
    const height = Math.max(300, 2*maxB*scale+128);
    const cx = 48+maxLeft*scale, cy = height/2;
    const topLabel = cy-maxB*scale-30;
    const bottomLabel = cy+maxB*scale+30;
    const X = x=>cx+x*scale, Y = y=>cy-y*scale;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    svg.setAttribute('height',height);
    Object.assign(svg.dataset,{case:c.id,rp:c.rp,ra:c.ra,a:c.a,e:c.e,burnRadius:c.radius,beforeSpeed:c.beforeSpeed,afterSpeed:c.speed,deltaV:dv,scale,cx,cy});
    const g=svg.querySelector('g');
    g.replaceChildren();
    function make(tag, attrs={}, text) {
      const node=document.createElementNS(ns,tag);
      for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
      if(text!==undefined)node.textContent=text;
      g.appendChild(node); return node;
    }
    function label(x,y,text,anchor='start') { return make('text',{x,y,'text-anchor':anchor},text); }
    function leader(x,y,tx,ty) {
      make('path',{d:`M${x},${y}L${tx},${ty}`,class:'apsis-leader'});
    }
    function orbit(elements,which) {
      const b=elements.a*Math.sqrt(1-elements.e*elements.e);
      let d='';
      for(let j=0;j<=360;j++) {
        const E=2*Math.PI*j/360;
        d+=(j?'L':'M')+X(elements.a*(Math.cos(E)-elements.e)).toFixed(3)+','+Y(b*Math.sin(E)).toFixed(3);
      }
      make('path',{d:d+'Z',class:'apsis-orbit apsis-'+which,'data-orbit':which});
    }
    orbit(c,'after');
    orbit(original,'before');
    make('circle',{cx,cy,r:10,class:'apsis-earth','data-earth':''});
    make('circle',{cx,cy,r:2,fill:'var(--apsis-ink)'});
    label(cx,cy+26,'Earth','middle');

    const burnX=X(c.atPerigee?original.rp:-original.ra);
    const direction=c.atPerigee?-1:1;
    const tipY=cy+direction*43;
    make('path',{d:`M${burnX},${cy}L${burnX},${tipY}M${burnX-4},${tipY-direction*7}L${burnX},${tipY}L${burnX+4},${tipY-direction*7}`,fill:'none',stroke:'var(--apsis-impulse)','stroke-width':2.5,'data-impulse':c.id,'data-dvx':0,'data-dvy':c.atPerigee?dv:-dv});
    make('path',{d:`M${burnX},${cy-5}L${burnX+5},${cy}L${burnX},${cy+5}L${burnX-5},${cy}Z`,fill:'var(--apsis-impulse)','data-burn-point':''});
    label(burnX+(c.atPerigee?9:-9),cy+direction*25,'Δv',c.atPerigee?'start':'end');

    const oldX=X(c.atPerigee?-original.ra:original.rp);
    const newX=X(c.atPerigee?-c.ra:c.rp);
    make('circle',{cx:oldX,cy,r:3.5,fill:'var(--apsis-paper)',stroke:'var(--apsis-original)','stroke-width':1.5,'data-old-opposite':''});
    make('circle',{cx:newX,cy,r:4,fill:'var(--apsis-result)','data-new-opposite':''});
    if(c.atPerigee) {
      label(8,topLabel,'Raised apogee');
      leader(28,topLabel+12,newX-3,cy-5);
      label(8,bottomLabel,'Original apogee');
      leader(90,bottomLabel-16,oldX+3,cy+5);
      label(width-8,bottomLabel,'Perigee','end');
      label(width-8,bottomLabel+20,'unchanged','end');
      leader(width-48,bottomLabel-16,burnX,cy+8);
    } else {
      label(width-8,topLabel,'Raised perigee','end');
      leader(width-28,topLabel+12,newX+3,cy-5);
      label(width-8,bottomLabel,'Original perigee','end');
      leader(width-90,bottomLabel-16,oldX-3,cy+5);
      label(8,topLabel,'Apogee');
      label(8,topLabel+20,'unchanged');
      leader(48,topLabel+32,burnX-3,cy-6);
    }
  }
  function redraw() {cases.forEach(draw);}
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(redraw).observe(root);
  else window.addEventListener('resize',redraw);
  redraw();
})();
