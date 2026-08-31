import {
  CATEGORY_ORDER,
  buildGraphModel as buildCoreGraphModel,
  edgePath as coreEdgePath,
  layoutGraph as coreLayoutGraph
} from './graph-model-core.mjs?v=core-20260823-1';

export { CATEGORY_ORDER };

const STAT_ROOT_ID = 'character-stats';
const STAT_PANEL_W = 220;
const STAT_HEADER_H = 42;
const STAT_ROW_H = 42;
const STAT_SIDE_GAP = 36;
const LAYOUT_MARGIN = 26;

function statHierarchy(model) {
  return model.hierarchy
    .filter(edge => edge.from === STAT_ROOT_ID && edge.relationType === 'stat')
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

function stripStatGroup(model, statSet) {
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

  const coreModel = buildCoreGraphModel([...systems, ...virtualSystems], relationships);
  const statEdges = statHierarchy(coreModel);
  const statIds = statEdges.map(edge => edge.to);
  const statKeys = new Set(statEdges.map(edge => `${edge.from}::${edge.to}`));
  const withoutStatTree = edge => !statKeys.has(`${edge.from}::${edge.to}`);

  const model = {
    ...coreModel,
    hierarchy: coreModel.hierarchy.filter(withoutStatTree),
    rankEdges: coreModel.rankEdges.filter(withoutStatTree),
    edges: coreModel.edges.filter(withoutStatTree),
    statGroup: statIds.length ? { rootId: STAT_ROOT_ID, childIds: statIds } : null
  };

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

  return {
    ...model,
    dependency: [...model.dependency, ...crossLinks],
    edges: [...model.edges, ...crossLinks]
  };
}

export function layoutGraph(model) {
  const childIds = (model.statGroup?.childIds || [])
    .filter(id => model.systems.some(system => system.id === id));
  const hasStatRoot = model.systems.some(system => system.id === STAT_ROOT_ID);

  if (!hasStatRoot || !childIds.length) {
    return coreLayoutGraph(model);
  }

  const statSet = new Set([STAT_ROOT_ID, ...childIds]);
  const mainLayout = coreLayoutGraph(stripStatGroup(model, statSet));
  const nodes = new Map([...mainLayout.nodes].map(([id, node]) => [id, { ...node }]));
  const topRank = [...nodes.values()].filter(node => node.rank === 0);
  const panelY = topRank.length ? Math.min(...topRank.map(node => node.y)) : 24;
  const mainRight = nodes.size
    ? Math.max(...[...nodes.values()].map(node => node.x + node.w))
    : LAYOUT_MARGIN;
  const routeRight = Math.max(0, ...[...mainLayout.routes.values()]
    .map(route => Number(route.channelX) || 0));
  const panelX = Math.max(mainRight + STAT_SIDE_GAP, routeRight ? routeRight + 18 : 0);

  nodes.set(STAT_ROOT_ID, {
    x: panelX,
    y: panelY,
    w: STAT_PANEL_W,
    h: STAT_HEADER_H,
    rank: null
  });

  childIds.forEach((id, index) => {
    nodes.set(id, {
      x: panelX,
      y: panelY + STAT_HEADER_H + index * STAT_ROW_H,
      w: STAT_PANEL_W,
      h: STAT_ROW_H,
      rank: null
    });
  });

  const ranks = new Map(mainLayout.ranks);
  ranks.set(STAT_ROOT_ID, null);
  childIds.forEach(id => ranks.set(id, null));

  const panelH = STAT_HEADER_H + childIds.length * STAT_ROW_H;
  const panelRight = panelX + STAT_PANEL_W;
  const panelBottom = panelY + panelH;

  return {
    ...mainLayout,
    nodes,
    ranks,
    width: Math.max(mainLayout.width, panelRight + LAYOUT_MARGIN),
    contentWidth: Math.max(mainLayout.contentWidth, panelRight + LAYOUT_MARGIN),
    height: Math.max(mainLayout.height, panelBottom + 22),
    statGroup: {
      rootId: STAT_ROOT_ID,
      childIds,
      x: panelX,
      y: panelY,
      w: STAT_PANEL_W,
      h: panelH
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
  if (edge.layoutNeutral) {
    return crossLinkPath(edge, layout);
  }

  return coreEdgePath(edge, layout, index);
}
