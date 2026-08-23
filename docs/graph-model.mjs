export const CATEGORY_ORDER = ['magic', 'attribute', 'combat', 'character', 'roguelite'];

function hasAlternativePath(from, to, edges, skipped) {
  const children = new Map();
  edges.forEach(edge => {
    if (edge === skipped) return;
    if (!children.has(edge.from)) children.set(edge.from, []);
    children.get(edge.from).push(edge.to);
  });

  const queue = [from];
  const visited = new Set(queue);
  while (queue.length) {
    const id = queue.shift();
    for (const child of children.get(id) || []) {
      if (child === to) return true;
      if (!visited.has(child)) {
        visited.add(child);
        queue.push(child);
      }
    }
  }
  return false;
}

export function buildGraphModel(systems, relationships = {}) {
  const hidden = new Set(relationships.hiddenSystems || []);
  const visibleSystems = systems.filter(system => !hidden.has(system.id));
  const ids = new Set(visibleSystems.map(system => system.id));
  const suppressed = new Set((relationships.suppressedDependencies || [])
    .map(edge => `${edge.from}::${edge.to}`));

  const hierarchy = (relationships.hierarchy || [])
    .filter(edge => ids.has(edge.parent) && ids.has(edge.child))
    .map(edge => ({
      from: edge.parent,
      to: edge.child,
      kind: 'hierarchy',
      relationType: edge.type,
      order: edge.order || 0
    }));
  const hierarchyKeys = new Set(hierarchy.map(edge => `${edge.from}::${edge.to}`));
  const seen = new Set();
  const rawDependency = [];

  visibleSystems.forEach(system => {
    (system.dependencies || []).forEach(parent => {
      const key = `${parent}::${system.id}`;
      if (!ids.has(parent) || hierarchyKeys.has(key) || suppressed.has(key) || seen.has(key)) return;
      seen.add(key);
      rawDependency.push({ from: parent, to: system.id, kind: 'dependency' });
    });
  });

  const rawRankEdges = [...hierarchy, ...rawDependency];
  const reducedDependency = rawDependency.filter(edge =>
    !hasAlternativePath(edge.from, edge.to, rawRankEdges, edge));
  const dependencyByKey = new Map(reducedDependency.map(edge => [`${edge.from}::${edge.to}`, edge]));
  const consumed = new Set();
  const dependency = [];
  reducedDependency.forEach(edge => {
    const key = `${edge.from}::${edge.to}`;
    if (consumed.has(key)) return;
    const reverseKey = `${edge.to}::${edge.from}`;
    if (dependencyByKey.has(reverseKey)) {
      consumed.add(reverseKey);
      dependency.push({ ...edge, mutual: true });
    } else {
      dependency.push(edge);
    }
    consumed.add(key);
  });
  const sequence = (relationships.sequence || [])
    .filter(edge => ids.has(edge.from) && ids.has(edge.to))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(edge => ({ from: edge.from, to: edge.to, kind: 'sequence', order: edge.order || 0 }));

  return {
    systems: visibleSystems,
    hierarchy,
    dependency,
    sequence,
    rankEdges: rawRankEdges,
    edges: [...hierarchy, ...dependency, ...sequence]
  };
}

function rankSystems(ids, edges) {
  const adjacency = new Map(ids.map(id => [id, []]));
  edges.forEach(edge => adjacency.get(edge.from)?.push(edge.to));
  let nextIndex = 0;
  const indices = new Map();
  const low = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];

  function visit(id) {
    indices.set(id, nextIndex);
    low.set(id, nextIndex++);
    stack.push(id);
    onStack.add(id);

    for (const child of adjacency.get(id) || []) {
      if (!indices.has(child)) {
        visit(child);
        low.set(id, Math.min(low.get(id), low.get(child)));
      } else if (onStack.has(child)) {
        low.set(id, Math.min(low.get(id), indices.get(child)));
      }
    }

    if (low.get(id) !== indices.get(id)) return;
    const component = [];
    while (stack.length) {
      const node = stack.pop();
      onStack.delete(node);
      component.push(node);
      if (node === id) break;
    }
    components.push(component);
  }

  ids.forEach(id => { if (!indices.has(id)) visit(id); });
  const componentOf = new Map();
  components.forEach((component, index) =>
    component.forEach(id => componentOf.set(id, index)));
  const children = new Map(components.map((_, index) => [index, new Set()]));
  const indegree = new Map(components.map((_, index) => [index, 0]));

  edges.forEach(edge => {
    const from = componentOf.get(edge.from);
    const to = componentOf.get(edge.to);
    if (from === to || children.get(from).has(to)) return;
    children.get(from).add(to);
    indegree.set(to, indegree.get(to) + 1);
  });

  const queue = [...indegree].filter(([, degree]) => degree === 0).map(([id]) => id);
  const componentRank = new Map(components.map((_, index) => [index, 0]));
  while (queue.length) {
    const id = queue.shift();
    for (const child of children.get(id)) {
      componentRank.set(child, Math.max(componentRank.get(child), componentRank.get(id) + 1));
      indegree.set(child, indegree.get(child) - 1);
      if (indegree.get(child) === 0) queue.push(child);
    }
  }

  return new Map(ids.map(id => [id, componentRank.get(componentOf.get(id)) || 0]));
}

function orderLayers(systems, ranks, edges, hierarchy) {
  const sourceOrder = new Map(systems.map((system, index) => [system.id, index]));
  const layers = new Map();
  systems.forEach(system => {
    const rank = ranks.get(system.id) || 0;
    if (!layers.has(rank)) layers.set(rank, []);
    layers.get(rank).push(system.id);
  });
  layers.forEach(ids => ids.sort((a, b) => sourceOrder.get(a) - sourceOrder.get(b)));

  const neighbors = new Map(systems.map(system => [system.id, []]));
  edges.forEach(edge => {
    if (ranks.get(edge.from) === ranks.get(edge.to)) return;
    neighbors.get(edge.from)?.push(edge.to);
    neighbors.get(edge.to)?.push(edge.from);
  });

  for (let pass = 0; pass < 6; pass += 1) {
    for (const down of [true, false]) {
      const orderedRanks = [...layers.keys()].sort((a, b) => down ? a - b : b - a);
      const positions = new Map();
      layers.forEach(ids => ids.forEach((id, index) => positions.set(id, index)));
      orderedRanks.forEach(rank => layers.get(rank).sort((a, b) => {
        const center = id => {
          const relevant = (neighbors.get(id) || [])
            .filter(other => down ? ranks.get(other) < rank : ranks.get(other) > rank)
            .map(other => positions.get(other));
          return relevant.length
            ? relevant.reduce((sum, value) => sum + value, 0) / relevant.length
            : sourceOrder.get(id);
        };
        return center(a) - center(b) || sourceOrder.get(a) - sourceOrder.get(b);
      }));
    }
  }

  const stageGroups = new Map();
  const fixedGroups = new Map();
  hierarchy.filter(edge => edge.relationType === 'stage').forEach(edge => {
    if (!stageGroups.has(edge.from)) stageGroups.set(edge.from, []);
    stageGroups.get(edge.from).push(edge);
  });
  stageGroups.forEach(group => {
    group.sort((a, b) => a.order - b.order);
    const orderedIds = group.map(edge => edge.to);
    const rank = ranks.get(orderedIds[0]);
    if (rank === undefined || !orderedIds.every(id => ranks.get(id) === rank)) return;
    const layer = layers.get(rank);
    const indices = orderedIds.map(id => layer.indexOf(id)).filter(index => index >= 0);
    if (indices.length !== orderedIds.length) return;
    const insertion = Math.min(...indices);
    const rest = layer.filter(id => !orderedIds.includes(id));
    rest.splice(Math.min(insertion, rest.length), 0, ...orderedIds);
    layers.set(rank, rest);
    fixedGroups.set(rank, { ids: orderedIds, insertion });
  });

  const positions = new Map();
  layers.forEach(ids => ids.forEach((id, index) => positions.set(id, index)));
  [...layers.keys()].sort((a, b) => a - b).forEach(rank => {
    const fixed = fixedGroups.get(rank);
    const sortable = fixed
      ? layers.get(rank).filter(id => !fixed.ids.includes(id))
      : layers.get(rank);
    sortable.sort((a, b) => {
      const center = id => {
        const parents = (neighbors.get(id) || [])
          .filter(other => ranks.get(other) === rank - 1)
          .map(other => positions.get(other));
        return parents.length
          ? parents.reduce((sum, value) => sum + value, 0) / parents.length
          : sourceOrder.get(id);
      };
      return center(a) - center(b) || sourceOrder.get(a) - sourceOrder.get(b);
    });
    if (fixed) sortable.splice(Math.min(fixed.insertion, sortable.length), 0, ...fixed.ids);
    layers.set(rank, sortable);
    layers.get(rank).forEach((id, index) => positions.set(id, index));
  });

  return layers;
}

function hierarchyCenters(hierarchy, step, firstCenter) {
  const children = new Map();
  const childIds = new Set();
  hierarchy.forEach(edge => {
    if (!children.has(edge.from)) children.set(edge.from, []);
    children.get(edge.from).push(edge);
    childIds.add(edge.to);
  });
  children.forEach(edges => edges.sort((a, b) => a.order - b.order));

  const widths = new Map();
  const width = id => {
    if (widths.has(id)) return widths.get(id);
    const value = (children.get(id) || []).reduce((sum, edge) => sum + width(edge.to), 0) || 1;
    widths.set(id, value);
    return value;
  };
  const centers = new Map();
  const place = (id, start) => {
    const edges = children.get(id) || [];
    if (!edges.length) {
      centers.set(id, firstCenter + start * step);
      return;
    }
    let cursor = start;
    edges.forEach(edge => {
      place(edge.to, cursor);
      cursor += width(edge.to);
    });
    centers.set(id, (centers.get(edges[0].to) + centers.get(edges.at(-1).to)) / 2);
  };

  let cursor = 0;
  [...children.keys()].filter(id => !childIds.has(id)).forEach(root => {
    place(root, cursor);
    cursor += width(root) + 1;
  });
  return centers;
}

function routeEdges(model, nodes, contentWidth) {
  const routes = new Map();
  const gaps = new Map();
  const longEdges = [];

  model.edges.forEach(edge => {
    if (edge.kind === 'sequence') return;
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) return;
    const span = Math.abs((from.rank || 0) - (to.rank || 0));
    if (edge.kind === 'dependency' && span > 1) {
      longEdges.push(edge);
      return;
    }
    const gap = Math.min(from.rank, to.rank);
    if (!gaps.has(gap)) gaps.set(gap, []);
    gaps.get(gap).push(edge);
  });

  gaps.forEach((edges, rank) => {
    const row = [...nodes.values()].filter(node => node.rank === rank);
    const next = [...nodes.values()].filter(node => node.rank !== null && node.rank > rank);
    const top = Math.max(...row.map(node => node.y + node.h));
    const bottom = next.length ? Math.min(...next.map(node => node.y)) : top + 78;
    edges.sort((a, b) => {
      const aFrom = nodes.get(a.from);
      const bFrom = nodes.get(b.from);
      const aTo = nodes.get(a.to);
      const bTo = nodes.get(b.to);
      return Number(aFrom.rank !== aTo.rank) - Number(bFrom.rank !== bTo.rank)
        || (a.from === b.from
          ? Math.abs(bTo.x - bFrom.x) - Math.abs(aTo.x - aFrom.x)
          : 0)
        || bFrom.x - aFrom.x
        || aTo.x - bTo.x;
    });
    edges.forEach((edge, index) => {
      routes.set(edge, { trackY: top + (bottom - top) * (index + 1) / (edges.length + 1) });
    });
  });

  longEdges.forEach((edge, index) => {
    routes.set(edge, { channelX: contentWidth + 18 + index * 8 });
  });
  return routes;
}

export function layoutGraph(model) {
  const NODE_W = 148;
  const NODE_H = 58;
  const GAP_X = 26;
  const GAP_Y = 78;
  const MARGIN_X = 26;
  const MARGIN_Y = 24;
  const ids = model.systems.map(system => system.id);
  const incident = new Set();
  model.edges.forEach(edge => {
    incident.add(edge.from);
    incident.add(edge.to);
  });
  const connected = model.systems.filter(system => incident.has(system.id));
  const isolated = model.systems.filter(system => !incident.has(system.id));
  const connectedIds = connected.map(system => system.id);
  const rankEdges = model.rankEdges.filter(edge => incident.has(edge.from) && incident.has(edge.to));
  const ranks = rankSystems(connectedIds, rankEdges);
  const layers = orderLayers(connected, ranks, rankEdges, model.hierarchy);
  const longEdges = model.dependency.filter(edge =>
    Math.abs((ranks.get(edge.from) || 0) - (ranks.get(edge.to) || 0)) > 1).length;
  const nodes = new Map();
  const step = NODE_W + GAP_X;
  const firstCenter = MARGIN_X + NODE_W / 2;
  const treeCenters = hierarchyCenters(model.hierarchy, step, firstCenter);
  const centers = new Map();
  let y = MARGIN_Y;

  [...layers.keys()].sort((a, b) => a - b).forEach(rank => {
    const layer = layers.get(rank);
    layer.forEach((id, index) => {
      const related = new Set();
      rankEdges.forEach(edge => {
        if (edge.from === id && centers.has(edge.to)) related.add(edge.to);
        if (edge.to === id && centers.has(edge.from)) related.add(edge.from);
      });
      const relatedCenters = [...related].map(other => centers.get(other));
      const preferred = treeCenters.get(id)
        ?? (relatedCenters.length
          ? relatedCenters.reduce((sum, value) => sum + value, 0) / relatedCenters.length
          : firstCenter + index * step);
      const previous = centers.get(layer[index - 1]);
      let center = Math.max(firstCenter, preferred, previous === undefined ? firstCenter : previous + step);
      if (!treeCenters.has(id)) {
        const blocksUnrelatedTrunk = [...nodes].some(([other, node]) =>
          node.rank === rank - 1
          && !related.has(other)
          && Math.abs(node.x + node.w / 2 - center) < 1);
        if (blocksUnrelatedTrunk) center += GAP_X / 2;
      }
      centers.set(id, center);
      nodes.set(id, { x: center - NODE_W / 2, y, w: NODE_W, h: NODE_H, rank });
    });
    y += NODE_H + GAP_Y;
  });

  let contentWidth = Math.max(620,
    ...[...nodes.values()].map(node => node.x + node.w + MARGIN_X));

  let isolatedTop = null;
  if (isolated.length) {
    isolatedTop = y + 10;
    y = isolatedTop + 30;
    const columns = Math.max(1, Math.floor((contentWidth - MARGIN_X * 2 + GAP_X) / (NODE_W + GAP_X)));
    isolated.forEach((system, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const count = Math.min(columns, isolated.length - row * columns);
      const rowWidth = count * NODE_W + Math.max(0, count - 1) * GAP_X;
      const x = (contentWidth - rowWidth) / 2 + column * (NODE_W + GAP_X);
      nodes.set(system.id, { x, y: y + row * (NODE_H + 12), w: NODE_W, h: NODE_H, rank: null });
    });
    y += Math.ceil(isolated.length / columns) * (NODE_H + 12);
  }

  contentWidth = Math.max(contentWidth,
    ...[...nodes.values()].map(node => node.x + node.w + MARGIN_X));
  const routeWidth = longEdges ? 34 + longEdges * 8 : 0;
  const routes = routeEdges(model, nodes, contentWidth);

  return {
    nodes,
    ranks,
    layers,
    width: contentWidth + routeWidth,
    contentWidth,
    height: Math.max(230, y + 22),
    isolatedTop,
    routes
  };
}

export function edgePath(edge, layout, index = 0) {
  const from = layout.nodes.get(edge.from);
  const to = layout.nodes.get(edge.to);
  if (!from || !to) return '';

  if (edge.kind === 'sequence') {
    const leftToRight = from.x <= to.x;
    const startX = leftToRight ? from.x + from.w : from.x;
    const endX = leftToRight ? to.x : to.x + to.w;
    return `M ${startX} ${from.y + from.h / 2} H ${endX}`;
  }

  if (from.rank === to.rank) {
    const trackY = layout.routes.get(edge)?.trackY ?? from.y + from.h + 18 + (index % 5) * 8;
    return `M ${from.x + from.w / 2} ${from.y + from.h} V ${trackY} H ${to.x + to.w / 2} V ${to.y + to.h}`;
  }

  const above = from.y < to.y;
  const startY = above ? from.y + from.h : from.y;
  const endY = above ? to.y : to.y + to.h;
  const startX = from.x + from.w / 2;
  const endX = to.x + to.w / 2;
  const rankSpan = Math.abs((from.rank || 0) - (to.rank || 0));

  if (edge.kind === 'dependency' && rankSpan > 1) {
    const channelX = layout.routes.get(edge)?.channelX ?? layout.contentWidth + 18 + index * 8;
    const turnStart = startY + (above ? 18 : -18);
    const turnEnd = endY + (above ? -18 : 18);
    return `M ${startX} ${startY} V ${turnStart} H ${channelX} V ${turnEnd} H ${endX} V ${endY}`;
  }

  const middleY = layout.routes.get(edge)?.trackY ?? Math.round((startY + endY) / 2);
  return `M ${startX} ${startY} V ${middleY} H ${endX} V ${endY}`;
}
