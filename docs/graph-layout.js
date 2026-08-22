const CATEGORY_ORDER = ['magic', 'attribute', 'combat', 'character', 'roguelite'];
const CATEGORY_LABEL = {
  magic: 'Magic',
  attribute: 'Attribute',
  combat: 'Combat',
  character: 'Character',
  roguelite: 'Roguelite'
};

let projectData = null;
let relationshipData = { hierarchy: [], hiddenSystems: [], suppressedDependencies: [] };

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function visibleSystemsFromLegacy(legacyScroll) {
  const hidden = new Set(relationshipData.hiddenSystems || []);
  const byId = new Map(projectData.systems.map(system => [system.id, system]));
  return [...legacyScroll.querySelectorAll('.map-node')]
    .map(node => {
      const id = node.dataset.id;
      if (hidden.has(id)) return null;
      const source = byId.get(id);
      if (!source) return null;
      return {
        ...source,
        name: node.querySelector('strong')?.textContent || source.name,
        definition: node.querySelector('.map-node-preview')?.textContent || source.definition,
        statusText: node.querySelector('.map-node-meta')?.textContent || ''
      };
    })
    .filter(Boolean);
}

function buildEdges(systems) {
  const ids = new Set(systems.map(system => system.id));
  const hierarchy = (relationshipData.hierarchy || [])
    .filter(edge => ids.has(edge.parent) && ids.has(edge.child))
    .map(edge => ({ from: edge.parent, to: edge.child, type: 'hierarchy' }));

  const hierarchyKeys = new Set(hierarchy.map(edge => `${edge.from}::${edge.to}`));
  const suppressed = new Set((relationshipData.suppressedDependencies || []).map(edge => `${edge.from}::${edge.to}`));
  const dependency = [];
  const seen = new Set();

  systems.forEach(system => {
    (system.dependencies || []).forEach(parent => {
      const key = `${parent}::${system.id}`;
      if (!ids.has(parent) || hierarchyKeys.has(key) || suppressed.has(key) || seen.has(key)) return;
      seen.add(key);
      dependency.push({ from: parent, to: system.id, type: 'dependency' });
    });
  });

  return { hierarchy, dependency, all: [...hierarchy, ...dependency] };
}

function hierarchyDepth(systems, edges) {
  const ids = systems.map(system => system.id);
  const depth = new Map(ids.map(id => [id, 0]));
  const indegree = new Map(ids.map(id => [id, 0]));
  const children = new Map(ids.map(id => [id, []]));

  edges.forEach(edge => {
    indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1);
    children.get(edge.from)?.push(edge.to);
  });

  const queue = ids.filter(id => indegree.get(id) === 0);
  while (queue.length) {
    const id = queue.shift();
    for (const child of children.get(id) || []) {
      depth.set(child, Math.max(depth.get(child) || 0, (depth.get(id) || 0) + 1));
      indegree.set(child, indegree.get(child) - 1);
      if (indegree.get(child) === 0) queue.push(child);
    }
  }

  return depth;
}

function layoutSystems(systems, hierarchy) {
  const nodeW = 170;
  const nodeH = 58;
  const lanePad = 9;
  const laneGap = 14;
  const rowGap = 30;
  const stackGap = 8;
  const marginX = 12;
  const marginY = 42;
  const categories = CATEGORY_ORDER.filter(category => systems.some(system => system.category === category));
  const laneW = nodeW + lanePad * 2;
  const laneX = new Map(categories.map((category, index) => [category, marginX + index * (laneW + laneGap)]));
  const depth = hierarchyDepth(systems, hierarchy);
  const maxDepth = Math.max(0, ...systems.map(system => depth.get(system.id) || 0));

  const groups = new Map();
  for (let level = 0; level <= maxDepth; level += 1) {
    for (const category of categories) {
      groups.set(`${level}:${category}`, systems.filter(system => system.category === category && (depth.get(system.id) || 0) === level));
    }
  }

  const rowHeights = [];
  for (let level = 0; level <= maxDepth; level += 1) {
    const maxStack = Math.max(1, ...categories.map(category => groups.get(`${level}:${category}`).length));
    rowHeights[level] = maxStack * nodeH + Math.max(0, maxStack - 1) * stackGap + 20;
  }

  const rowY = [];
  let y = marginY;
  for (let level = 0; level <= maxDepth; level += 1) {
    rowY[level] = y;
    y += rowHeights[level] + (level < maxDepth ? rowGap : 0);
  }

  const nodes = new Map();
  for (let level = 0; level <= maxDepth; level += 1) {
    for (const category of categories) {
      const items = groups.get(`${level}:${category}`);
      const blockH = items.length * nodeH + Math.max(0, items.length - 1) * stackGap;
      const startY = rowY[level] + (rowHeights[level] - blockH) / 2;
      items.forEach((system, index) => {
        nodes.set(system.id, {
          x: laneX.get(category) + lanePad,
          y: startY + index * (nodeH + stackGap),
          w: nodeW,
          h: nodeH,
          depth: level,
          category
        });
      });
    }
  }

  return {
    nodes,
    categories,
    laneX,
    laneW,
    nodeW,
    nodeH,
    width: Math.max(600, marginX * 2 + categories.length * laneW + Math.max(0, categories.length - 1) * laneGap),
    height: Math.max(250, y + 10)
  };
}

function hierarchyPath(edge, layout) {
  const a = layout.nodes.get(edge.from);
  const b = layout.nodes.get(edge.to);
  if (!a || !b) return '';
  const sx = a.x + a.w / 2;
  const sy = a.y + a.h;
  const ex = b.x + b.w / 2;
  const ey = b.y;
  const midY = Math.round((sy + ey) / 2);
  const d = Math.abs(sx - ex) < 2
    ? `M ${sx} ${sy} V ${ey}`
    : `M ${sx} ${sy} V ${midY} H ${ex} V ${ey}`;
  return `<path class="compact-edge hierarchy" data-from="${edge.from}" data-to="${edge.to}" d="${d}" marker-end="url(#hierarchyArrow)" />`;
}

function dependencyPath(edge, layout, index) {
  const a = layout.nodes.get(edge.from);
  const b = layout.nodes.get(edge.to);
  if (!a || !b) return '';
  const right = (b.x + b.w / 2) >= (a.x + a.w / 2);
  const sx = right ? a.x + a.w : a.x;
  const sy = a.y + a.h / 2;
  const ex = right ? b.x : b.x + b.w;
  const ey = b.y + b.h / 2;
  const midX = Math.round((sx + ex) / 2) + (a.category === b.category ? 12 + index * 3 : 0);
  const d = `M ${sx} ${sy} H ${midX} V ${ey} H ${ex}`;
  return `<path class="compact-edge dependency" data-from="${edge.from}" data-to="${edge.to}" d="${d}" marker-end="url(#dependencyArrow)" />`;
}

function renderCompactMap(host, legacyScroll) {
  if (!projectData || host.querySelector(':scope > .compact-map-root')) return;
  const systems = visibleSystemsFromLegacy(legacyScroll);
  if (!systems.length) return;

  const edges = buildEdges(systems);
  const layout = layoutSystems(systems, edges.hierarchy);
  const byId = new Map(systems.map(system => [system.id, system]));
  const parentByChild = new Map(edges.hierarchy.map(edge => [edge.to, edge.from]));

  const lanes = layout.categories.map(category => {
    const x = layout.laneX.get(category);
    return `<div class="compact-lane" style="left:${x}px;width:${layout.laneW}px;height:${layout.height}px"><span>${CATEGORY_LABEL[category] || category}</span></div>`;
  }).join('');

  const nodeHtml = systems.map(system => {
    const p = layout.nodes.get(system.id);
    const parent = byId.get(parentByChild.get(system.id));
    return `<button class="compact-node${parent ? ' has-parent' : ''}" data-id="${system.id}" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px">
      <span class="compact-node-kicker"><span>${esc(system.statusText)}</span>${parent ? `<em>↳ ${esc(parent.name)}</em>` : ''}</span>
      <strong>${esc(system.name)}</strong>
      <small>${esc(system.definition || '')}</small>
    </button>`;
  }).join('');

  const root = document.createElement('div');
  root.className = 'compact-map-root';
  root.innerHTML = `<div class="compact-map-scroll"><div class="compact-map" style="width:${layout.width}px;height:${layout.height}px">
    ${lanes}
    <svg class="compact-lines" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">
      <defs>
        <marker id="hierarchyArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 Z" class="compact-arrow hierarchy-arrow" /></marker>
        <marker id="dependencyArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,1 L9,5 L0,9 Z" class="compact-arrow dependency-arrow" /></marker>
      </defs>
      ${edges.dependency.map((edge, index) => dependencyPath(edge, layout, index)).join('')}
      ${edges.hierarchy.map(edge => hierarchyPath(edge, layout)).join('')}
    </svg>
    ${nodeHtml}
  </div></div>`;

  const legacyHolder = document.createElement('div');
  legacyHolder.className = 'compact-legacy';
  legacyScroll.replaceWith(legacyHolder);
  legacyHolder.appendChild(legacyScroll);
  host.prepend(root);

  const note = host.previousElementSibling;
  if (note?.classList.contains('map-note')) {
    note.innerHTML = '<span>굵은 실선 = 하위 분류</span><span>점선 = 기능 의존</span>';
  }

  const nodes = [...root.querySelectorAll('.compact-node')];
  const edgeEls = [...root.querySelectorAll('.compact-edge')];
  const clear = () => {
    nodes.forEach(node => node.classList.remove('focus', 'dim'));
    edgeEls.forEach(edge => edge.classList.remove('focus', 'dim'));
  };
  const focus = id => {
    const related = new Set([id]);
    edges.all.forEach(edge => {
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
    node.addEventListener('click', () => legacyHolder.querySelector(`.map-node[data-id="${CSS.escape(node.dataset.id)}"]`)?.click());
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

async function init() {
  try {
    const [projectResponse, relationshipResponse] = await Promise.all([
      fetch('./data/project.json', { cache: 'no-store' }),
      fetch('./data/relationships.json', { cache: 'no-store' })
    ]);
    projectData = await projectResponse.json();
    relationshipData = await relationshipResponse.json();
  } catch {
    return;
  }

  const observer = new MutationObserver(() => requestAnimationFrame(mountMaps));
  observer.observe(document.getElementById('view'), { childList: true, subtree: true });
  mountMaps();
}

window.addEventListener('DOMContentLoaded', init);
