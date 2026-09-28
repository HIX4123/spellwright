import { escapeHtml } from './html.js';
import {
  projectVertices,
  projectionEvents
} from './projection-core.js?v=ponytail-20260928-1';
import { analyzeProjectionStructure, convexHullIndices, groupedRadiusBands } from './projection-geometry-analysis.js?v=ponytail-20260928-1';

const TAU = Math.PI * 2;
const ANGLE_TOLERANCE = 0.012;
const POSITION_TOLERANCE_FACTOR = 1e-5;

function edgeKey(a, b) {
  return a <= b ? `${a}:${b}` : `${b}:${a}`;
}

function projectedVertexGraph(vertices, edges, frame) {
  const points = projectVertices(vertices, frame);
  const vertexEvents = projectionEvents(points, edges).filter(event => event.vertexIds.size > 0);
  const nodes = vertexEvents.map(event => ({
    xy: event.xy.slice(),
    vertexIds: [...event.vertexIds]
  }));
  const vertexToNode = new Map();
  nodes.forEach((node, nodeIndex) => {
    node.vertexIds.forEach(vertexId => vertexToNode.set(vertexId, nodeIndex));
  });

  const edgeCounts = new Map();
  edges.forEach(([a, b]) => {
    const from = vertexToNode.get(a);
    const to = vertexToNode.get(b);
    if (!Number.isInteger(from) || !Number.isInteger(to)) return;
    const key = edgeKey(from, to);
    edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
  });
  return { nodes, edgeCounts };
}

function regularCycleSides(nodes, edgeCounts, band, tolerance) {
  if (!band || band.radius <= tolerance || band.nodeIndices.length < 3) return 0;
  const ordered = band.nodeIndices
    .map(index => ({ index, angle: Math.atan2(nodes[index].xy[1], nodes[index].xy[0]) }))
    .sort((a, b) => a.angle - b.angle);
  const expectedGap = TAU / ordered.length;
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const next = ordered[(index + 1) % ordered.length];
    let gap = next.angle - current.angle;
    if (gap <= 0) gap += TAU;
    if (Math.abs(gap - expectedGap) > ANGLE_TOLERANCE) return 0;
    if (!edgeCounts.has(edgeKey(current.index, next.index))) return 0;
  }
  return ordered.length;
}

export function analyzeProjectionFeatures(vertices, edges, frame, structure = analyzeProjectionStructure(vertices, edges, frame)) {
  const { nodes, edgeCounts } = projectedVertexGraph(vertices, edges, frame);
  const radiusScale = Math.max(1, ...nodes.map(node => Math.hypot(node.xy[0], node.xy[1])));
  const tolerance = radiusScale * POSITION_TOLERANCE_FACTOR;
  const radiusBands = groupedRadiusBands(nodes, tolerance * 4);
  const centerBand = radiusBands[0];
  const hasCenterPoint = Boolean(centerBand && centerBand.radius <= tolerance * 4);
  const polygonSides = hasCenterPoint || radiusBands.length < 2
    ? 0
    : regularCycleSides(nodes, edgeCounts, centerBand, tolerance * 4);
  const centerStructure = hasCenterPoint
    ? { kind: 'point' }
    : polygonSides >= 3
      ? { kind: 'regularPolygon', sides: polygonSides }
      : { kind: 'none' };

  return {
    centerStructure,
    symmetryAxes: structure.symmetryAxisAngles.length,
    rotationalOrder: structure.rotationalOrder,
    radialLayers: structure.layers.length,
    layerPointCounts: structure.layerPointCounts,
    convexHullLayers: structure.convexHullLayers.length,
    convexHullLayerPointCounts: structure.convexHullLayerPointCounts,
    hullVertices: convexHullIndices(nodes, nodes.map((_, index) => index), tolerance * radiusScale * 4).length,
    eulerTrail: structure.eulerTrail,
    oddDegreeVertices: structure.oddDegreeVertices
  };
}

export function projectionFeatureItems(features) {
  const centerValue = features.centerStructure.kind === 'point'
    ? '중심점'
    : features.centerStructure.kind === 'regularPolygon'
      ? `정${features.centerStructure.sides}각핵`
      : '없음';
  return [
    ['중심 구조', centerValue],
    ['대칭축', String(features.symmetryAxes)],
    ['회전대칭', `${features.rotationalOrder}차`],
    ['동심차수', `${features.radialLayers}층`],
    ['Convex Hull', `${features.convexHullLayers}층`],
    ['동심 층별 점', features.layerPointCounts.join('-')],
    ['외곽 꼭짓점', String(features.hullVertices)],
    ['Euler Trail', features.eulerTrail ? '가능' : '불가']
  ];
}

export function projectionHashtags(features) {
  const tags = [];
  if (features.centerStructure.kind === 'point') tags.push('#중심점');
  if (features.centerStructure.kind === 'regularPolygon') tags.push(`#정${features.centerStructure.sides}각핵`);
  if (features.symmetryAxes > 0) tags.push(features.symmetryAxes % 2 === 0 ? '#짝수대칭' : '#홀수대칭');
  if (features.radialLayers <= 3) tags.push('#동심차수3층이내');
  else if (features.radialLayers <= 5) tags.push('#동심차수5층이내');
  return tags;
}

function ensureFeatureUi(root) {
  let featureLine = root.querySelector('.projection-feature-line');
  if (!featureLine) {
    featureLine = document.createElement('div');
    featureLine.className = 'projection-feature-line';
    featureLine.setAttribute('aria-label', '사영 구조 태그');
    root.querySelector('.projection-role-copy')?.before(featureLine);
  }
  let hashtagBlock = root.querySelector('.projection-hashtag-block');
  if (!hashtagBlock) {
    hashtagBlock = document.createElement('div');
    hashtagBlock.className = 'projection-hashtag-block';
    hashtagBlock.setAttribute('aria-label', '사영 분류 해시태그');
    root.querySelector('.projection-stage')?.appendChild(hashtagBlock);
  }
  return { featureLine, hashtagBlock };
}

export function renderProjectionFeatureTags(root, geometry, frame, structure) {
  const features = analyzeProjectionFeatures(geometry.vertices, geometry.edges, frame, structure);
  const { featureLine, hashtagBlock } = ensureFeatureUi(root);
  featureLine.innerHTML = projectionFeatureItems(features).map(([label, value]) => `
    <span class="projection-feature-tag"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></span>
  `).join('');
  const hashtags = projectionHashtags(features);
  hashtagBlock.innerHTML = hashtags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('');
  hashtagBlock.hidden = hashtags.length === 0;
}
