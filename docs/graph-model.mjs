import {
  CATEGORY_ORDER,
  buildGraphModel as buildCoreGraphModel,
  edgePath,
  layoutGraph
} from './graph-model-core.mjs?v=core-20260823-1';

export { CATEGORY_ORDER, edgePath, layoutGraph };

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
