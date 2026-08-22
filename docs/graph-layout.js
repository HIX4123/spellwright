const CATEGORY_ORDER = ['magic', 'attribute', 'combat', 'character', 'roguelite'];
const CATEGORY_LABEL = {
  magic: 'Magic',
  attribute: 'Attribute',
  combat: 'Combat',
  character: 'Character',
  roguelite: 'Roguelite'
};

let projectData = null;
let relationshipData = { hierarchy: [] };

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

function buildVisualEdges(systems) {
  const ids = new Set(systems.map(system => system.id));
  const hierarchy = (relationshipData.hierarchy || [])
    .filter(edge => ids.has(edge.parent) && ids.has(edge.child))
    .map(edge => ({ from: edge.parent, to: edge.child, type: 'hierarchy', relation: edge.type || 'subtype' }));

  const hierarchyKeys = new Set(hierarchy.map(edge => `${edge.from}::${edge.to}`));
  const dependency = [];
  const seen = new Set();

  systems.forEach(system => {
    (system.dependencies || []).forEach(parent => {
      if (!ids.has(parent)) return;
      const key = `${parent}::${system.id}`;
      if (hierarchyKeys.has(key) || seen.has(key)) return;
      seen.add(key);
      dependency.push({ from: parent, to: system.id, type: 'dependency' });
    });
  });

  return { hierarchy, dependency, all: [...hierarchy, ...dependency] };
}

function hierarchyDepth(systems, hierarchyEdges) {
  const ids = systems.map(system => system.id);
  const indegree = new Map(ids.map(id => [id, 0]));
  const children = new Map(ids.map(id => [id, []]));
  const depth = new Map(ids.map(id => [id, 0]));

  hierarchyEdges.forEach(edge => {
    indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1);
    children.get(edge.from)?.push(edge.to);
  });

  const queue = ids.filter(id => indegree.get(id) === 0);
  const processed = new Set();

  while (queue.length) {
    const id = queue.shift();
    processed.add(id);
    (children.get(id) || []).forEach(child => {
      depth.set(child, Math.max(depth.get(child) || 0, (depth.get(id) || 0) + 1));
      indegree.set(child, indegree.get(child) - 1);
      if (indegree.get(child) === 0) queue.push(child);
    });
  }

  const cyclic = new Set(ids.filter(id => !processed.has(id)));
  if (cyclic.size) {
    const fallback = Math.max(0, ...depth.values()) + 1;
    cyclic.forEach(id => depth.set(id, fallback));
  }

  const used = [...new Set(ids.map(id => depth.get(id) || 0))].sort((a, b) => a - b);
  const compressed = new Map(used.map((value, index) => [value, index]));
  ids.forEach(id => depth.set(id, compressed.get(depth.get(id) || 0) || 0));

  return { depth, cyclic };
}

function distribute(index, total, size, maxSpacing = 11) {
  if (total <= 1) return 0;
  const span = Math.min(size - 26, (total - 1) * maxSpacing);
  return -span / 2 + span * index / (total - 1);
}

function makeLayout(systems, hierarchyEdges) {
  const nodeW = 168;
  const nodeH = 58;
  const lanePad = 8;
  const laneGap = 14;
  const stackGap = 7;
  const rowPad = 10;
  const rowGap = 18;
  const headerH = 34;
  const marginX = 12;
  const marginY = 8;
  const categories = CATEGORY_ORDER.filter(category => systems.some(system => system.category === category));
  const laneW = nodeW + lanePad * 2;
  const { depth, cyclic } = hierarchyDepth(systems, hierarchyEdges);
  const maxDepth = Math.max(0, ...systems.map(system => depth.get(system.id) || 0));
  const laneX = new Map(categories.map((category, index) => [category, marginX + index * (laneW + laneGap)]));
  const groups = new Map();

  for (let level = 0; level <= maxDepth; level += 1) {
    categories.forEach(category => {
      groups.set(`${level}:${category}`, systems.filter(system =>
        (depth.get(system.id) || 0) === level && system.category === category
      ));
    });
  }

  const rowH = new Map();
  const rowY = new Map();
  let cursorY = marginY + headerH;
  for (let level = 0; level <= maxDepth; level += 1) {
    const stack = Math.max(1, ...categories.map(category => groups.get(`${level}:${category}`)?.length || 0));
    const height = rowPad * 2 + stack * nodeH + Math.max(0, stack - 1) * stackGap;
    rowH.set(level, height);
    rowY.set(level, cursorY);
    cursorY += height + (level < maxDepth ? rowGap : 0);
  }

  const nodes = new Map();
  for (let level = 0; level <= maxDepth; level += 1) {
    categories.forEach(category => {
      const items = groups.get(`${level}:${category}`) || [];
      const blockH = items.length * nodeH + Math.max(0, items.length - 1) * stackGap;
      const startY = rowY.get(level) + Math.max(rowPad, (rowH.get(level) - blockH) / 2);
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
    });
  }

  const baseWidth = marginX * 2 + categories.length * laneW + Math.max(0, categories.length - 1) * laneGap;
  return {
    width: Math.max(600, baseWidth),
    height: Math.max(250, cursorY + marginY),
    nodes,
    categories,
    depth,
    cyclic,
    maxDepth,
    laneW,
    laneX,
    rowY,
    rowH,
    nodeW,
    nodeH
  };
}

function buildPortOffsets(edges, layout, axis = 'x') {
  const outgoing = new Map();
  const incoming = new Map();
  const key = edge => `${edge.type}:${edge.from}::${edge.to}`;

  edges.forEach(edge => {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    if (!incoming.has(edge.to)) incoming.set(edge.to, []);
    outgoing.get(edge.from).push(edge);
    incoming.get(edge.to).push(edge);
  });

  const out = new Map();
  const input = new Map();
  const targetCoord = edge => {
    const node = layout.nodes.get(edge.to);
    return axis === 'x' ? node?.x || 0 : node?.y || 0;
  };
  const sourceCoord = edge => {
    const node = layout.nodes.get(edge.from);
    return axis === 'x' ? node?.x || 0 : node?.y || 0;
  };
  const size = axis === 'x' ? layout.nodeW : layout.nodeH;

  outgoing.forEach(list => {
    list.sort((a, b) => targetCoord(a) - targetCoord(b));
    list.forEach((edge, index) => out.set(key(edge), distribute(index, list.length, size)));
  });
  incoming.forEach(list => {
    list.sort((a, b) => sourceCoord(a) - sourceCoord(b));
    list.forEach((edge, index) => input.set(key(edge), distribute(index, list.length, size)));
  });

  return { out, input, key };
}

function renderHierarchyEdges(edges, layout) {
  const offsets = buildPortOffsets(edges, layout, 'x');
  return edges.map(edge => {
    const a = layout.nodes.get(edge.from);
    const b = layout.nodes.get(edge.to);
    if (!a || !b) return '';
    const edgeId = offsets.key(edge);
    const sx = a.x + a.w / 2 + (offsets.out.get(edgeId) || 0);
    const sy = a.y + a.h;
    const ex = b.x + b.w / 2 + (offsets.input.get(edgeId) || 0);
    const ey = b.y;
    const midY = Math.round((sy + ey) / 2);
    const path = Math.abs(sx - ex) < 2
      ? `M ${sx} ${sy} V ${ey}`
      : `M ${sx} ${sy} V ${midY} H ${ex} V ${ey}`;
    return `<path class="compact-edge hierarchy" data-from="${edge.from}" data-to="${edge.to}" d="${path}" marker-end="url(#hierarchyArrow)" />`;
  }).join('');
}

function renderDependencyEdges(edges, layout) {
  const offsets = buildPortOffsets(edges, layout, 'y');
  let sameLaneIndex = 0;

  return edges.map(edge => {
    const a = layout.nodes.get(edge.from);
    const b = layout.nodes.get(edge.to);
    if (!a || !b) return '';
    const edgeId = offsets.key(edge);
    const toRight = (b.x + b.w / 2) >= (a.x + a.w / 2);
    const sx = toRight ? a.x + a.w : a.x;
    const sy = a.y + a.h / 2 + (offsets.out.get(edgeId) || 0);
    const ex = toRight ? b.x : b.x + b.w;
    const ey = b.y + b.h / 2 + (offsets.input.get(edgeId) || 0);
    let path;

    if (a.category === b.category) {
      const gutter = Math.max(a.x + a.w, b.x + b.w) + 10 + sameLaneIndex * 5;
      sameLaneIndex += 1;
      path = `M ${sx} ${sy} H ${gutter} V ${ey} H ${ex}`;
    } else {
      const midX = Math.round((sx + ex) / 2);
      path = `M ${sx} ${sy} H ${midX} V ${ey} H ${ex}`;
    }

    return `<path class="compact-edge dependency" data-from="${edge.from}" data-to="${edge.to}" d="${path}" marker-end="url(#dependencyArrow)" />`;
  }).join('');
}

function renderCompactMap(host, legacyScroll) {
  if (!projectData || host.querySelector(':scope > .compact-map-root')) return;
  const systems = visibleSystemsFromLegacy(legacyScroll);
  if (!systems.length) return;

  const model = buildVisualEdges(systems);
  const layout = makeLayout(systems, model.hierarchy);
  const parentByChild = new Map(model.hierarchy.map(edge => [edge.to, edge.from]));
  const systemById = new Map(systems.map(system => [system.id, system]));

  const laneHtml = layout.categories.map(category => {
    const x = layout.laneX.get(category);
    return `<div class="compact-lane" style="left:${x}px;width:${layout.laneW}px;height:${layout.height}px">
      <span>${CATEGORY_LABEL[category] || category}</span>
    </div>`;
  }).join('');

  const nodeHtml = systems.map(system => {
    const p = layout.nodes.get(system.id);
    const cycle = layout.cyclic.has(system.id) ? ' cycle' : '';
    const parentId = parentByChild.get(system.id);
    const parentName = parentId ? systemById.get(parentId)?.name : '';
    const parentClass = parentName ? ' has-parent' : '';
    return `<button class="compact-node${cycle}${parentClass}" data-id="${system.id}" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px">
      <span class="compact-node-kicker"><span>${escapeHtml(system.statusText)}</span>${parentName ? `<em>↳ ${escapeHtml(parentName)}</em>` : ''}</span>
      <strong>${escapeHtml(system.name)}</strong>
      <small>${escapeHtml(system.definition || '')}</small>
    </button>`;
  }).join('');

  const hierarchyHtml = renderHierarchyEdges(model.hierarchy, layout);
  const dependencyHtml = renderDependencyEdges(model.dependency, layout);

  const root = document.createElement('div');
  root.className = 'compact-map-root';
  root.innerHTML = `<div class="compact-map-scroll">
    <div class="compact-map" style="width:${layout.width}px;height:${layout.height}px">
      ${laneHtml}
      <svg class="compact-lines" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">
        <defs>
          <marker id="hierarchyArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 Z" class="compact-arrow hierarchy-arrow" /></marker>
          <marker id="dependencyArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,1 L9,5 L0,9 Z" class="compact-arrow dependency-arrow" /></marker>
        </defs>
        ${dependencyHtml}
        ${hierarchyHtml}
      </svg>
      ${nodeHtml}
    </div>
  </div>`;

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
    model.all.forEach(edge => {
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
    const [projectResponse, relationshipResponse] = await Promise.all([
      fetch('./data/project.json', { cache: 'no-store' }),
      fetch('./data/relationships.json', { cache: 'no-store' })
    ]);
    projectData = await projectResponse.json();
    if (relationshipResponse.ok) relationshipData = await relationshipResponse.json();
  } catch {
    return;
  }

  const observer = new MutationObserver(() => requestAnimationFrame(mountMaps));
  observer.observe(document.getElementById('view'), { childList: true, subtree: true });
  mountMaps();
}

window.addEventListener('DOMContentLoaded', initCompactLayout);
