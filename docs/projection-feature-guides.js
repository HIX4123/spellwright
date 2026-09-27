import { analyzeProjectionStructure } from './projection-geometry-analysis.js?v=convex-hull-layers-20260927-1';

const activeGuideByRoot = new WeakMap();
const guideByRoot = new WeakMap();

export function analyzeProjectionGuides(vertices, edges, frame, structure = analyzeProjectionStructure(vertices, edges, frame)) {
  return {
    points: structure.points,
    symmetryAxisAngles: structure.symmetryAxisAngles,
    layerCenter: structure.circleCenter,
    layerRadii: structure.circleRadii,
    layerPointCounts: structure.layerPointCounts,
    hullLayers: structure.convexHullLayers.map(layer => (
      layer.map(index => structure.nodes[index].xy.slice())
    )),
    hullLayerPointCounts: structure.convexHullLayerPointCounts
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
    ['동심차수', 'Convex Hull', '동심 층별 점', '외곽 꼭짓점'],
    ['Euler Trail']
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
      } else if (label === '동심차수') {
        tag.dataset.guide = 'layers';
        tag.tabIndex = 0;
        tag.title = '호버하면 사영도에 동심차수의 원형 층을 표시합니다.';
      } else if (label === 'Convex Hull') {
        tag.dataset.guide = 'hull';
        tag.tabIndex = 0;
        tag.title = '호버하면 onion decomposition의 Convex Hull 껍질을 표시합니다.';
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

export function screenLayerRadii(layerRadii, scale) {
  return layerRadii.map(radius => radius * scale);
}

function renderLayerGuide(overlay, guide, transform) {
  const center = transform.point(guide.layerCenter);
  const renderedRadii = screenLayerRadii(guide.layerRadii, transform.scale);
  const labelOffsets = [-9, -3, 3, 9];

  overlay.innerHTML = renderedRadii.map((radius, index) => `
    <circle class="projection-guide-ring" cx="${svgNumber(center[0])}" cy="${svgNumber(center[1])}" r="${svgNumber(radius)}" />
    <text class="projection-guide-label"
      x="${svgNumber(center[0] + radius + 4)}"
      y="${svgNumber(center[1] + labelOffsets[index % labelOffsets.length])}">${index + 1}</text>
  `).join('');
}

function hullCross(origin, first, second) {
  return (first[0] - origin[0]) * (second[1] - origin[1])
    - (first[1] - origin[1]) * (second[0] - origin[0]);
}

export function orderedHullBoundary(points) {
  if (points.length <= 2) return points.map(point => point.slice());
  const sorted = points.map(point => point.slice()).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && hullCross(lower.at(-2), lower.at(-1), point) <= 1e-10) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (upper.length >= 2 && hullCross(upper.at(-2), upper.at(-1), point) <= 1e-10) upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function renderHullGuide(overlay, guide, transform) {
  overlay.innerHTML = guide.hullLayers.map((layer, index) => {
    const boundary = orderedHullBoundary(layer);
    const screen = boundary.map(transform.point);
    if (!screen.length) return '';
    const depth = index + 1;
    const label = `<text class="projection-guide-label projection-guide-hull-label"
      x="${svgNumber(screen[0][0] + 5)}"
      y="${svgNumber(screen[0][1] - 5)}">${depth}</text>`;
    if (screen.length === 1) {
      return `<circle class="projection-guide-hull-point" data-hull-layer="${depth}"
        cx="${svgNumber(screen[0][0])}" cy="${svgNumber(screen[0][1])}" r="5" />${label}`;
    }
    if (screen.length === 2) {
      return `<line class="projection-guide-hull" data-hull-layer="${depth}"
        x1="${svgNumber(screen[0][0])}" y1="${svgNumber(screen[0][1])}"
        x2="${svgNumber(screen[1][0])}" y2="${svgNumber(screen[1][1])}" />${label}`;
    }
    const points = screen.map(point => `${svgNumber(point[0])},${svgNumber(point[1])}`).join(' ');
    return `<polygon class="projection-guide-hull" data-hull-layer="${depth}" points="${points}" />${label}`;
  }).join('');
}

function showGuide(root, kind) {
  const overlay = ensureOverlay(root);
  const stage = root.querySelector('.projection-stage');
  if (!overlay || !stage) return;
  activeGuideByRoot.set(root, kind);
  const selected = guideByRoot.get(root);
  if (!selected) return;
  const { geometry, frame, structure } = selected;
  const guide = analyzeProjectionGuides(
    geometry.vertices,
    geometry.edges,
    frame,
    structure
  );
  const transform = stageTransform(guide.points, stage);
  overlay.setAttribute('viewBox', `0 0 ${transform.width} ${transform.height}`);
  overlay.dataset.guide = kind;
  if (kind === 'symmetry') renderSymmetryGuide(overlay, guide, transform);
  else if (kind === 'hull') renderHullGuide(overlay, guide, transform);
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

export function mountProjectionFeatureGuides(root) {
  ensureOverlay(root);

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

export function updateProjectionFeatureGuides(root, geometry, frame, structure) {
  guideByRoot.set(root, { geometry, frame, structure });
  const featureLine = root.querySelector('.projection-feature-line');
  if (featureLine) groupFeatureTags(featureLine);
  const kind = activeGuideByRoot.get(root);
  if (kind) showGuide(root, kind);
}
