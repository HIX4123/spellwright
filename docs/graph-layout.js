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

function layoutSystems(systems, hierarchy) {
  const nodeW = 144;
  const nodeH = 56;
  const siblingGap = 8;
  const levelGap = 28;
  const componentGap = 12;
  const lanePad = 8;
  const laneGap = 10;
  const marginX = 10;
  const headerH = 36;
  const bottomPad = 12;

  const categories = CATEGORY_ORDER.filter(category => systems.some(system => system.category === category));
  const byId = new Map(systems.map(system => [system.id, system]));
  const sourceOrder = new Map(systems.map((system, index) => [system.id, index]));

  // Hierarchy layout is intentionally local to each swimlane. Only real siblings
  // share a horizontal row. Unrelated concepts are separate vertical components.
  const sameLaneHierarchy = hierarchy.filter(edge => {
    const parent = byId.get(edge.from);
    const child = byId.get(edge.to);
    return parent && child && parent.category === child.category;
  });

  const childrenByParent = new Map();
  const parentByChild = new Map();
  sameLaneHierarchy.forEach(edge => {
    if (!childrenByParent.has(edge.from)) childrenByParent.set(edge.from, []);
    childrenByParent.get(edge.from).push(edge.to);
    parentByChild.set(edge.to, edge.from);
  });
  childrenByParent.forEach(list => list.sort((a, b) => sourceOrder.get(a) - sourceOrder.get(b)));

  const subtreeWidthMemo = new Map();
  function subtreeWidth(id, trail = new Set()) {
    if (subtreeWidthMemo.has(id)) return subtreeWidthMemo.get(id);
    if (trail.has(id)) return nodeW;
    const nextTrail = new Set(trail).add(id);
    const children = childrenByParent.get(id) || [];
    if (!children.length) {
      subtreeWidthMemo.set(id, nodeW);
      return nodeW;
    }
    const childrenW = children.reduce((sum, child) => sum + subtreeWidth(child, nextTrail), 0)
      + Math.max(0, children.length - 1) * siblingGap;
    const width = Math.max(nodeW, childrenW);
    subtreeWidthMemo.set(id, width);
    return width;
  }

  const subtreeDepthMemo = new Map();
  function subtreeDepth(id, trail = new Set()) {
    if (subtreeDepthMemo.has(id)) return subtreeDepthMemo.get(id);
    if (trail.has(id)) return 0;
    const nextTrail = new Set(trail).add(id);
    const children = childrenByParent.get(id) || [];
    const depth = children.length ? 1 + Math.max(...children.map(child => subtreeDepth(child, nextTrail))) : 0;
    subtreeDepthMemo.set(id, depth);
    return depth;
  }

  const laneModels = new Map();
  categories.forEach(category => {
    const categorySystems = systems.filter(system => system.category === category);
    const roots = categorySystems
      .filter(system => !parentByChild.has(system.id))
      .sort((a, b) => {
        const aTree = (childrenByParent.get(a.id) || []).length ? 0 : 1;
        const bTree = (childrenByParent.get(b.id) || []).length ? 0 : 1;
        return aTree - bTree || sourceOrder.get(a.id) - sourceOrder.get(b.id);
      });

    const components = roots.map(root => ({
      root: root.id,
      width: subtreeWidth(root.id),
      height: nodeH + subtreeDepth(root.id) * (nodeH + levelGap)
    }));

    const width = lanePad * 2 + Math.max(nodeW, ...components.map(component => component.width));
    const height = headerH + components.reduce((sum, component) => sum + component.height, 0)
      + Math.max(0, components.length - 1) * componentGap + bottomPad;
    laneModels.set(category, { roots, components, width, height });
  });

  const laneX = new Map();
  let xCursor = marginX;
  categories.forEach(category => {
    laneX.set(category, xCursor);
    xCursor += laneModels.get(category).width + laneGap;
  });

  const nodes = new Map();
  function placeTree(id, left, top, trail = new Set()) {
    if (trail.has(id)) return;
    const nextTrail = new Set(trail).add(id);
    const width = subtreeWidth(id);
    nodes.set(id, {
      x: left + (width - nodeW) / 2,
      y: top,
      w: nodeW,
      h: nodeH,
      category: byId.get(id)?.category
    });

    const children = childrenByParent.get(id) || [];
    if (!children.length) return;
    const childWidths = children.map(child => subtreeWidth(child));
    const totalChildrenW = childWidths.reduce((a, b) => a + b, 0) + Math.max(0, children.length - 1) * siblingGap;
    let childLeft = left + (width - totalChildrenW) / 2;
    children.forEach((child, index) => {
      placeTree(child, childLeft, top + nodeH + levelGap, nextTrail);
      childLeft += childWidths[index] + siblingGap;
    });
  }

  categories.forEach(category => {
    const model = laneModels.get(category);
    let yCursor = headerH;
    model.components.forEach(component => {
      const left = laneX.get(category) + lanePad + (model.width - lanePad * 2 - component.width) / 2;
      placeTree(component.root, left, yCursor);
      yCursor += component.height + componentGap;
    });
  });

  const graphWidth = Math.max(600, xCursor - laneGap + marginX);
  const graphHeight = Math.max(220, ...categories.map(category => laneModels.get(category).height));

  return {
    nodes,
    categories,
    laneX,
    laneModels,
    nodeW,
    nodeH,
    width: graphWidth,
    height: graphHeight
  };
}

function renderHierarchyEdges(edges, layout) {
  const byParent = new Map();
  edges.forEach(edge => {
    if (!byParent.has(edge.from)) byParent.set(edge.from, []);
    byParent.get(edge.from).push(edge);
  });

  return [...byParent.entries()].map(([parentId, family]) => {
    const parent = layout.nodes.get(parentId);
    const children = family.map(edge => ({ edge, node: layout.nodes.get(edge.to) })).filter(x => x.node);
    if (!parent || !children.length) return '';

    const sx = parent.x + parent.w / 2;
    const sy = parent.y + parent.h;

    if (children.length === 1) {
      const child = children[0];
      const ex = child.node.x + child.node.w / 2;
      const ey = child.node.y;
      const midY = Math.round((sy + ey) / 2);
      const d = Math.abs(sx - ex) < 2
        ? `M ${sx} ${sy} V ${ey}`
        : `M ${sx} ${sy} V ${midY} H ${ex} V ${ey}`;
      return `<path class="compact-edge hierarchy" data-from="${parentId}" data-to="${child.edge.to}" d="${d}" marker-end="url(#hierarchyArrow)" />`;
    }

    const centers = children.map(child => child.node.x + child.node.w / 2);
    const childTop = Math.min(...children.map(child => child.node.y));
    const branchY = Math.round((sy + childTop) / 2);
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

function dependencyPath(edge, layout, index) {
  const a = layout.nodes.get(edge.from);
  const b = layout.nodes.get(edge.to);
  if (!a || !b) return '';

  const aCenter = a.x + a.w / 2;
  const bCenter = b.x + b.w / 2;
  const right = bCenter >= aCenter;
  const sx = right ? a.x + a.w : a.x;
  const sy = a.y + a.h / 2;
  const ex = right ? b.x : b.x + b.w;
  const ey = b.y + b.h / 2;

  // Same-lane dependencies use a shallow side gutter so they do not cut through
  // the hierarchy tree. Cross-lane dependencies use the midpoint between lanes.
  let midX;
  if (a.category === b.category) {
    const model = layout.laneModels.get(a.category);
    const laneRight = layout.laneX.get(a.category) + model.width;
    midX = laneRight - 3 + (index % 3) * 3;
  } else {
    midX = Math.round((sx + ex) / 2);
  }
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
    const model = layout.laneModels.get(category);
    return `<div class="compact-lane" style="left:${x}px;width:${model.width}px;height:${layout.height}px"><span>${CATEGORY_LABEL[category] || category}</span></div>`;
  }).join('');

  const nodeHtml = systems.map(system => {
    const p = layout.nodes.get(system.id);
    if (!p) return '';
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
      ${renderHierarchyEdges(edges.hierarchy, layout)}
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
