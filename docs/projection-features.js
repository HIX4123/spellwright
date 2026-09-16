import {
  geometryForSolid,
  projectVertices,
  projectionEvents,
  viewFrame
} from './projection-core.js';
import { analyzeProjectionStructure } from './projection-geometry-analysis.js?v=projection-symmetry-20260916-2';

const TAU = Math.PI * 2;
const ANGLE_TOLERANCE = 0.012;
const POSITION_TOLERANCE_FACTOR = 1e-5;

function edgeKey(a, b) {
  return a <= b ? `${a}:${b}` : `${b}:${a}`;
}

function nearlyEqual(a, b, tolerance) {
  return Math.abs(a - b) <= tolerance;
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

function groupedRadiusBands(nodes, tolerance) {
  const sorted = nodes
    .map((node, index) => ({ index, radius: Math.hypot(node.xy[0], node.xy[1]) }))
    .sort((a, b) => a.radius - b.radius);
  const bands = [];
  for (const item of sorted) {
    const current = bands.at(-1);
    if (!current || !nearlyEqual(item.radius, current.radius, tolerance)) {
      bands.push({ radius: item.radius, nodeIndices: [item.index] });
      continue;
    }
    current.nodeIndices.push(item.index);
    current.radius = current.nodeIndices.reduce((sum, nodeIndex) => {
      const [x, y] = nodes[nodeIndex].xy;
      return sum + Math.hypot(x, y);
    }, 0) / current.nodeIndices.length;
  }
  return bands;
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

function cross2d(origin, first, second) {
  return (first[0] - origin[0]) * (second[1] - origin[1])
    - (first[1] - origin[1]) * (second[0] - origin[0]);
}

function convexHullVertexCount(nodes, tolerance) {
  if (nodes.length <= 2) return nodes.length;
  const sorted = nodes.map(node => node.xy.slice()).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross2d(lower.at(-2), lower.at(-1), point) <= tolerance) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (upper.length >= 2 && cross2d(upper.at(-2), upper.at(-1), point) <= tolerance) upper.pop();
    upper.push(point);
  }
  return Math.max(1, lower.length + upper.length - 2);
}

export function analyzeProjectionFeatures(vertices, edges, frame) {
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
  const structure = analyzeProjectionStructure(vertices, edges, frame);

  return {
    centerStructure,
    symmetryAxes: structure.symmetryAxisAngles.length,
    rotationalOrder: structure.rotationalOrder,
    radialLayers: structure.layers.length,
    layerPointCounts: structure.layerPointCounts,
    hullVertices: convexHullVertexCount(nodes, tolerance * radiusScale * 4)
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
    ['방사층', String(features.radialLayers)],
    ['층별 점', features.layerPointCounts.join('-')],
    ['외곽 꼭짓점', String(features.hullVertices)]
  ];
}

export function projectionHashtags(features) {
  const tags = [];
  if (features.centerStructure.kind === 'point') tags.push('#중심점');
  if (features.centerStructure.kind === 'regularPolygon') tags.push(`#정${features.centerStructure.sides}각핵`);
  if (features.symmetryAxes > 0) tags.push(features.symmetryAxes % 2 === 0 ? '#짝수대칭' : '#홀수대칭');
  if (features.radialLayers <= 3) tags.push('#극저층형');
  else if (features.radialLayers <= 5) tags.push('#저층형');
  return tags;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

let featureDataPromise;
function loadFeatureData() {
  if (!featureDataPromise) {
    featureDataPromise = Promise.all([
      fetch('./data/projections.json', { cache: 'no-store' }).then(response => response.json()),
      fetch('./data/projection-views.json', { cache: 'no-store' }).then(response => response.json())
    ]).then(([projections, views]) => ({ projections, views }));
  }
  return featureDataPromise;
}

function currentProjection(root, data) {
  const solidName = root.querySelector('.projection-solid-tab.active span')?.textContent?.trim();
  const classId = Number(root.querySelector('.projection-class-chip.active')?.textContent?.trim());
  if (!solidName || !Number.isInteger(classId)) return null;
  const solid = data.projections.solids.find(item => item.name === solidName);
  const viewSolid = data.views.solids.find(item => item.name === solidName);
  const item = solid?.classes.find(candidate => candidate.id === classId);
  const view = viewSolid?.views.find(candidate => candidate.classId === classId);
  if (!solid || !item || !view) return null;
  return { solid, item, view };
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

function renderFeatureUi(root, data) {
  const selected = currentProjection(root, data);
  if (!selected) return;
  const geometry = geometryForSolid(selected.solid.name);
  const features = analyzeProjectionFeatures(
    geometry.vertices,
    geometry.edges,
    viewFrame(selected.view.viewDirection, selected.view.rollDegrees)
  );
  const { featureLine, hashtagBlock } = ensureFeatureUi(root);
  featureLine.innerHTML = projectionFeatureItems(features).map(([label, value]) => `
    <span class="projection-feature-tag"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></span>
  `).join('');
  const hashtags = projectionHashtags(features);
  hashtagBlock.innerHTML = hashtags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('');
  hashtagBlock.hidden = hashtags.length === 0;
}

const attachedSelectors = new WeakSet();
function attachSelector(root, data) {
  if (attachedSelectors.has(root)) return;
  attachedSelectors.add(root);
  let queued = false;
  const update = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      renderFeatureUi(root, data);
    });
  };
  const stage = root.querySelector('.projection-stage');
  const tabs = root.querySelector('.projection-solid-tabs');
  const rail = root.querySelector('.projection-class-rail');
  if (stage) new MutationObserver(update).observe(stage, { attributes: true, attributeFilter: ['aria-valuetext'] });
  if (tabs) new MutationObserver(update).observe(tabs, { attributes: true, subtree: true, attributeFilter: ['aria-selected'] });
  if (rail) new MutationObserver(update).observe(rail, { childList: true });
  update();
}

export async function mountProjectionFeatureTags() {
  if (typeof document === 'undefined') return;
  const data = await loadFeatureData();
  const scan = () => document.querySelectorAll('#projectionSelectorPrototype').forEach(root => attachSelector(root, data));
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mountProjectionFeatureTags(), { once: true });
  } else {
    mountProjectionFeatureTags();
  }
}
