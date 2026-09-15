import {
  geometryForSolid,
  projectVertices,
  projectionEvents,
  viewFrame
} from './projection-core.js';

const TAU = Math.PI * 2;
const POSITION_TOLERANCE_FACTOR = 1e-5;
const attachedRoots = new WeakSet();
const activeGuideByRoot = new WeakMap();

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

  return { points, nodes, edgeCounts };
}

function groupedRadiusBands(nodes, tolerance) {
  const sorted = nodes
    .map((node, index) => ({ index, radius: Math.hypot(node.xy[0], node.xy[1]) }))
    .sort((a, b) => a.radius - b.radius);
  const bands = [];

  for (const item of sorted) {
    const current = bands.at(-1);
    if (!current || Math.abs(item.radius - current.radius) > tolerance) {
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

function reflectionTransform(axisAngle) {
  const cos = Math.cos(axisAngle * 2);
  const sin = Math.sin(axisAngle * 2);
  return ([x, y]) => [x * cos + y * sin, x * sin - y * cos];
}

function reflectionAxisAngles(nodes, edgeCounts, bands, tolerance) {
  const candidates = [];
  const addCandidate = angle => {
    const normalized = normalizeAxisAngle(angle);
    if (candidates.some(existing => axisAngleDistance(existing, normalized) < 1e-5)) return;
    candidates.push(normalized);
  };

  for (const band of bands) {
    if (band.radius <= tolerance) continue;
    const angles = band.nodeIndices.map(index => Math.atan2(nodes[index].xy[1], nodes[index].xy[0]));
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

  return candidates
    .filter(angle => preservesProjectedGraph(nodes, edgeCounts, reflectionTransform(angle), tolerance))
    .sort((a, b) => a - b);
}

function cross2d(origin, first, second) {
  return (first[0] - origin[0]) * (second[1] - origin[1])
    - (first[1] - origin[1]) * (second[0] - origin[0]);
}

function convexHullIndices(nodes, indices, areaTolerance) {
  if (indices.length <= 2) return indices.slice();
  const sorted = indices.slice().sort((a, b) => (
    nodes[a].xy[0] - nodes[b].xy[0] || nodes[a].xy[1] - nodes[b].xy[1]
  ));
  const lower = [];
  for (const index of sorted) {
    while (lower.length >= 2 && cross2d(
      nodes[lower.at(-2)].xy,
      nodes[lower.at(-1)].xy,
      nodes[index].xy
    ) <= areaTolerance) lower.pop();
    lower.push(index);
  }
  const upper = [];
  for (let position = sorted.length - 1; position >= 0; position -= 1) {
    const index = sorted[position];
    while (upper.length >= 2 && cross2d(
      nodes[upper.at(-2)].xy,
      nodes[upper.at(-1)].xy,
      nodes[index].xy
    ) <= areaTolerance) upper.pop();
    upper.push(index);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function nestedConvexLayers(nodes, tolerance) {
  let remaining = nodes.map((_, index) => index);
  const outerToInner = [];
  const scale = Math.max(1, ...nodes.map(node => Math.hypot(node.xy[0], node.xy[1])));
  const areaTolerance = tolerance * scale * 4;

  while (remaining.length) {
    const hull = convexHullIndices(nodes, remaining, areaTolerance);
    const layer = hull.length ? hull : remaining.slice(0, 1);
    outerToInner.push(layer);
    const removed = new Set(layer);
    remaining = remaining.filter(index => !removed.has(index));
  }

  return outerToInner.reverse();
}

export function analyzeProjectionGuides(vertices, edges, frame) {
  const { points, nodes, edgeCounts } = projectedVertexGraph(vertices, edges, frame);
  const radiusScale = Math.max(1, ...nodes.map(node => Math.hypot(node.xy[0], node.xy[1])));
  const tolerance = radiusScale * POSITION_TOLERANCE_FACTOR;
  const bands = groupedRadiusBands(nodes, tolerance * 4);
  const layers = nestedConvexLayers(nodes, tolerance * 4);

  return {
    points,
    symmetryAxisAngles: reflectionAxisAngles(nodes, edgeCounts, bands, tolerance * 8),
    layerRadii: layers.map(layer => Math.max(
      0,
      ...layer.map(index => Math.hypot(nodes[index].xy[0], nodes[index].xy[1]))
    ))
  };
}

function featureLabel(tag) {
  return tag.querySelector('b')?.textContent?.trim() || '';
}

function groupFeatureTags(featureLine) {
  const directTags = [...featureLine.children].filter(child => child.classList.contains('projection-feature-tag'));
  if (!directTags.length) return;

  const byLabel = new Map(directTags.map(tag => [featureLabel(tag), tag]));
  const groups = [
    ['중심 구조'],
    ['대칭축', '회전대칭'],
    ['방사층', '층별 점', '외곽 꼭짓점']
  ];
  if (!groups.flat().every(label => byLabel.has(label))) return;

  const fragment = document.createDocumentFragment();
  groups.forEach((labels, groupIndex) => {
    const group = document.createElement('span');
    group.className = 'projection-feature-group';
    group.dataset.featureGroup = String(groupIndex + 1);
    labels.forEach(label => {
      const tag = byLabel.get(label);
      tag.dataset.feature = label;
      if (label === '대칭축') {
        tag.dataset.guide = 'symmetry';
        tag.tabIndex = 0;
        tag.title = '호버하면 사영도에 대칭축을 표시합니다.';
      } else if (label === '방사층') {
        tag.dataset.guide = 'layers';
        tag.tabIndex = 0;
        tag.title = '호버하면 사영도에 방사층 동심원을 표시합니다.';
      }
      group.appendChild(tag);
    });
    fragment.appendChild(group);
  });
  featureLine.replaceChildren(fragment);
}

function ensureOverlay(root) {
  const stage = root.querySelector('.projection-stage');
  if (!stage) return null;
  let overlay = stage.querySelector('.projection-feature-overlay');
  if (!overlay) {
    overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlay.classList.add('projection-feature-overlay');
    overlay.setAttribute('aria-hidden', 'true');
    stage.appendChild(overlay);
  }
  return overlay;
}

let guideDataPromise;
function loadGuideData() {
  if (!guideDataPromise) {
    guideDataPromise = Promise.all([
      fetch('./data/projections.json', { cache: 'no-store' }).then(response => response.json()),
      fetch('./data/projection-views.json', { cache: 'no-store' }).then(response => response.json())
    ]).then(([projections, views]) => ({ projections, views }));
  }
  return guideDataPromise;
}

function currentProjection(root, data) {
  const solidName = root.querySelector('.projection-solid-tab.active span')?.textContent?.trim();
  const classId = Number(root.querySelector('.projection-class-chip.active')?.textContent?.trim());
  if (!solidName || !Number.isInteger(classId)) return null;
  const solid = data.projections.solids.find(item => item.name === solidName);
  const viewSolid = data.views.solids.find(item => item.name === solidName);
  const view = viewSolid?.views.find(candidate => candidate.classId === classId);
  if (!solid || !view) return null;
  return { solid, view };
}

function stageTransform(points, stage) {
  const rect = stage.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const minX = Math.min(...points.map(point => point[0]));
  const maxX = Math.max(...points.map(point => point[0]));
  const minY = Math.min(...points.map(point => point[1]));
  const maxY = Math.max(...points.map(point => point[1]));
  const span = Math.max(maxX - minX, maxY - minY, 1e-9);
  const padding = span * 0.15;
  const scale = Math.min(
    width / (maxX - minX + padding * 2),
    height / (maxY - minY + padding * 2)
  );
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return {
    width,
    height,
    span,
    scale,
    point: ([x, y]) => [
      width / 2 + (x - centerX) * scale,
      height / 2 - (y - centerY) * scale
    ]
  };
}

function svgNumber(value) {
  return Number(value.toFixed(2));
}

function renderSymmetryGuide(overlay, guide, transform) {
  const origin = transform.point([0, 0]);
  const halfLength = transform.span * 0.72;
  overlay.innerHTML = guide.symmetryAxisAngles.map(angle => {
    const direction = [Math.cos(angle) * halfLength, Math.sin(angle) * halfLength];
    const start = transform.point([-direction[0], -direction[1]]);
    const end = transform.point(direction);
    return `<line class="projection-guide-axis" x1="${svgNumber(start[0])}" y1="${svgNumber(start[1])}" x2="${svgNumber(end[0])}" y2="${svgNumber(end[1])}" />`;
  }).join('') + `<circle class="projection-guide-origin" cx="${svgNumber(origin[0])}" cy="${svgNumber(origin[1])}" r="3.5" />`;
}

function renderLayerGuide(overlay, guide, transform) {
  const origin = transform.point([0, 0]);
  const renderedRadii = [];
  guide.layerRadii.forEach((radius, index) => {
    let screenRadius = radius * transform.scale;
    if (screenRadius < 7) screenRadius = 7 + index * 5;
    while (renderedRadii.some(existing => Math.abs(existing - screenRadius) < 4)) screenRadius += 5;
    renderedRadii.push(screenRadius);
  });
  overlay.innerHTML = renderedRadii.map((radius, index) => `
    <circle class="projection-guide-ring" cx="${svgNumber(origin[0])}" cy="${svgNumber(origin[1])}" r="${svgNumber(radius)}" />
    <text class="projection-guide-label" x="${svgNumber(origin[0] + radius + 4)}" y="${svgNumber(origin[1] - 4)}">${index + 1}</text>
  `).join('');
}

async function showGuide(root, kind) {
  const overlay = ensureOverlay(root);
  const stage = root.querySelector('.projection-stage');
  if (!overlay || !stage) return;
  activeGuideByRoot.set(root, kind);
  const data = await loadGuideData();
  if (activeGuideByRoot.get(root) !== kind) return;
  const selected = currentProjection(root, data);
  if (!selected) return;
  const geometry = geometryForSolid(selected.solid.name);
  const guide = analyzeProjectionGuides(
    geometry.vertices,
    geometry.edges,
    viewFrame(selected.view.viewDirection, selected.view.rollDegrees)
  );
  const transform = stageTransform(guide.points, stage);
  overlay.setAttribute('viewBox', `0 0 ${transform.width} ${transform.height}`);
  overlay.dataset.guide = kind;
  if (kind === 'symmetry') renderSymmetryGuide(overlay, guide, transform);
  else renderLayerGuide(overlay, guide, transform);
  overlay.classList.add('is-visible');
}

function hideGuide(root, kind = null) {
  if (kind && activeGuideByRoot.get(root) !== kind) return;
  activeGuideByRoot.delete(root);
  const overlay = root.querySelector('.projection-feature-overlay');
  if (!overlay) return;
  overlay.classList.remove('is-visible');
  overlay.removeAttribute('data-guide');
  overlay.replaceChildren();
}

function guideTarget(root, target) {
  if (!(target instanceof Element)) return null;
  const tag = target.closest('.projection-feature-tag[data-guide]');
  return tag && root.contains(tag) ? tag : null;
}

function attachRoot(root) {
  if (attachedRoots.has(root)) return;
  attachedRoots.add(root);
  ensureOverlay(root);

  const sync = () => {
    const featureLine = root.querySelector('.projection-feature-line');
    if (featureLine) groupFeatureTags(featureLine);
  };
  sync();
  new MutationObserver(sync).observe(root, { childList: true, subtree: true });

  root.addEventListener('pointerover', event => {
    const tag = guideTarget(root, event.target);
    if (!tag || (event.relatedTarget instanceof Node && tag.contains(event.relatedTarget))) return;
    showGuide(root, tag.dataset.guide);
  });
  root.addEventListener('pointerout', event => {
    const tag = guideTarget(root, event.target);
    if (!tag || (event.relatedTarget instanceof Node && tag.contains(event.relatedTarget))) return;
    hideGuide(root, tag.dataset.guide);
  });
  root.addEventListener('focusin', event => {
    const tag = guideTarget(root, event.target);
    if (tag) showGuide(root, tag.dataset.guide);
  });
  root.addEventListener('focusout', event => {
    const tag = guideTarget(root, event.target);
    if (tag) hideGuide(root, tag.dataset.guide);
  });

  const stage = root.querySelector('.projection-stage');
  if (stage && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      const kind = activeGuideByRoot.get(root);
      if (kind) showGuide(root, kind);
    }).observe(stage);
  }
}

export function mountProjectionFeatureGuides() {
  if (typeof document === 'undefined') return;
  const scan = () => document.querySelectorAll('#projectionSelectorPrototype').forEach(attachRoot);
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountProjectionFeatureGuides, { once: true });
  } else {
    mountProjectionFeatureGuides();
  }
}
