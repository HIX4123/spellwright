const CATEGORY_ORDER = ['magic', 'attribute', 'combat', 'character', 'roguelite'];
const CATEGORY_LABEL = {
  attribute: 'Attribute',
  magic: 'Magic',
  character: 'Character',
  combat: 'Combat',
  roguelite: 'Roguelite'
};

let projectData = null;

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function visibleSystemsFromLegacy(legacyScroll) {
  const ids = [...legacyScroll.querySelectorAll('.map-node')].map(node => node.dataset.id);
  const byId = new Map(projectData.systems.map(system => [system.id, system]));
  return ids.map(id => {
    const source = byId.get(id);
    const legacyNode = legacyScroll.querySelector(`.map-node[data-id="${CSS.escape(id)}"]`);
    if (!source || !legacyNode) return null;
    return {
      ...source,
      name: legacyNode.querySelector('strong')?.textContent || source.name,
      definition: legacyNode.querySelector('.map-node-preview')?.textContent || source.definition,
      statusText: legacyNode.querySelector('.map-node-meta')?.textContent || ''
    };
  }).filter(Boolean);
}

function buildEdges(systems) {
  const ids = new Set(systems.map(system => system.id));
  const edges = [];
  const seen = new Set();
  const add = (from, to) => {
    if (!ids.has(from) || !ids.has(to)) return;
    const key = `${from}::${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to });
  };

  systems.forEach(system => {
    (system.dependencies || []).forEach(dependency => add(dependency, system.id));
  });

  // Interim semantic hierarchy until the project-wide parent/child model is redefined.
  // Projection is an engraving subtype while still being constrained by the five attributes.
  add('engraving', 'projection-system');
  add('five-elements', 'projection-system');

  return edges;
}

function rankGraph(systems, edges) {
  const ids = systems.map(system => system.id);
  const indegree = new Map(ids.map(id => [id, 0]));
  const children = new Map(ids.map(id => [id, []]));
  const rank = new Map(ids.map(id => [id, 0]));
  const sourceOrder = new Map(ids.map((id, index) => [id, index]));

  edges.forEach(edge => {
    indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1);
    children.get(edge.from)?.push(edge.to);
  });

  const queue = ids.filter(id => indegree.get(id) === 0)
    .sort((a, b) => sourceOrder.get(a) - sourceOrder.get(b));
  const processed = new Set();

  while (queue.length) {
    const id = queue.shift();
    processed.add(id);
    (children.get(id) || []).forEach(child => {
      rank.set(child, Math.max(rank.get(child) || 0, (rank.get(id) || 0) + 1));
      indegree.set(child, indegree.get(child) - 1);
      if (indegree.get(child) === 0) {
        queue.push(child);
        queue.sort((a, b) => sourceOrder.get(a) - sourceOrder.get(b));
      }
    });
  }

  const cyclic = new Set(ids.filter(id => !processed.has(id)));
  if (cyclic.size) {
    const last = Math.max(0, ...rank.values()) + 1;
    cyclic.forEach(id => rank.set(id, last));
  }

  // A projection is visually subordinate to engraving even while the current dependency
  // graph still contains cycles that will be cleaned up in the next design pass.
  if (rank.has('projection-system')) {
    const parentDepth = Math.max(rank.get('engraving') || 0, rank.get('five-elements') || 0);
    rank.set('projection-system', parentDepth + 1);
    cyclic.delete('projection-system');
  }
  if (rank.has('projection-abilities')) {
    const parentDepth = Math.max(rank.get('projection-system') || 0, rank.get('karma') || 0);
    rank.set('projection-abilities', parentDepth + 1);
  }

  // Compress raw DAG ranks so an unused depth never renders as a blank horizontal tier.
  const usedDepths = [...new Set(ids.map(id => rank.get(id) || 0))].sort((a, b) => a - b);
  const depthMap = new Map(usedDepths.map((depth, index) => [depth, index]));
  ids.forEach(id => rank.set(id, depthMap.get(rank.get(id) || 0) || 0));

  return { rank, cyclic };
}

function distribute(index, total, size) {
  if (total <= 1) return 0;
  const span = Math.min(size - 30, (total - 1) * 11);
  return -span / 2 + span * index / (total - 1);
}

function makeLayout(systems, edges) {
  const nodeW = 166;
  const nodeH = 54;
  const lanePad = 9;
  const laneGap = 8;
  const stackGap = 7;
  const rowPad = 10;
  const rowGap = 14;
  const headerH = 32;
  const margin = 10;
  const categories = CATEGORY_ORDER.filter(category => systems.some(system => system.category === category));
  const laneW = nodeW + lanePad * 2;
  const { rank, cyclic } = rankGraph(systems, edges);
  const maxRank = Math.max(0, ...systems.map(system => rank.get(system.id) || 0));
  const laneX = new Map(categories.map((category, index) => [category, margin + index * (laneW + laneGap)]));
  const groups = new Map();

  for (let depth = 0; depth <= maxRank; depth += 1) {
    categories.forEach(category => {
      groups.set(`${depth}:${category}`, systems.filter(system =>
        (rank.get(system.id) || 0) === depth && system.category === category
      ));
    });
  }

  const rowH = new Map();
  const rowY = new Map();
  let cursorY = margin + headerH;
  for (let depth = 0; depth <= maxRank; depth += 1) {
    const stack = Math.max(1, ...categories.map(category => groups.get(`${depth}:${category}`)?.length || 0));
    const height = rowPad * 2 + stack * nodeH + Math.max(0, stack - 1) * stackGap;
    rowH.set(depth, height);
    rowY.set(depth, cursorY);
    cursorY += height + (depth < maxRank ? rowGap : 0);
  }

  const nodes = new Map();
  for (let depth = 0; depth <= maxRank; depth += 1) {
    categories.forEach(category => {
      const items = groups.get(`${depth}:${category}`) || [];
      const blockH = items.length * nodeH + Math.max(0, items.length - 1) * stackGap;
      const startY = rowY.get(depth) + Math.max(rowPad, (rowH.get(depth) - blockH) / 2);
      items.forEach((system, index) => {
        nodes.set(system.id, {
          x: laneX.get(category) + lanePad,
          y: startY + index * (nodeH + stackGap),
          w: nodeW,
          h: nodeH,
          depth,
          category
        });
      });
    });
  }

  const backEdges = edges.filter(edge => (rank.get(edge.to) || 0) <= (rank.get(edge.from) || 0));
  const baseWidth = margin * 2 + categories.length * laneW + Math.max(0, categories.length - 1) * laneGap;
  return {
    width: Math.max(580, baseWidth + (backEdges.length ? 34 + backEdges.length * 7 : 0)),
    height: Math.max(280, cursorY + margin),
    nodes, categories, rank, cyclic, maxRank, laneW, laneX, rowY, rowH,
    nodeW, nodeH, routeX: baseWidth + 10
  };
}

function portOffsets(edges, layout) {
  const outgoing = new Map();
  const incoming = new Map();
  const key = edge => `${edge.from}::${edge.to}`;
  edges.forEach(edge => {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    if (!incoming.has(edge.to)) incoming.set(edge.to, []);
    outgoing.get(edge.from).push(edge);
    incoming.get(edge.to).push(edge);
  });
  const out = new Map();
  const input = new Map();
  outgoing.forEach(list => {
    list.sort((a, b) => (layout.nodes.get(a.to)?.x || 0) - (layout.nodes.get(b.to)?.x || 0));
    list.forEach((edge, index) => out.set(key(edge), distribute(index, list.length, layout.nodeW)));
  });
  incoming.forEach(list => {
    list.sort((a, b) => (layout.nodes.get(a.from)?.x || 0) - (layout.nodes.get(b.from)?.x || 0));
    list.forEach((edge, index) => input.set(key(edge), distribute(index, list.length, layout.nodeW)));
  });
  return { out, input };
}

function renderCompactMap(host, legacyScroll) {
  if (!projectData || host.querySelector(':scope > .compact-map-root')) return;
  const systems = visibleSystemsFromLegacy(legacyScroll);
  if (!systems.length) return;

  const edges = buildEdges(systems);
  const layout = makeLayout(systems, edges);
  const offsets = portOffsets(edges, layout);
  const key = edge => `${edge.from}::${edge.to}`;
  let backIndex = 0;

  const laneHtml = layout.categories.map(category => {
    const x = layout.laneX.get(category);
    return `<div class="compact-lane" style="left:${x}px;width:${layout.laneW}px;height:${layout.height}px">
      <span>${CATEGORY_LABEL[category] || category}</span>
    </div>`;
  }).join('');

  const rowHtml = Array.from({length: layout.maxRank + 1}, (_, depth) =>
    `<div class="compact-row" style="top:${layout.rowY.get(depth)}px;height:${layout.rowH.get(depth)}px"></div>`
  ).join('');

  const edgeHtml = edges.map(edge => {
    const a = layout.nodes.get(edge.from);
    const b = layout.nodes.get(edge.to);
    if (!a || !b) return '';
    const edgeId = key(edge);
    const sx = a.x + a.w / 2 + (offsets.out.get(edgeId) || 0);
    const sy = a.y + a.h;
    const ex = b.x + b.w / 2 + (offsets.input.get(edgeId) || 0);
    const ey = b.y;
    const forward = b.depth > a.depth;
    let path;
    let className = 'compact-edge';
    if (forward) {
      if (Math.abs(sx - ex) < 2) {
        path = `M ${sx} ${sy} V ${ey}`;
      } else {
        const midY = Math.round((sy + ey) / 2);
        path = `M ${sx} ${sy} V ${midY} H ${ex} V ${ey}`;
      }
    } else {
      const gx = layout.routeX + backIndex * 7;
      backIndex += 1;
      path = `M ${sx} ${sy} V ${sy + 10} H ${gx} V ${Math.max(16, ey - 10)} H ${ex} V ${ey}`;
      className += ' back';
    }
    return `<path class="${className}" data-from="${edge.from}" data-to="${edge.to}" d="${path}" marker-end="url(#compactArrow)" />`;
  }).join('');

  const nodeHtml = systems.map(system => {
    const p = layout.nodes.get(system.id);
    const cycle = layout.cyclic.has(system.id) ? ' cycle' : '';
    return `<button class="compact-node${cycle}" data-id="${system.id}" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px">
      <span>${escapeHtml(system.statusText)}</span>
      <strong>${escapeHtml(system.name)}</strong>
      <small>${escapeHtml(system.definition || '')}</small>
    </button>`;
  }).join('');

  const root = document.createElement('div');
  root.className = 'compact-map-root';
  root.innerHTML = `<div class="compact-map-scroll">
    <div class="compact-map" style="width:${layout.width}px;height:${layout.height}px">
      ${laneHtml}${rowHtml}
      <svg class="compact-lines" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">
        <defs><marker id="compactArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 Z" class="compact-arrow" /></marker></defs>
        ${edgeHtml}
      </svg>
      ${nodeHtml}
    </div>
  </div>`;

  const legacyHolder = document.createElement('div');
  legacyHolder.className = 'compact-legacy';
  legacyScroll.replaceWith(legacyHolder);
  legacyHolder.appendChild(legacyScroll);
  host.prepend(root);

  const nodes = [...root.querySelectorAll('.compact-node')];
  const edgeEls = [...root.querySelectorAll('.compact-edge')];
  const clear = () => {
    nodes.forEach(node => node.classList.remove('focus', 'dim'));
    edgeEls.forEach(edge => edge.classList.remove('focus', 'dim'));
  };
  const focus = id => {
    const related = new Set([id]);
    edges.forEach(edge => {
      if (edge.from === id) related.add(edge.to);
      if (edge.to === id) related.add(edge.from);
    });
    nodes.forEach(node => {
      node.classList.toggle('focus', related.has(node.dataset.id));
      node.classList.toggle('dim', !related.has(node.dataset.id));
    });
    edgeEls.forEach(edge => {
      const direct = edge.dataset.from === id || edge.dataset.to === id;
      edge.classList.toggle('focus', direct);
      edge.classList.toggle('dim', !direct);
    });
  };

  nodes.forEach(node => {
    node.addEventListener('mouseenter', () => focus(node.dataset.id));
    node.addEventListener('mouseleave', clear);
    node.addEventListener('focus', () => focus(node.dataset.id));
    node.addEventListener('blur', clear);
    node.addEventListener('click', () => {
      legacyHolder.querySelector(`.map-node[data-id="${CSS.escape(node.dataset.id)}"]`)?.click();
    });
  });
}

function mountMaps() {
  ['systemMap', 'combatMap'].forEach(id => {
    const host = document.getElementById(id);
    if (!host || host.querySelector(':scope > .compact-map-root')) return;
    const legacyScroll = host.querySelector(':scope > .system-map-scroll');
    if (legacyScroll) renderCompactMap(host, legacyScroll);
  });
}

async function initCompactLayout() {
  try {
    const response = await fetch('./data/project.json', { cache: 'no-store' });
    projectData = await response.json();
  } catch {
    return;
  }

  const observer = new MutationObserver(() => requestAnimationFrame(mountMaps));
  observer.observe(document.getElementById('view'), { childList: true, subtree: true });
  mountMaps();
}

window.addEventListener('DOMContentLoaded', initCompactLayout);
