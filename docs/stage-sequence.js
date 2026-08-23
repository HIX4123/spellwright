(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let relationships = null;
  let scheduled = false;
  const observed = new WeakSet();

  const numberStyle = (node, key) => Number.parseFloat(node.style[key]) || 0;
  const geometry = node => ({
    x: numberStyle(node, 'left'),
    y: numberStyle(node, 'top'),
    w: numberStyle(node, 'width') || node.offsetWidth || 148,
    h: numberStyle(node, 'height') || node.offsetHeight || 58
  });

  function stageGroups() {
    const groups = new Map();
    (relationships?.hierarchy || [])
      .filter(edge => edge.type === 'stage')
      .forEach(edge => {
        if (!groups.has(edge.parent)) groups.set(edge.parent, []);
        groups.get(edge.parent).push(edge);
      });
    groups.forEach(edges => edges.sort((a, b) => (a.order || 0) - (b.order || 0)));
    return groups;
  }

  function ensureMarker(svg) {
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(SVG_NS, 'defs');
      svg.prepend(defs);
    }
    if (defs.querySelector('#stageSequenceArrow')) return;
    const marker = document.createElementNS(SVG_NS, 'marker');
    marker.setAttribute('id', 'stageSequenceArrow');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('orient', 'auto');
    const arrow = document.createElementNS(SVG_NS, 'path');
    arrow.setAttribute('d', 'M0,1 L9,5 L0,9 Z');
    arrow.setAttribute('class', 'stage-sequence-arrow');
    marker.appendChild(arrow);
    defs.appendChild(marker);
  }

  function rerouteIncidentEdges(root, moved) {
    root.querySelectorAll('.compact-edge[data-from][data-to]:not(.stage-sequence)').forEach(path => {
      if (!moved.has(path.dataset.from) && !moved.has(path.dataset.to)) return;
      const from = root.querySelector(`.compact-node[data-id="${CSS.escape(path.dataset.from)}"]`);
      const to = root.querySelector(`.compact-node[data-id="${CSS.escape(path.dataset.to)}"]`);
      if (!from || !to) return;
      const a = geometry(from);
      const b = geometry(to);
      const sameRow = Math.abs(a.y - b.y) < 4;
      let d;
      if (sameRow) {
        const left = a.x <= b.x ? a : b;
        const right = a.x <= b.x ? b : a;
        const cy = left.y + left.h / 2;
        d = `M ${left.x + left.w} ${cy} H ${right.x}`;
      } else {
        const sourceAbove = a.y < b.y;
        const sx = a.x + a.w / 2;
        const sy = sourceAbove ? a.y + a.h : a.y;
        const ex = b.x + b.w / 2;
        const ey = sourceAbove ? b.y : b.y + b.h;
        d = `M ${sx} ${sy} L ${ex} ${ey}`;
      }
      path.setAttribute('d', d);
    });
  }

  function ensureSequencePath(svg, from, to) {
    const key = `${from}::${to}`;
    let path = svg.querySelector(`.stage-sequence[data-sequence="${CSS.escape(key)}"]`);
    if (!path) {
      path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('class', 'compact-edge stage-sequence');
      path.dataset.sequence = key;
      path.dataset.from = from;
      path.dataset.to = to;
      path.setAttribute('marker-end', 'url(#stageSequenceArrow)');
      svg.appendChild(path);
    }
    return path;
  }

  function alignGroup(root, parent, stages) {
    const nodes = stages
      .map(stage => ({ stage, node: root.querySelector(`.compact-node[data-id="${CSS.escape(stage.child)}"]`) }))
      .filter(item => item.node);
    if (nodes.length < 2) return;

    const ys = nodes.map(item => geometry(item.node).y).sort((a, b) => a - b);
    const targetY = ys[Math.floor(ys.length / 2)];
    const allNodes = [...root.querySelectorAll('.compact-node')];
    const row = allNodes
      .map(node => ({ node, g: geometry(node) }))
      .filter(item => Math.abs(item.g.y - targetY) < 6)
      .sort((a, b) => a.g.x - b.g.x);
    if (row.length < nodes.length) return;

    const stageIds = new Set(nodes.map(item => item.stage.child));
    const slots = row.map(item => item.g.x);
    const currentCenters = nodes.map(item => {
      const g = geometry(item.node);
      return g.x + g.w / 2;
    });

    let bestStart = 0;
    let bestCost = Infinity;
    for (let start = 0; start <= row.length - nodes.length; start += 1) {
      let cost = 0;
      for (let i = 0; i < nodes.length; i += 1) {
        const slotCenter = slots[start + i] + geometry(nodes[i].node).w / 2;
        cost += Math.abs(slotCenter - currentCenters[i]);
      }
      if (cost < bestCost) {
        bestCost = cost;
        bestStart = start;
      }
    }

    const remaining = row.filter(item => !stageIds.has(item.node.dataset.id));
    const orderedNodes = remaining.map(item => item.node);
    orderedNodes.splice(bestStart, 0, ...nodes.map(item => item.node));

    const moved = new Set();
    orderedNodes.forEach((node, index) => {
      const old = geometry(node);
      const nextX = slots[index];
      if (Math.abs(old.x - nextX) > .5 || (stageIds.has(node.dataset.id) && Math.abs(old.y - targetY) > .5)) moved.add(node.dataset.id);
      node.style.left = `${nextX}px`;
      if (stageIds.has(node.dataset.id)) node.style.top = `${targetY}px`;
    });

    rerouteIncidentEdges(root, moved);

    const svg = root.querySelector('.compact-lines');
    if (!svg) return;
    ensureMarker(svg);
    const sequence = (relationships?.sequence || [])
      .filter(edge => stageIds.has(edge.from) && stageIds.has(edge.to))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    sequence.forEach(edge => {
      const aNode = root.querySelector(`.compact-node[data-id="${CSS.escape(edge.from)}"]`);
      const bNode = root.querySelector(`.compact-node[data-id="${CSS.escape(edge.to)}"]`);
      if (!aNode || !bNode) return;
      const a = geometry(aNode);
      const b = geometry(bNode);
      const path = ensureSequencePath(svg, edge.from, edge.to);
      const y = targetY + a.h / 2;
      path.setAttribute('d', `M ${a.x + a.w} ${y} H ${b.x}`);
    });

    root.dataset.stageSequence = parent;
  }

  function patchRoot(root) {
    if (!relationships) return;
    stageGroups().forEach((stages, parent) => alignGroup(root, parent, stages));
  }

  function patchAll() {
    document.querySelectorAll('.compact-map-root').forEach(root => {
      patchRoot(root);
      const host = root.parentElement;
      if (host && !observed.has(host)) {
        observed.add(host);
        new ResizeObserver(schedule).observe(host);
      }
    });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scheduled = false;
      patchAll();
    }));
  }

  async function init() {
    try {
      const response = await fetch('./data/relationships.json', { cache: 'no-store' });
      relationships = await response.json();
    } catch {
      return;
    }
    const view = document.getElementById('view');
    if (view) new MutationObserver(schedule).observe(view, { childList: true, subtree: true });
    window.addEventListener('resize', schedule, { passive: true });
    schedule();
  }

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init);
  else init();
})();
