import { analyzeProjectionStructure } from './projection-geometry-analysis.js?v=convex-hull-layers-20260927-1';

const activeGuideByRoot = new WeakMap();
const guideByRoot = new WeakMap();

export function analyzeProjectionGuides(vertices, edges, frame, structure = analyzeProjectionStructure(vertices, edges, frame)) {
  const arrangementNodes = structure.nodes.map(node => node.xy.slice());
  const arrangementSegments = [...structure.segments].map(key => {
    const [a, b] = key.split(':').map(Number);
    return [arrangementNodes[a].slice(), arrangementNodes[b].slice()];
  });
  return {
    points: structure.points,
    symmetryAxisAngles: structure.symmetryAxisAngles,
    layerCenter: structure.circleCenter,
    layerRadii: structure.circleRadii,
    layerPointCounts: structure.layerPointCounts,
    hullLayers: structure.convexHullLayers.map(layer => (
      layer.map(index => structure.nodes[index].xy.slice())
    )),
    hullLayerPointCounts: structure.convexHullLayerPointCounts,
    arrangementNodes,
    arrangementSegments,
    dualGraph: planarDualFromStructure(structure)
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

  const guideGroup = document.createElement('span');
  guideGroup.className = 'projection-feature-group projection-guide-tool-group';
  guideGroup.dataset.featureGroup = 'guides';
  [
    ['dual', '쌍대그래프', '호버하면 교차점을 포함해 평면 분할한 사영도의 쌍대그래프를 표시합니다.'],
    ['medial', 'Medial Axis', '호버하면 각 내부 면의 경계 선분들로부터 얻은 medial axis를 표시합니다.']
  ].forEach(([kind, label, title]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'projection-guide-button';
    button.dataset.guide = kind;
    button.title = title;
    button.textContent = label;
    guideGroup.appendChild(button);
  });
  fragment.appendChild(guideGroup);
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

function directedEdgeKey(from, to) {
  return `${from}>${to}`;
}

function polygonSignedArea(points) {
  let doubleArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    doubleArea += current[0] * next[1] - next[0] * current[1];
  }
  return doubleArea / 2;
}

function polygonCentroid(points) {
  if (!points.length) return [0, 0];
  let crossSum = 0;
  let xSum = 0;
  let ySum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const cross = current[0] * next[1] - next[0] * current[1];
    crossSum += cross;
    xSum += (current[0] + next[0]) * cross;
    ySum += (current[1] + next[1]) * cross;
  }
  if (Math.abs(crossSum) < 1e-12) {
    return [
      points.reduce((sum, point) => sum + point[0], 0) / points.length,
      points.reduce((sum, point) => sum + point[1], 0) / points.length
    ];
  }
  return [xSum / (3 * crossSum), ySum / (3 * crossSum)];
}

export function planarDualFromStructure(structure) {
  const nodes = structure.nodes.map(node => node.xy.slice());
  const segments = [...structure.segments].map(key => key.split(':').map(Number));
  const adjacency = Array.from({ length: nodes.length }, () => []);

  segments.forEach(([a, b]) => {
    adjacency[a].push(b);
    adjacency[b].push(a);
  });
  adjacency.forEach((neighbors, nodeIndex) => {
    neighbors.sort((first, second) => (
      Math.atan2(nodes[first][1] - nodes[nodeIndex][1], nodes[first][0] - nodes[nodeIndex][0])
      - Math.atan2(nodes[second][1] - nodes[nodeIndex][1], nodes[second][0] - nodes[nodeIndex][0])
    ));
  });

  const visited = new Set();
  const rawFaces = [];
  const halfEdgeRawFace = new Map();
  const areaTolerance = Math.max(1, structure.scale || 1) ** 2 * 1e-9;
  const guardLimit = Math.max(8, segments.length * 2 + nodes.length + 4);

  for (let from = 0; from < adjacency.length; from += 1) {
    for (const to of adjacency[from]) {
      if (visited.has(directedEdgeKey(from, to))) continue;

      const cycle = [];
      const traversed = [];
      let currentFrom = from;
      let currentTo = to;
      let closed = false;

      for (let guard = 0; guard < guardLimit; guard += 1) {
        const key = directedEdgeKey(currentFrom, currentTo);
        if (visited.has(key)) {
          closed = currentFrom === from && currentTo === to;
          break;
        }
        visited.add(key);
        traversed.push([currentFrom, currentTo]);
        cycle.push(currentFrom);

        const around = adjacency[currentTo];
        const reverseIndex = around.indexOf(currentFrom);
        if (reverseIndex < 0 || !around.length) break;
        const next = around[(reverseIndex - 1 + around.length) % around.length];
        currentFrom = currentTo;
        currentTo = next;

        if (currentFrom === from && currentTo === to) {
          closed = true;
          break;
        }
      }

      if (!closed || cycle.length < 3) continue;
      const points = cycle.map(index => nodes[index]);
      const area = polygonSignedArea(points);
      if (Math.abs(area) <= areaTolerance) continue;

      const rawFaceIndex = rawFaces.length;
      rawFaces.push({
        nodeIndices: cycle,
        area,
        centroid: polygonCentroid(points)
      });
      traversed.forEach(([a, b]) => halfEdgeRawFace.set(directedEdgeKey(a, b), rawFaceIndex));
    }
  }

  const boundedRaw = rawFaces
    .map((face, index) => ({ face, index }))
    .filter(item => item.face.area > areaTolerance);
  const rawToFace = new Map();
  const faces = boundedRaw.map(({ face, index }, faceIndex) => {
    rawToFace.set(index, faceIndex);
    return {
      nodeIndices: face.nodeIndices.slice(),
      centroid: face.centroid.slice(),
      area: face.area
    };
  });

  const edges = segments.flatMap(([a, b]) => {
    const forwardRaw = halfEdgeRawFace.get(directedEdgeKey(a, b));
    const reverseRaw = halfEdgeRawFace.get(directedEdgeKey(b, a));
    const from = rawToFace.get(forwardRaw);
    const to = rawToFace.get(reverseRaw);
    if (!Number.isInteger(from) || !Number.isInteger(to)) return [];
    return [{
      from,
      to,
      segment: [nodes[a].slice(), nodes[b].slice()]
    }];
  });

  return { faces, edges };
}

export function distanceToSegment(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-18) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const t = Math.max(0, Math.min(
    1,
    ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared
  ));
  const nearest = [start[0] + dx * t, start[1] + dy * t];
  return Math.hypot(point[0] - nearest[0], point[1] - nearest[1]);
}

function pointInPolygon(point, polygon) {
  if (polygon.length < 3) return false;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    if (distanceToSegment(point, start, end) <= 1e-7) return true;
  }

  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const a = polygon[current];
    const b = polygon[previous];
    const crosses = (a[1] > point[1]) !== (b[1] > point[1]);
    if (!crosses) continue;
    const xAtY = (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0];
    if (point[0] < xAtY) inside = !inside;
  }
  return inside;
}

function polygonBoundarySegments(polygon) {
  return polygon.map((point, index) => [
    point,
    polygon[(index + 1) % polygon.length]
  ]);
}

function nearestBoundaryFeature(point, boundarySegments) {
  let edgeIndex = -1;
  let distance = Infinity;
  boundarySegments.forEach((segment, index) => {
    const candidate = distanceToSegment(point, segment[0], segment[1]);
    if (candidate < distance) {
      edgeIndex = index;
      distance = candidate;
    }
  });
  return { edgeIndex, distance };
}

function medialCrossing(first, second, firstLabel, secondLabel, boundarySegments) {
  const firstA = distanceToSegment(first, ...boundarySegments[firstLabel]);
  const firstB = distanceToSegment(first, ...boundarySegments[secondLabel]);
  const secondA = distanceToSegment(second, ...boundarySegments[firstLabel]);
  const secondB = distanceToSegment(second, ...boundarySegments[secondLabel]);
  const firstDifference = firstA - firstB;
  const secondDifference = secondA - secondB;
  const denominator = firstDifference - secondDifference;
  const t = Math.abs(denominator) <= 1e-9
    ? 0.5
    : Math.max(0, Math.min(1, firstDifference / denominator));
  return [
    first[0] + (second[0] - first[0]) * t,
    first[1] + (second[1] - first[1]) * t
  ];
}

function uniquePoints(points, tolerance = 0.35) {
  const unique = [];
  for (const point of points) {
    if (unique.some(existing => Math.hypot(
      existing[0] - point[0],
      existing[1] - point[1]
    ) <= tolerance)) continue;
    unique.push(point);
  }
  return unique;
}

export function medialAxisSegmentsForPolygon(polygon, requestedSpacing = 5) {
  if (polygon.length < 3) return [];
  const boundarySegments = polygonBoundarySegments(polygon);
  const minX = Math.min(...polygon.map(point => point[0]));
  const maxX = Math.max(...polygon.map(point => point[0]));
  const minY = Math.min(...polygon.map(point => point[1]));
  const maxY = Math.max(...polygon.map(point => point[1]));
  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= 1e-6 || height <= 1e-6) return [];

  const spacing = Math.max(2.5, requestedSpacing);
  const columns = Math.max(2, Math.ceil(width / spacing));
  const rows = Math.max(2, Math.ceil(height / spacing));
  const stepX = width / columns;
  const stepY = height / rows;
  const clearanceFloor = Math.min(stepX, stepY) * 0.32;
  const samples = Array.from({ length: rows + 1 }, (_, row) => (
    Array.from({ length: columns + 1 }, (_, column) => {
      const point = [minX + column * stepX, minY + row * stepY];
      if (!pointInPolygon(point, polygon)) return { point, inside: false, edgeIndex: -1, distance: 0 };
      const nearest = nearestBoundaryFeature(point, boundarySegments);
      return { point, inside: true, ...nearest };
    })
  ));

  const segments = [];
  const cellEdges = [[0, 1], [1, 2], [2, 3], [3, 0]];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const corners = [
        samples[row][column],
        samples[row][column + 1],
        samples[row + 1][column + 1],
        samples[row + 1][column]
      ];
      const crossings = [];

      for (const [firstIndex, secondIndex] of cellEdges) {
        const first = corners[firstIndex];
        const second = corners[secondIndex];
        if (!first.inside || !second.inside) continue;
        if (first.edgeIndex < 0 || second.edgeIndex < 0 || first.edgeIndex === second.edgeIndex) continue;
        if (Math.max(first.distance, second.distance) < clearanceFloor) continue;
        crossings.push(medialCrossing(
          first.point,
          second.point,
          first.edgeIndex,
          second.edgeIndex,
          boundarySegments
        ));
      }

      const points = uniquePoints(crossings);
      if (points.length === 2) {
        segments.push([points[0], points[1]]);
      } else if (points.length > 2) {
        const hub = [
          points.reduce((sum, point) => sum + point[0], 0) / points.length,
          points.reduce((sum, point) => sum + point[1], 0) / points.length
        ];
        points.forEach(point => segments.push([point, hub]));
      }
    }
  }

  return segments.filter(([start, end]) => (
    Math.hypot(end[0] - start[0], end[1] - start[1]) > 0.45
  ));
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


function renderDualGuide(overlay, guide, transform) {
  const facePoints = guide.dualGraph.faces.map(face => transform.point(face.centroid));

  const edgeMarkup = guide.dualGraph.edges.map(edge => {
    const start = facePoints[edge.from];
    const end = facePoints[edge.to];
    const midpoint = transform.point([
      (edge.segment[0][0] + edge.segment[1][0]) / 2,
      (edge.segment[0][1] + edge.segment[1][1]) / 2
    ]);
    if (edge.from === edge.to) {
      const radius = 7;
      return `<circle class="projection-guide-dual-edge projection-guide-dual-loop"
        cx="${svgNumber(midpoint[0])}" cy="${svgNumber(midpoint[1])}" r="${radius}" />`;
    }
    return `<polyline class="projection-guide-dual-edge"
      points="${svgNumber(start[0])},${svgNumber(start[1])} ${svgNumber(midpoint[0])},${svgNumber(midpoint[1])} ${svgNumber(end[0])},${svgNumber(end[1])}" />`;
  }).join('');

  const nodeMarkup = guide.dualGraph.faces.map((face, index) => {
    const point = facePoints[index];
    return `
      <circle class="projection-guide-dual-node"
        cx="${svgNumber(point[0])}" cy="${svgNumber(point[1])}" r="4.5" />
      <text class="projection-guide-label projection-guide-dual-label"
        x="${svgNumber(point[0] + 7)}" y="${svgNumber(point[1] - 7)}">F${index + 1}</text>
    `;
  }).join('');

  overlay.innerHTML = edgeMarkup + nodeMarkup
    + '<text class="projection-guide-caption" x="12" y="18">내부 면 → 노드 · 내부 공유 선분 → 간선</text>';
}

function renderMedialAxisGuide(overlay, guide, transform) {
  const spacing = Math.max(3.5, Math.min(6, Math.min(transform.width, transform.height) / 72));
  const segments = guide.dualGraph.faces.flatMap(face => {
    const polygon = face.nodeIndices.map(index => transform.point(guide.arrangementNodes[index]));
    return medialAxisSegmentsForPolygon(polygon, spacing);
  });

  const path = segments.map(([start, end]) => (
    `M ${svgNumber(start[0])} ${svgNumber(start[1])} L ${svgNumber(end[0])} ${svgNumber(end[1])}`
  )).join(' ');

  overlay.innerHTML = path
    ? `<path class="projection-guide-medial-axis" d="${path}" />
       <text class="projection-guide-caption" x="12" y="18">Medial Axis · 내부 면 경계의 등거리 중심축</text>`
    : '<text class="projection-guide-caption" x="12" y="18">Medial Axis · 추출 가능한 내부 면이 없음</text>';
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
  else if (kind === 'dual') renderDualGuide(overlay, guide, transform);
  else if (kind === 'medial') renderMedialAxisGuide(overlay, guide, transform);
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
  const tag = target.closest('.projection-feature-tag[data-guide], .projection-guide-button[data-guide]');
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
