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
let scheduled = false;

const observedHosts = new WeakSet();
const resizeObserver = new ResizeObserver(entries => {
  entries.forEach(entry => rerenderHost(entry.target));
});

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

function rawEdges(systems) {
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

function hasAlternativePath(from, to, allEdges, skipped) {
  const adjacency = new Map();
  allEdges.forEach(edge => {
    if (edge === skipped) return;
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge.to);
  });

  const queue = [from];
  const visited = new Set([from]);
  while (queue.length) {
    const id = queue.shift();
    for (const next of adjacency.get(id) || []) {
      if (next === to) return true;
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return false;
}

function visualEdges(raw) {
  // Keep every hierarchy edge. Functional edges that are already conveyed by an
  // alternate hierarchy/dependency path are omitted from the overview only; the
  // full dependency list remains available in the detail dialog.
  const dependency = raw.dependency.filter(edge => !hasAlternativePath(edge.from, edge.to, raw.all, edge));
  return { hierarchy: raw.hierarchy, dependency, all: [...raw.hierarchy, ...dependency] };
}

function stronglyConnectedComponents(systems, edges) {
  const ids = systems.map(system => system.id);
  const adjacency = new Map(ids.map(id => [id, []]));
  edges.forEach(edge => adjacency.get(edge.from)?.push(edge.to));

  let index = 0;
  const stack = [];
  const onStack = new Set();
  const indices = new Map();
  const low = new Map();
  const components = [];

  function visit(id) {
    indices.set(id, index);
    low.set(id, index);
    index += 1;
    stack.push(id);
    onStack.add(id);

    for (const next of adjacency.get(id) || []) {
      if (!indices.has(next)) {
        visit(next);
        low.set(id, Math.min(low.get(id), low.get(next)));
      } else if (onStack.has(next)) {
        low.set(id, Math.min(low.get(id), indices.get(next)));
      }
    }

    if (low.get(id) === indices.get(id)) {
      const component = [];
      while (stack.length) {
        const node = stack.pop();
        onStack.delete(node);
        component.push(node);
        if (node === id) break;
      }
      components.push(component);
    }
  }

  ids.forEach(id => {
    if (!indices.has(id)) visit(id);
  });

  const componentOf = new Map();
  components.forEach((component, componentId) => {
    component.forEach(id => componentOf.set(id, componentId));
  });
  return { components, componentOf };
}

function rankSystems(systems, edges) {
  const { components, componentOf } = stronglyConnectedComponents(systems, edges);
  const children = new Map(components.map((_, index) => [index, new Set()]));
  const indegree = new Map(components.map((_, index) => [index, 0]));

  edges.forEach(edge => {
    const from = componentOf.get(edge.from);
    const to = componentOf.get(edge.to);
    if (from === to || children.get(from).has(to)) return;
    children.get(from).add(to);
    indegree.set(to, indegree.get(to) + 1);
  });

  const queue = [...indegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id);
  const componentRank = new Map(components.map((_, index) => [index, 0]));
  while (queue.length) {
    const id = queue.shift();
    for (const child of children.get(id)) {
      componentRank.set(child, Math.max(componentRank.get(child), componentRank.get(id) + 1));
      indegree.set(child, indegree.get(child) - 1);
      if (indegree.get(child) === 0) queue.push(child);
    }
  }

  return new Map(systems.map(system => [system.id, componentRank.get(componentOf.get(system.id)) || 0]));
}

function orderRanks(systems, ranks, edges) {
  const sourceOrder = new Map(systems.map((system, index) => [system.id, index]));
  const groups = new Map();
  systems.forEach(system => {
    const rank = ranks.get(system.id) || 0;
    if (!groups.has(rank)) groups.set(rank, []);
    groups.get(rank).push(system.id);
  });
  groups.forEach(ids => ids.sort((a, b) => sourceOrder.get(a) - sourceOrder.get(b)));

  const incoming = new Map(systems.map(system => [system.id, []]));
  const outgoing = new Map(systems.map(system => [system.id, []]));
  edges.forEach(edge => {
    incoming.get(edge.to)?.push(edge.from);
    outgoing.get(edge.from)?.push(edge.to);
  });

  function positionMap() {
    const positions = new Map();
    groups.forEach(ids => ids.forEach((id, index) => positions.set(id, index)));
    return positions;
  }

  const maxRank = Math.max(0, ...groups.keys());
  for (let pass = 0; pass < 5; pass += 1) {
    let positions = positionMap();
    for (let rank = 1; rank <= maxRank; rank += 1) {
      const ids = groups.get(rank) || [];
      ids.sort((a, b) => {
        const pa = incoming.get(a).filter(id => (ranks.get(id) || 0) < rank).map(id => positions.get(id));
        const pb = incoming.get(b).filter(id => (ranks.get(id) || 0) < rank).map(id => positions.get(id));
        const ba = pa.length ? pa.reduce((x, y) => x + y, 0) / pa.length : sourceOrder.get(a);
        const bb = pb.length ? pb.reduce((x, y) => x + y, 0) / pb.length : sourceOrder.get(b);
        return ba - bb || sourceOrder.get(a) - sourceOrder.get(b);
      });
    }

    positions = positionMap();
    for (let rank = maxRank - 1; rank >= 0; rank -= 1) {
      const ids = groups.get(rank) || [];
      ids.sort((a, b) => {
        const pa = outgoing.get(a).filter(id => (ranks.get(id) || 0) > rank).map(id => positions.get(id));
        const pb = outgoing.get(b).filter(id => (ranks.get(id) || 0) > rank).map(id => positions.get(id));
        const ba = pa.length ? pa.reduce((x, y) => x + y, 0) / pa.length : sourceOrder.get(a);
        const bb = pb.length ? pb.reduce((x, y) => x + y, 0) / pb.length : sourceOrder.get(b);
        return ba - bb || sourceOrder.get(a) - sourceOrder.get(b);
      });
    }
  }

  return groups;
}

function layoutSystems(host, systems, raw, visual) {
  const nodeW = 148;
  const nodeH = 58;
  const gapX = 20;
  const gapY = 12;
  const rankGap = 62;
  const marginX = 24;
  const marginTop = 22;
  const marginBottom = 20;
  const isolatedGap = 18;
  const isolatedLabelH = 26;

  const incident = new Set();
  raw.all.forEach(edge => {
    incident.add(edge.from);
    incident.add(edge.to);
  });
  const connected = systems.filter(system => incident.has(system.id));
  const isolated = systems.filter(system => !incident.has(system.id));

  const ranks = rankSystems(connected, raw.all.filter(edge => incident.has(edge.from) && incident.has(edge.to)));
  const ordered = orderRanks(connected, ranks, visual.all);
  const maxRank = connected.length ? Math.max(0, ...connected.map(system => ranks.get(system.id) || 0)) : -1;

  const hostWidth = Math.max(620, Math.floor(host.clientWidth || 900));
  const maxPerLine = Math.max(1, Math.floor((hostWidth - marginX * 2 + gapX) / (nodeW + gapX)));
  const nodes = new Map();
  const rankBands = new Map();
  let y = marginTop;

  for (let rank = 0; rank <= maxRank; rank += 1) {
    const ids = ordered.get(rank) || [];
    const lineCount = Math.max(1, Math.ceil(ids.length / maxPerLine));
    const bandTop = y;

    for (let line = 0; line < lineCount; line += 1) {
      const lineIds = ids.slice(line * maxPerLine, (line + 1) * maxPerLine);
      const lineW = lineIds.length * nodeW + Math.max(0, lineIds.length - 1) * gapX;
      let x = Math.max(marginX, (hostWidth - lineW) / 2);
      lineIds.forEach(id => {
        const system = systems.find(item => item.id === id);
        nodes.set(id, { x, y: y + line * (nodeH + gapY), w: nodeW, h: nodeH, rank, category: system?.category });
        x += nodeW + gapX;
      });
    }

    const bandH = lineCount * nodeH + Math.max(0, lineCount - 1) * gapY;
    rankBands.set(rank, { top: bandTop, bottom: bandTop + bandH });
    y += bandH + rankGap;
  }

  let isolatedTop = y;
  if (isolated.length) {
    isolatedTop += isolatedGap;
    y = isolatedTop + isolatedLabelH;
    const cols = Math.min(maxPerLine, Math.max(1, isolated.length));
    for (let index = 0; index < isolated.length; index += 1) {
      const line = Math.floor(index / cols);
      const col = index % cols;
      const lineCount = Math.min(cols, isolated.length - line * cols);
      const lineW = lineCount * nodeW + Math.max(0, lineCount - 1) * gapX;
      const startX = Math.max(marginX, (hostWidth - lineW) / 2);
      nodes.set(isolated[index].id, {
        x: startX + col * (nodeW + gapX),
        y: y + line * (nodeH + gapY),
        w: nodeW,
        h: nodeH,
        rank: null,
        category: isolated[index].category,
        isolated: true
      });
    }
    const lines = Math.ceil(isolated.length / cols);
    y += lines * nodeH + Math.max(0, lines - 1) * gapY;
  }

  return {
    nodes,
    ranks,
    rankBands,
    width: hostWidth,
    height: Math.max(230, y + marginBottom),
    nodeW,
    nodeH,
    isolatedTop: isolated.length ? isolatedTop : null
  };
}

function distributedOffsets(edges, layout) {
  const outgoing = new Map();
  const incoming = new Map();
  edges.forEach(edge => {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    if (!incoming.has(edge.to)) incoming.set(edge.to, []);
    outgoing.get(edge.from).push(edge);
    incoming.get(edge.to).push(edge);
  });

  const key = edge => `${edge.from}::${edge.to}::${edge.type}`;
  const out = new Map();
  const inn = new Map();
  const spread = (index, total, width) => {
    if (total <= 1) return 0;
    const span = Math.min(width * 0.56, (total - 1) * 14);
    return -span / 2 + span * (index / (total - 1));
  };

  outgoing.forEach(list => {
    list.sort((a, b) => (layout.nodes.get(a.to)?.x || 0) - (layout.nodes.get(b.to)?.x || 0));
    list.forEach((edge, index) => out.set(key(edge), spread(index, list.length, layout.nodeW)));
  });
  incoming.forEach(list => {
    list.sort((a, b) => (layout.nodes.get(a.from)?.x || 0) - (layout.nodes.get(b.from)?.x || 0));
    list.forEach((edge, index) => inn.set(key(edge), spread(index, list.length, layout.nodeW)));
  });
  return { out, inn, key };
}

function renderHierarchyEdges(edges, layout) {
  const byParent = new Map();
  edges.forEach(edge => {
    if (!byParent.has(edge.from)) byParent.set(edge.from, []);
    byParent.get(edge.from).push(edge);
  });

  return [...byParent.entries()].map(([parentId, family]) => {
    const parent = layout.nodes.get(parentId);
    const children = family.map(edge => ({ edge, node: layout.nodes.get(edge.to) })).filter(item => item.node);
    if (!parent || !children.length) return '';

    const sx = parent.x + parent.w / 2;
    const sy = parent.y + parent.h;
    const childTop = Math.min(...children.map(child => child.node.y));
    const branchY = Math.round(sy + Math.max(18, (childTop - sy) * 0.48));

    if (children.length === 1) {
      const child = children[0];
      const ex = child.node.x + child.node.w / 2;
      const ey = child.node.y;
      const d = Math.abs(sx - ex) < 2
        ? `M ${sx} ${sy} V ${ey}`
        : `M ${sx} ${sy} V ${branchY} H ${ex} V ${ey}`;
      return `<path class="compact-edge hierarchy" data-from="${parentId}" data-to="${child.edge.to}" d="${d}" marker-end="url(#hierarchyArrow)" />`;
    }

    const centers = children.map(child => child.node.x + child.node.w / 2);
    const minX = Math.min(...centers);
    const maxX = Math.max(...centers);
    let svg = `<path class="compact-edge hierarchy family-trunk" data-from="${parentId}" d="M ${sx} ${sy} V ${branchY} M ${minX} ${branchY} H ${maxX}" />`;
    svg += children.map(child => {
      const ex = child.node.x + child.node.w / 2;
      const ey = child.node.y;
      return `<path class="compact-edge hierarchy family-branch" data-from="${parentId}" data-to="${child.edge.to}" d="M ${ex} ${branchY} V ${ey}" marker-end="url(#hierarchyArrow)" />`;
    }).join('');
    return svg;
  }).join('');
}

function dependencyRenderModel(edges) {
  const byKey = new Map(edges.map(edge => [`${edge.from}::${edge.to}`, edge]));
  const consumed = new Set();
  const result = [];
  edges.forEach(edge => {
    const key = `${edge.from}::${edge.to}`;
    if (consumed.has(key)) return;
    const reverseKey = `${edge.to}::${edge.from}`;
    if (byKey.has(reverseKey)) {
      consumed.add(key);
      consumed.add(reverseKey);
      result.push({ ...edge, mutual: true });
    } else {
      consumed.add(key);
      result.push(edge);
    }
  });
  return result;
}

function renderDependencyEdges(edges, layout) {
  const model = dependencyRenderModel(edges);
  const ports = distributedOffsets(model, layout);

  return model.map(edge => {
    const a = layout.nodes.get(edge.from);
    const b = layout.nodes.get(edge.to);
    if (!a || !b) return '';

    const sameRank = a.rank !== null && a.rank === b.rank;
    let d;
    let markerStart = '';
    let markerEnd = ' marker-end="url(#dependencyArrow)"';

    if (sameRank) {
      const leftToRight = a.x <= b.x;
      const sx = leftToRight ? a.x + a.w : a.x;
      const ex = leftToRight ? b.x : b.x + b.w;
      const y = Math.round((a.y + a.h / 2 + b.y + b.h / 2) / 2);
      d = `M ${sx} ${y} H ${ex}`;
      if (edge.mutual) markerStart = ' marker-start="url(#dependencyArrowStart)"';
    } else {
      const key = ports.key(edge);
      const sourceAbove = a.y <= b.y;
      const sx = a.x + a.w / 2 + (ports.out.get(key) || 0);
      const ex = b.x + b.w / 2 + (ports.inn.get(key) || 0);
      const sy = sourceAbove ? a.y + a.h : a.y;
      const ey = sourceAbove ? b.y : b.y + b.h;
      d = `M ${sx} ${sy} L ${ex} ${ey}`;
      if (edge.mutual) markerStart = ' marker-start="url(#dependencyArrowStart)"';
    }

    return `<path class="compact-edge dependency${edge.mutual ? ' mutual' : ''}" data-from="${edge.from}" data-to="${edge.to}" d="${d}"${markerStart}${markerEnd} />`;
  }).join('');
}

function categoryLegend() {
  return CATEGORY_ORDER.map(category => `<span class="category-legend ${category}"><i></i>${CATEGORY_LABEL[category]}</span>`).join('');
}

function renderCompactMap(host, legacyScroll) {
  const systems = visibleSystemsFromLegacy(legacyScroll);
  if (!systems.length) return;

  const raw = rawEdges(systems);
  const visual = visualEdges(raw);
  const layout = layoutSystems(host, systems, raw, visual);
  const byId = new Map(systems.map(system => [system.id, system]));
  const parentByChild = new Map(visual.hierarchy.map(edge => [edge.to, edge.from]));

  const nodeHtml = systems.map(system => {
    const p = layout.nodes.get(system.id);
    if (!p) return '';
    const parent = byId.get(parentByChild.get(system.id));
    return `<button class="compact-node" data-id="${system.id}" data-category="${system.category}" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px">
      <span class="compact-node-kicker">
        <span class="compact-category">${esc(CATEGORY_LABEL[system.category] || system.category)}</span>
        <span class="compact-status">${esc(system.statusText)}</span>
      </span>
      <strong>${esc(system.name)}</strong>
      <small>${esc(system.definition || '')}</small>
      ${parent ? `<em class="compact-parent">↳ ${esc(parent.name)}</em>` : ''}
    </button>`;
  }).join('');

  const root = document.createElement('div');
  root.className = 'compact-map-root';
  root.innerHTML = `
    <div class="compact-legend">
      <div class="relation-legend"><span class="solid-sample">상하위</span><span class="dash-sample">기능 의존</span></div>
      <div class="category-legends">${categoryLegend()}</div>
    </div>
    <div class="compact-map-scroll">
      <div class="compact-map" style="width:${layout.width}px;height:${layout.height}px">
        ${layout.isolatedTop !== null ? `<div class="isolated-label" style="top:${layout.isolatedTop}px">현재 관계선 없음</div>` : ''}
        <svg class="compact-lines" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">
          <defs>
            <marker id="hierarchyArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 Z" class="hierarchy-arrow" /></marker>
            <marker id="dependencyArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,1 L9,5 L0,9 Z" class="dependency-arrow" /></marker>
            <marker id="dependencyArrowStart" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 Z" class="dependency-arrow" /></marker>
          </defs>
          ${renderDependencyEdges(visual.dependency, layout)}
          ${renderHierarchyEdges(visual.hierarchy, layout)}
        </svg>
        ${nodeHtml}
      </div>
    </div>`;

  const existingRoot = host.querySelector(':scope > .compact-map-root');
  existingRoot?.remove();

  let legacyHolder = host.querySelector(':scope > .compact-legacy');
  if (!legacyHolder) {
    legacyHolder = document.createElement('div');
    legacyHolder.className = 'compact-legacy';
    legacyScroll.replaceWith(legacyHolder);
    legacyHolder.appendChild(legacyScroll);
  }
  host.prepend(root);

  const note = host.previousElementSibling;
  if (note?.classList.contains('map-note')) {
    note.innerHTML = '<span>위 → 아래 = 관계 흐름</span><span>색상 = 카테고리</span>';
  }

  const nodes = [...root.querySelectorAll('.compact-node')];
  const edgeEls = [...root.querySelectorAll('.compact-edge')];
  const clear = () => {
    nodes.forEach(node => node.classList.remove('focus', 'dim'));
    edgeEls.forEach(edge => edge.classList.remove('focus', 'dim'));
  };
  const focus = id => {
    const related = new Set([id]);
    visual.all.forEach(edge => {
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

  if (!observedHosts.has(host)) {
    observedHosts.add(host);
    resizeObserver.observe(host);
  }
}

function rerenderHost(host) {
  const legacyScroll = host.querySelector(':scope > .compact-legacy .system-map-scroll')
    || host.querySelector(':scope > .system-map-scroll');
  if (!legacyScroll || !projectData) return;
  renderCompactMap(host, legacyScroll);
}

function mountMaps() {
  ['systemMap', 'combatMap'].forEach(id => {
    const host = document.getElementById(id);
    if (!host) return;
    const legacyScroll = host.querySelector(':scope > .system-map-scroll')
      || host.querySelector(':scope > .compact-legacy .system-map-scroll');
    if (!legacyScroll) return;
    if (!host.querySelector(':scope > .compact-map-root')) renderCompactMap(host, legacyScroll);
  });
}

function scheduleMount() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    mountMaps();
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

  const view = document.getElementById('view');
  if (view) new MutationObserver(scheduleMount).observe(view, { childList: true, subtree: true });
  mountMaps();
}

window.addEventListener('DOMContentLoaded', init);
