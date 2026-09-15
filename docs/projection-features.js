import {
  geometryForSolid,
  projectVertices,
  projectionEvents,
  viewFrame
} from './projection-core.js';

const TAU = Math.PI * 2;
const ANGLE_TOLERANCE = 0.012;
const POSITION_TOLERANCE_FACTOR = 1e-5;

function edgeKey(a, b) {
  return a <= b ? `${a}:${b}` : `${b}:${a}`;
}

function normalizeAxisAngle(angle) {
  let normalized = angle % Math.PI;
  if (normalized < 0) normalized += Math.PI;
  return normalized;
}

function axisAngleDistance(a, b) {
  const diff = Math.abs(normalizeAxisAngle(a) - normalizeAxisAngle(b));
  return Math.min(diff, Math.PI - diff);
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

function groupedRadialLayers(nodes, tolerance) {
  const sorted = nodes
    .map((node, index) => ({ index, radius: Math.hypot(node.xy[0], node.xy[1]) }))
    .sort((a, b) => a.radius - b.radius);
  const layers = [];

  for (const item of sorted) {
    const current = layers.at(-1);
    if (!current || !nearlyEqual(item.radius, current.radius, tolerance)) {
      layers.push({ radius: item.radius, nodeIndices: [item.index] });
      continue;
    }
    current.nodeIndices.push(item.index);
    current.radius = current.nodeIndices.reduce((sum, nodeIndex) => {
      const [x, y] = nodes[nodeIndex].xy;
      return sum + Math.hypot(x, y);
    }, 0) / current.nodeIndices.length;
  }

  return layers;
}

function transformedNodeMap(nodes, transform, tolerance) {
  const mapping = new Array(nodes.length).fill(-1);
  const used = new Set();

  for (let index = 0; index < nodes.length; index += 1) {
    const target = transform(nodes[index].xy);
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let candidate = 0; candidate < nodes.length; candidate += 1) {
      const dx = nodes[candidate].xy[0] - target[0];
      const dy = nodes[candidate].xy[1] - target[1];
      const distance = Math.hypot(dx, dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = candidate;
      }
    }
    if (bestDistance > tolerance || used.has(bestIndex)) return null;
    mapping[index] = bestIndex;
    used.add(bestIndex);
  }

  return mapping;
}

function preservesProjectedGraph(nodes, edgeCounts, transform, tolerance) {
  const mapping = transformedNodeMap(nodes, transform, tolerance);
  if (!mapping) return false;

  const transformedEdges = new Map();
  for (const [key, count] of edgeCounts) {
    const [a, b] = key.split(':').map(Number);
    const transformedKey = edgeKey(mapping[a], mapping[b]);
    transformedEdges.set(transformedKey, (transformedEdges.get(transformedKey) || 0) + count);
  }
  if (transformedEdges.size !== edgeCounts.size) return false;
  for (const [key, count] of edgeCounts) {
    if (transformedEdges.get(key) !== count) return false;
  }
  return true;
}

function rotationTransform(angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return ([x, y]) => [x * cos - y * sin, x * sin + y * cos];
}

function reflectionTransform(axisAngle) {
  const cos = Math.cos(axisAngle * 2);
  const sin = Math.sin(axisAngle * 2);
  return ([x, y]) => [x * cos + y * sin, x * sin - y * cos];
}

function rotationalOrder(nodes, edgeCounts, tolerance) {
  for (let order = 12; order >= 2; order -= 1) {
    if (preservesProjectedGraph(nodes, edgeCounts, rotationTransform(TAU / order), tolerance)) {
      return order;
    }
  }
  return 1;
}

function reflectionAxisCount(nodes, edgeCounts, layers, tolerance) {
  const candidates = [];
  const addCandidate = angle => {
    const normalized = normalizeAxisAngle(angle);
    if (candidates.some(existing => axisAngleDistance(existing, normalized) < 1e-5)) return;
    candidates.push(normalized);
  };

  for (const layer of layers) {
    if (layer.radius <= tolerance) continue;
    const angles = layer.nodeIndices.map(index => Math.atan2(nodes[index].xy[1], nodes[index].xy[0]));
    for (let first = 0; first < angles.length; first += 1) {
      for (let second = first; second < angles.length; second += 1) {
        const doubledAxis = Math.atan2(
          Math.sin(angles[first] + angles[second]),
          Math.cos(angles[first] + angles[second])
        );
        addCandidate(doubledAxis / 2);
      }
    }
  }

  return candidates.filter(angle => (
    preservesProjectedGraph(nodes, edgeCounts, reflectionTransform(angle), tolerance)
  )).length;
}

function regularCycleSides(nodes, edgeCounts, layer, tolerance) {
  if (!layer || layer.radius <= tolerance || layer.nodeIndices.length < 3) return 0;
  const ordered = layer.nodeIndices
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

function convexHullVertexCount(nodes, tolerance) {
  if (nodes.length <= 2) return nodes.length;
  const points = nodes.map(node => node.xy.slice()).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  );
  const lower = [];
  for (const point of points) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= tolerance) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= tolerance) upper.pop();
    upper.push(point);
  }
  return Math.max(1, lower.length + upper.length - 2);
}

export function analyzeProjectionFeatures(vertices, edges, frame) {
  const { nodes, edgeCounts } = projectedVertexGraph(vertices, edges, frame);
  const radiusScale = Math.max(1, ...nodes.map(node => Math.hypot(node.xy[0], node.xy[1])));
  const tolerance = radiusScale * POSITION_TOLERANCE_FACTOR;
  const layers = groupedRadialLayers(nodes, tolerance * 4);
  const centerLayer = layers[0];
  const hasCenterPoint = Boolean(centerLayer && centerLayer.radius <= tolerance * 4);
  const polygonSides = hasCenterPoint ? 0 : regularCycleSides(nodes, edgeCounts, centerLayer, tolerance * 4);
  const centerStructure = hasCenterPoint
    ? { kind: 'point' }
    : polygonSides >= 3
      ? { kind: 'regularPolygon', sides: polygonSides }
      : { kind: 'none' };

  return {
    centerStructure,
    symmetryAxes: reflectionAxisCount(nodes, edgeCounts, layers, tolerance * 8),
    rotationalOrder: rotationalOrder(nodes, edgeCounts, tolerance * 8),
    radialLayers: layers.length,
    layerPointCounts: layers.map(layer => layer.nodeIndices.length),
    hullVertices: convexHullVertexCount(nodes, tolerance * tolerance * 4)
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
  if (features.centerStructure.kind === 'regularPolygon') {
    tags.push(`#정${features.centerStructure.sides}각핵`);
  }
  if (features.symmetryAxes > 0) {
    tags.push(features.symmetryAxes % 2 === 0 ? '#짝수대칭' : '#홀수대칭');
  }
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
  const scan = () => {
    document.querySelectorAll('#projectionSelectorPrototype').forEach(root => attachSelector(root, data));
  };
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
