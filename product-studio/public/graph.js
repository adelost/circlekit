const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}, text) => {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
};

/** Graph layout is view metadata only. Dragging never changes declaration order. */
export function drawGraph(host, { nodes, edges, key, selected, active, onSelect }) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('studio-layout:' + key) || '{}'); } catch { /* Unavailable/private storage is fine. */ }
  const shown = nodes.slice(0, 160), ids = new Set(shown.map(n => n.id));
  const links = edges.filter(e => ids.has(e.source) && ids.has(e.target)).slice(0, 600);
  const positions = new Map(shown.map((n, i) => [n.id, saved[n.id] ?? { x: 65 + (i % 3) * 280, y: 100 + Math.floor(i / 3) * 155 }]));
  const width = Math.max(920, Math.min(3, shown.length) * 280 + 100), height = Math.max(450, Math.ceil(shown.length / 3) * 155 + 120);
  const svg = el('svg', { class: 'graph-svg', viewBox: `0 0 ${width} ${height}`, role: 'group', 'aria-label': 'Interactive graph. Select nodes or use the explorer list.' });
  const defs = el('defs');
  const marker = el('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' });
  marker.append(el('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'currentColor' })); defs.append(marker); svg.append(defs);
  const viewport = el('g'), edgeLayer = el('g'), nodeLayer = el('g'); viewport.append(edgeLayer, nodeLayer); svg.append(viewport);
  const edgeElements = [];
  links.forEach((edge, i) => {
    const group = el('g', { class: `graph-edge ${edge.purpose || 'data'} ${edge.id === selected ? 'selected' : ''}`, tabindex: 0, role: 'button', 'aria-label': `${edge.label ?? edge.id}: ${edge.source} to ${edge.target}` });
    const path = el('path', { 'marker-end': 'url(#arrow)' });
    const label = el('text', { class: 'edge-label', 'text-anchor': 'middle' }, String(edge.label ?? '').slice(0, 40));
    group.append(path, label); edgeLayer.append(group); edgeElements.push({ edge, path, label, i });
    group.addEventListener('click', () => onSelect('edge', edge.id));
    group.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect('edge', edge.id); } });
  });
  const nodeElements = new Map();
  shown.forEach(n => {
    const pos = positions.get(n.id);
    const g = el('g', { class: `graph-node ${n.kind ?? 'service'} ${n.id === selected ? 'selected' : ''} ${n.id === active ? 'active' : ''}`, transform: `translate(${pos.x} ${pos.y})`, tabindex: 0, role: 'button', 'aria-label': `${n.label ?? n.id}, ${n.kind ?? 'node'}` });
    g.append(el('rect', { width: 215, height: 78, rx: 12 }));
    g.append(el('circle', { cx: 17, cy: 23, r: 4, class: 'node-dot' }));
    g.append(el('text', { x: 31, y: 29, class: 'node-title' }, String(n.label ?? n.id).slice(0, 24)));
    g.append(el('text', { x: 17, y: 54, class: 'node-subtitle' }, String(n.subtitle ?? n.kind ?? 'node').slice(0, 32)));
    g.append(el('circle', { cx: 0, cy: 39, r: 4, class: 'socket' }), el('circle', { cx: 215, cy: 39, r: 4, class: 'socket' }));
    nodeLayer.append(g); nodeElements.set(n.id, g);
    let drag;
    g.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.stopPropagation(); const p = localPoint(e); drag = { start: p, x: positions.get(n.id).x, y: positions.get(n.id).y, moved: false }; g.setPointerCapture(e.pointerId);
    });
    g.addEventListener('pointermove', e => {
      if (!drag) return; const p = localPoint(e); const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
      positions.set(n.id, { x: drag.x + dx, y: drag.y + dy }); redraw();
    });
    g.addEventListener('pointerup', () => {
      if (!drag) return; const moved = drag.moved; drag = null;
      if (moved) { try { localStorage.setItem('studio-layout:' + key, JSON.stringify(Object.fromEntries(positions))); } catch { /* Layout persistence is optional. */ } }
      else onSelect('node', n.id);
    });
    g.addEventListener('pointercancel', () => { drag = null; });
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect('node', n.id); } });
  });
  let transform = { x: 0, y: 0, scale: 1 }, pan;
  function localPoint(e) { return new DOMPoint(e.clientX, e.clientY).matrixTransform(viewport.getScreenCTM().inverse()); }
  function redraw() {
    for (const [id, g] of nodeElements) { const p = positions.get(id); g.setAttribute('transform', `translate(${p.x} ${p.y})`); }
    const parallel = new Map();
    for (const { edge, path, label } of edgeElements) {
      const a = positions.get(edge.source), b = positions.get(edge.target), k = edge.source + ':' + edge.target;
      const count = parallel.get(k) ?? 0; parallel.set(k, count + 1);
      let d, lx, ly;
      if (edge.source === edge.target) {
        d = `M ${a.x + 175} ${a.y} C ${a.x + 245} ${a.y - 65} ${a.x + 50} ${a.y - 65} ${a.x + 55} ${a.y}`;
        lx = a.x + 120; ly = a.y - 34 - count * 12;
      } else if (b.x > a.x) {
        const x1 = a.x + 215, x2 = b.x, y1 = a.y + 39, y2 = b.y + 39, offset = count * 30;
        d = `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1 - offset} ${(x1 + x2) / 2} ${y2 - offset} ${x2} ${y2}`;
        lx = (x1 + x2) / 2; ly = (y1 + y2) / 2 - 10 - offset * .5;
      } else {
        const top = Math.min(a.y, b.y) - 35 - count * 24;
        d = `M ${a.x + 108} ${a.y} C ${a.x + 108} ${top - 40} ${b.x + 108} ${top - 40} ${b.x + 108} ${b.y}`;
        lx = (a.x + b.x) / 2 + 108; ly = top - 18;
      }
      path.setAttribute('d', d); label.setAttribute('x', lx); label.setAttribute('y', ly);
    }
  }
  function apply() { viewport.setAttribute('transform', `translate(${transform.x} ${transform.y}) scale(${transform.scale})`); }
  svg.addEventListener('wheel', e => { e.preventDefault(); transform.scale = Math.max(.25, Math.min(3, transform.scale * (e.deltaY < 0 ? 1.1 : .9))); apply(); }, { passive: false });
  svg.addEventListener('pointerdown', e => { if (e.target === svg && e.button === 0) { pan = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y }; svg.setPointerCapture(e.pointerId); } });
  svg.addEventListener('pointermove', e => { if (pan) { const r = svg.getBoundingClientRect(); transform.x = pan.tx + (e.clientX - pan.x) * width / r.width; transform.y = pan.ty + (e.clientY - pan.y) * height / r.height; apply(); } });
  svg.addEventListener('pointerup', () => { pan = null; });
  host.replaceChildren(svg); redraw();
  return { reset: () => { transform = { x: 0, y: 0, scale: 1 }; apply(); }, zoom: by => { transform.scale = Math.max(.25, Math.min(3, transform.scale * by)); apply(); }, shown: shown.length, total: nodes.length };
}
