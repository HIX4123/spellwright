import { geometryForSolid, viewFrame } from './projection-core.js';
import { analyzeProjectionStructure } from './projection-geometry-analysis.js';

const attachedRoots = new WeakSet();
const activeGuideByRoot = new WeakMap();

export function analyzeProjectionGuides(vertices, edges, frame) {
  const structure = analyzeProjectionStructure(vertices, edges, frame);
  return {
    points: structure.points,
    symmetryAxisAngles: structure.symmetryAxisAngles,
    layerCenter: structure.circleCenter,
    layerRadii: structure.circleRadii,
    layerPointCounts: structure.layerPointCounts
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
  const center = transform.point(guide.layerCenter);
  const renderedRadii = [];
  guide.layerRadii.forEach((radius, index) => {
    let screenRadius = radius * transform.scale;
    if (screenRadius < 7) screenRadius = 7 + index * 5;
    while (renderedRadii.some(existing => Math.abs(existing - screenRadius) < 4)) screenRadius += 5;
    renderedRadii.push(screenRadius);
  });
  overlay.innerHTML = renderedRadii.map((radius, index) => `
    <circle class="projection-guide-ring" cx="${svgNumber(center[0])}" cy="${svgNumber(center[1])}" r="${svgNumber(radius)}" />
    <text class="projection-guide-label" x="${svgNumber(center[0] + radius + 4)}" y="${svgNumber(center[1] - 4)}">${index + 1}</text>
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
