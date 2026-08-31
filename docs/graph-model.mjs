import {
  CATEGORY_ORDER,
  buildGraphModel as buildCoreGraphModel,
  edgePath as coreEdgePath,
  layoutGraph as coreLayoutGraph
} from './graph-model-core.mjs?v=core-20260823-1';

export { CATEGORY_ORDER };

const STAT_ROOT_ID = 'character-stats';
const STAT_SIDE_GAP = 36;
const STAT_ITEM_GAP = 12;
const STAT_ROOT_GAP = 28;
const STAT_TRUNK_GAP = 14;
const LAYOUT_MARGIN = 26;

function orderedStatIds(model) {
  return model.hierarchy
    .filter(edge => edge.from === STAT_ROOT_ID && edge.relationType === 'stat')
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(edge => edge.to);
}

function stripStatTree(model, statSet) {
  const keepsEdge = edge => !statSet.has(edge.from) && !statSet.has(edge.to);
  return {
    ...model,
    systems: model.systems.filter(system => !statSet.has(system.id)),
    hierarchy: model.hierarchy.filter(keepsEdge),
    dependency: model.dependency.filter(edge => keepsEdge(edge) && !edge.layoutNeutral),
    sequence: model.sequence.filter(keepsEdge),
    rankEdges: model.rankEdges.filter(keepsEdge),
    edges: model.edges.filter(edge => keepsEdge(edge) && !edge.layoutNeutral)
  };
}

export function buildGraphModel(systems, relationships = {}) {
  const suppliedIds = new Set(systems.map(system => system.id));
  const virtualSystems = (relationships.virtualSystems || [])
    .filter(system => !system.anchor || suppliedIds.has(system.anchor))
    .filter(system => !suppliedIds.has(system.id))
    .map(system => ({ ...system, dependencies: system.dependencies || [] }));

  const model = buildCoreGraphModel([...systems, ...virtualSystems], relationships);
  const visibleIds = new Set(model.systems.map(system => system.id));
  const existingEdges = new Set(model.edges.map(edge => `${edge.from}::${edge.to}`));

  const crossLinks = (relationships.crossLinks || [])
    .filter(edge => visibleIds.has(edge.from) && visibleIds.has(edge.to))
    .filter(edge => !existingEdges.has(`${edge.from}::${edge.to}`))
    .map(edge => ({
      from: edge.from,
      to: edge.to,
      kind: 'dependency',
      relationType: edge.type || 'cross-link',
      layoutNeutral: true,
      mutual: Boolean(edge.mutual)
    }));

  if (!crossLinks.length) return model;

  return {
    ...model,
    dependency: [...model.dependency, ...crossLinks],
    edges: [...model.edges, ...crossLinks]
  };
}

export function layoutGraph(model) {
  const childIds = orderedStatIds(model)
    .filter(id => model.systems.some(system => system.id === id));
  const hasStatRoot = model.systems.some(system => system.id === STAT_ROOT_ID);

  if (!hasStatRoot || !childIds.length) {
    return coreLayoutGraph(model);
  }

  const statSet = new Set([STAT_ROOT_ID, ...childIds]);
  const mainLayout = coreLayoutGraph(stripStatTree(model, statSet));
  const nodes = new Map([...mainLayout.nodes].map(([id, node]) => [id, { ...node }]));
  const sample = [...nodes.values()][0] || { w: 148, h: 58 };
  const topRank = [...nodes.values()].filter(node => node.rank === 0);
  const topY = topRank.length ? Math.min(...topRank.map(node => node.y)) : 24;
  const mainRight = nodes.size
    ? Math.max(...[...nodes.values()].map(node => node.x + node.w))
    : LAYOUT_MARGIN;
  const statX = mainRight + STAT_SIDE_GAP;
  const nodeW = sample.w || 148;
  const nodeH = sample.h || 58;

  nodes.set(STAT_ROOT_ID, {
    x: statX,
    y: topY,
    w: nodeW,
    h: nodeH,
    rank: 0
  });

  const firstChildY = topY + nodeH + STAT_ROOT_GAP;
  childIds.forEach((id, index) => {
    nodes.set(id, {
      x: statX,
      y: firstChildY + index * (nodeH + STAT_ITEM_GAP),
      w: nodeW,
      h: nodeH,
      rank: 1
    });
  });

  const ranks = new Map(mainLayout.ranks);
  ranks.set(STAT_ROOT_ID, 0);
  childIds.forEach(id => ranks.set(id, 1));

  const statBottom = firstChildY
    + (childIds.length - 1) * (nodeH + STAT_ITEM_GAP)
    + nodeH;
  const trunkX = statX + nodeW + STAT_TRUNK_GAP;
  const compactWidth = trunkX + LAYOUT_MARGIN;

  return {
    ...mainLayout,
    nodes,
    ranks,
    width: Math.max(mainLayout.width, compactWidth),
    contentWidth: Math.max(mainLayout.contentWidth, compactWidth),
    height: Math.max(mainLayout.height, statBottom + 22),
    statTree: {
      rootId: STAT_ROOT_ID,
      childIds,
      trunkX
    }
  };
}

function crossLinkPath(edge, layout) {
  const from = layout.nodes.get(edge.from);
  const to = layout.nodes.get(edge.to);
  if (!from || !to) return '';

  const fromCenterX = from.x + from.w / 2;
  const toCenterX = to.x + to.w / 2;
  const towardRight = toCenterX >= fromCenterX;
  const startX = towardRight ? from.x + from.w : from.x;
  const endX = towardRight ? to.x : to.x + to.w;
  const startY = from.y + from.h / 2;
  const endY = to.y + to.h / 2;
  const middleX = Math.round((startX + endX) / 2);

  return `M ${startX} ${startY} H ${middleX} V ${endY} H ${endX}`;
}

export function edgePath(edge, layout, index = 0) {
  if (layout.statTree
    && edge.kind === 'hierarchy'
    && edge.from === layout.statTree.rootId
    && layout.statTree.childIds.includes(edge.to)) {
    const root = layout.nodes.get(edge.from);
    const child = layout.nodes.get(edge.to);
    if (!root || !child) return '';

    const startX = root.x + root.w / 2;
    const startY = root.y + root.h;
    const elbowY = startY + 14;
    const endX = child.x + child.w;
    const endY = child.y + child.h / 2;

    return `M ${startX} ${startY} V ${elbowY} H ${layout.statTree.trunkX} V ${endY} H ${endX}`;
  }

  if (edge.layoutNeutral) {
    return crossLinkPath(edge, layout);
  }

  return coreEdgePath(edge, layout, index);
}
