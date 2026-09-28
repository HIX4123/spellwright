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
    ['dual', '쌍대그래프', '호버하면 각 내부 면의 최대 clearance 점에 노드를 둔 쌍대그래프를 표시합니다.'],
    ['medial', 'Medial Axis', '호버하면 각 내부 면의 경계 선분들로부터 얻은 medial axis를 표시합니다.'],
    ['dual-medial', 'Dual + Medial', '호버하면 쌍대그래프와 medial axis를 겹쳐서 표시합니다.']
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

function signedDistanceToPolygon(point, polygon) {
  if (!polygon.length) return -Infinity;
  const boundaryDistance = Math.min(...polygonBoundarySegments(polygon).map(([start, end]) => (
    distanceToSegment(point, start, end)
  )));
  return pointInPolygon(point, polygon) ? boundaryDistance : -boundaryDistance;
}

function makeClearanceCell(x, y, halfSize, polygon) {
  const distance = signedDistanceToPolygon([x, y], polygon);
  return {
    x,
    y,
    halfSize,
    distance,
    maxDistance: distance + halfSize * Math.SQRT2
  };
}

function maxHeapPush(heap, cell) {
  heap.push(cell);
  let index = heap.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (heap[parent].maxDistance >= heap[index].maxDistance) break;
    [heap[parent], heap[index]] = [heap[index], heap[parent]];
    index = parent;
  }
}

function maxHeapPop(heap) {
  if (!heap.length) return null;
  const top = heap[0];
  const tail = heap.pop();
  if (heap.length && tail) {
    heap[0] = tail;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let largest = index;
      if (left < heap.length && heap[left].maxDistance > heap[largest].maxDistance) largest = left;
      if (right < heap.length && heap[right].maxDistance > heap[largest].maxDistance) largest = right;
      if (largest === index) break;
      [heap[index], heap[largest]] = [heap[largest], heap[index]];
      index = largest;
    }
  }
  return top;
}

export function maximumClearancePointForPolygon(polygon, requestedPrecision = null) {
  if (!polygon.length) return { point: [0, 0], clearance: 0 };
  if (polygon.length < 3) return { point: polygon[0].slice(), clearance: 0 };

  const minX = Math.min(...polygon.map(point => point[0]));
  const maxX = Math.max(...polygon.map(point => point[0]));
  const minY = Math.min(...polygon.map(point => point[1]));
  const maxY = Math.max(...polygon.map(point => point[1]));
  const width = maxX - minX;
  const height = maxY - minY;
  const span = Math.max(width, height);
  if (span <= 1e-12) return { point: polygon[0].slice(), clearance: 0 };

  const cellSize = Math.min(width, height);
  if (cellSize <= 1e-12) {
    const centroid = polygonCentroid(polygon);
    return { point: centroid, clearance: Math.max(0, signedDistanceToPolygon(centroid, polygon)) };
  }

  const precision = requestedPrecision ?? Math.max(span * 0.002, 1e-7);
  const halfSize = cellSize / 2;
  const heap = [];
  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) {
      maxHeapPush(heap, makeClearanceCell(
        Math.min(x + halfSize, maxX),
        Math.min(y + halfSize, maxY),
        halfSize,
        polygon
      ));
    }
  }

  const centroid = polygonCentroid(polygon);
  let best = makeClearanceCell(centroid[0], centroid[1], 0, polygon);
  const boxCenter = makeClearanceCell((minX + maxX) / 2, (minY + maxY) / 2, 0, polygon);
  if (boxCenter.distance > best.distance) best = boxCenter;

  while (heap.length) {
    const cell = maxHeapPop(heap);
    if (!cell) break;
    if (cell.distance > best.distance) best = cell;
    if (cell.maxDistance - best.distance <= precision) continue;

    const nextHalf = cell.halfSize / 2;
    maxHeapPush(heap, makeClearanceCell(cell.x - nextHalf, cell.y - nextHalf, nextHalf, polygon));
    maxHeapPush(heap, makeClearanceCell(cell.x + nextHalf, cell.y - nextHalf, nextHalf, polygon));
    maxHeapPush(heap, makeClearanceCell(cell.x - nextHalf, cell.y + nextHalf, nextHalf, polygon));
    maxHeapPush(heap, makeClearanceCell(cell.x + nextHalf, cell.y + nextHalf, nextHalf, polygon));
  }

  return {
    point: [best.x, best.y],
    clearance: Math.max(0, best.distance)
  };
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
    const polygon = face.nodeIndices.map(nodeIndex => nodes[nodeIndex]);
    const maximumClearance = maximumClearancePointForPolygon(polygon);
    return {
      nodeIndices: face.nodeIndices.slice(),
      centroid: face.centroid.slice(),
      dualPoint: maximumClearance.point,
      clearance: maximumClearance.clearance,
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


function dualFacePoint(face) {
  return face.dualPoint ?? face.centroid;
}

function dualEdgeMidpoint(edge) {
  return [
    (edge.segment[0][0] + edge.segment[1][0]) / 2,
    (edge.segment[0][1] + edge.segment[1][1]) / 2
  ];
}

function pointDistance(first, second) {
  return Math.hypot(first[0] - second[0], first[1] - second[1]);
}

function closestPointOnSegment(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-18) return { point: start.slice(), t: 0, distance: pointDistance(point, start) };
  const t = Math.max(0, Math.min(
    1,
    ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared
  ));
  const nearest = [start[0] + dx * t, start[1] + dy * t];
  return { point: nearest, t, distance: pointDistance(point, nearest) };
}

function dualGraphComponents(dualGraph) {
  const adjacency = Array.from({ length: dualGraph.faces.length }, () => []);
  dualGraph.edges.forEach((edge, edgeIndex) => {
    adjacency[edge.from].push({ node: edge.to, edgeIndex });
    if (edge.to !== edge.from) adjacency[edge.to].push({ node: edge.from, edgeIndex });
  });

  const componentOf = Array(dualGraph.faces.length).fill(-1);
  const components = [];
  for (let start = 0; start < dualGraph.faces.length; start += 1) {
    if (componentOf[start] >= 0) continue;
    const index = components.length;
    const nodes = [];
    const stack = [start];
    componentOf[start] = index;
    while (stack.length) {
      const node = stack.pop();
      nodes.push(node);
      adjacency[node].forEach(({ node: neighbor }) => {
        if (componentOf[neighbor] >= 0) return;
        componentOf[neighbor] = index;
        stack.push(neighbor);
      });
    }
    components.push(nodes);
  }
  return { adjacency, componentOf, components };
}

function nearestDualSeeds(dualGraph, nodeIndices, edgeIndices, origin, tolerance) {
  let minimum = Infinity;
  const nodeCandidates = nodeIndices.map(node => {
    const distance = pointDistance(dualFacePoint(dualGraph.faces[node]), origin);
    minimum = Math.min(minimum, distance);
    return { type: 'node', node, distance };
  });
  const edgeCandidates = edgeIndices.map(edgeIndex => {
    const point = dualEdgeMidpoint(dualGraph.edges[edgeIndex]);
    const distance = pointDistance(point, origin);
    minimum = Math.min(minimum, distance);
    return { type: 'edge', edgeIndex, point, distance };
  });
  if (!Number.isFinite(minimum)) return [];
  return [...nodeCandidates, ...edgeCandidates]
    .filter(candidate => candidate.distance <= minimum + tolerance)
    .map(({ distance, ...candidate }) => candidate);
}

export function dualPropagationSchedule(
  dualGraph,
  arrangementNodes = [],
  origin = [0, 0],
  totalDurationMs = 1000
) {
  const faceCount = dualGraph.faces.length;
  if (!faceCount) {
    return {
      seeds: [],
      seedMode: 'empty',
      levels: [],
      nodeTimes: [],
      edgeTimes: [],
      durationMs: totalDurationMs
    };
  }

  const facePoints = dualGraph.faces.map(dualFacePoint);
  const bendPoints = dualGraph.edges.map(dualEdgeMidpoint);
  const graphScale = Math.max(
    1,
    ...facePoints.map(point => pointDistance(point, origin)),
    ...bendPoints.map(point => pointDistance(point, origin))
  );
  const centerTolerance = graphScale * 1e-6;
  const ringTolerance = Math.max(graphScale * 0.002, centerTolerance * 8);
  const { adjacency, componentOf, components } = dualGraphComponents(dualGraph);

  let seedMode = 'nearest';
  let seeds = facePoints
    .map((point, node) => ({ point, node, distance: pointDistance(point, origin) }))
    .filter(candidate => candidate.distance <= centerTolerance)
    .map(candidate => ({ type: 'node', node: candidate.node }));

  if (seeds.length) {
    seedMode = 'center-node';
  } else {
    const centerEdges = [];
    dualGraph.edges.forEach((edge, edgeIndex) => {
      const midpoint = bendPoints[edgeIndex];
      const from = facePoints[edge.from];
      const to = facePoints[edge.to];
      const crossesCenter = distanceToSegment(origin, from, midpoint) <= centerTolerance
        || distanceToSegment(origin, midpoint, to) <= centerTolerance;
      if (crossesCenter) centerEdges.push(edgeIndex);
    });

    if (centerEdges.length) {
      seedMode = 'center-edge';
      seeds = centerEdges.map(edgeIndex => ({
        type: 'edge',
        edgeIndex,
        point: bendPoints[edgeIndex].slice()
      }));
    } else {
      seeds = nearestDualSeeds(
        dualGraph,
        facePoints.map((_, index) => index),
        dualGraph.edges.map((_, index) => index),
        origin,
        ringTolerance
      );
    }
  }

  const seededComponents = new Set();
  seeds.forEach(seed => {
    if (seed.type === 'node') {
      seededComponents.add(componentOf[seed.node]);
    } else {
      const edge = dualGraph.edges[seed.edgeIndex];
      seededComponents.add(componentOf[edge.from]);
      seededComponents.add(componentOf[edge.to]);
    }
  });
  components.forEach((nodes, componentIndex) => {
    if (seededComponents.has(componentIndex)) return;
    const nodeSet = new Set(nodes);
    const edgeIndices = dualGraph.edges
      .map((edge, index) => (
        nodeSet.has(edge.from) && nodeSet.has(edge.to) ? index : -1
      ))
      .filter(index => index >= 0);
    seeds.push(...nearestDualSeeds(dualGraph, nodes, edgeIndices, origin, ringTolerance));
  });

  const levels = Array(faceCount).fill(Infinity);
  const seedEdgeIndices = new Set();
  seeds.forEach(seed => {
    if (seed.type === 'node') {
      levels[seed.node] = 0;
      return;
    }
    seedEdgeIndices.add(seed.edgeIndex);
    const edge = dualGraph.edges[seed.edgeIndex];
    levels[edge.from] = Math.min(levels[edge.from], 1);
    levels[edge.to] = Math.min(levels[edge.to], 1);
  });

  const queue = [];
  levels.forEach((level, node) => {
    if (Number.isFinite(level)) queue.push(node);
  });
  for (let head = 0; head < queue.length; head += 1) {
    const node = queue[head];
    adjacency[node].forEach(({ node: neighbor }) => {
      const nextLevel = levels[node] + 1;
      if (nextLevel >= levels[neighbor]) return;
      levels[neighbor] = nextLevel;
      queue.push(neighbor);
    });
  }

  const edgePhases = dualGraph.edges.map((edge, edgeIndex) => {
    const fromLevel = levels[edge.from];
    const toLevel = levels[edge.to];

    if (seedEdgeIndices.has(edgeIndex)) {
      const parts = [
        {
          side: 'from',
          delayPhase: 0,
          durationPhase: Math.max(1, fromLevel * 2),
          direction: 'midpoint-to-node'
        },
        {
          side: 'to',
          delayPhase: 0,
          durationPhase: Math.max(1, toLevel * 2),
          direction: 'midpoint-to-node'
        }
      ];
      return {
        mode: 'split',
        parts,
        endPhase: Math.max(...parts.map(part => part.delayPhase + part.durationPhase))
      };
    }

    if (Math.abs(fromLevel - toLevel) <= 1e-9) {
      const delayPhase = fromLevel * 2;
      return {
        mode: 'meet',
        delayPhase,
        durationPhase: 1,
        endPhase: delayPhase + 1
      };
    }

    const source = fromLevel < toLevel ? edge.from : edge.to;
    const target = source === edge.from ? edge.to : edge.from;
    const sourceLevel = Math.min(fromLevel, toLevel);
    const targetLevel = Math.max(fromLevel, toLevel);
    return {
      mode: 'forward',
      source,
      target,
      delayPhase: sourceLevel * 2,
      durationPhase: Math.max(1, (targetLevel - sourceLevel) * 2),
      endPhase: targetLevel * 2
    };
  });

  const nodePhases = levels.map(level => Number.isFinite(level) ? level * 2 : 0);
  const extent = Math.max(
    1,
    ...nodePhases,
    ...edgePhases.map(edge => edge.endPhase)
  );
  const scale = totalDurationMs / extent;

  return {
    seeds,
    seedMode,
    levels,
    nodeTimes: nodePhases.map(phase => phase * scale),
    edgeTimes: edgePhases.map(edge => ({
      ...edge,
      delayMs: (edge.delayPhase ?? 0) * scale,
      durationMs: (edge.durationPhase ?? 0) * scale,
      parts: edge.parts?.map(part => ({
        ...part,
        delayMs: part.delayPhase * scale,
        durationMs: part.durationPhase * scale
      }))
    })),
    durationMs: totalDurationMs
  };
}

function addMedialGraphPoint(points, point, tolerance) {
  const existing = points.findIndex(candidate => pointDistance(candidate, point) <= tolerance);
  if (existing >= 0) return existing;
  points.push(point.slice());
  return points.length - 1;
}

export function medialPropagationSchedule(
  segments,
  origin,
  startTimeMs = 0,
  totalDurationMs = 1000
) {
  if (!segments.length || startTimeMs >= totalDurationMs) return [];
  const tolerance = 0.6;
  let rootSegment = 0;
  let rootProjection = null;
  let rootDistance = Infinity;
  segments.forEach(([start, end], index) => {
    const projection = closestPointOnSegment(origin, start, end);
    if (projection.distance < rootDistance) {
      rootDistance = projection.distance;
      rootProjection = projection.point;
      rootSegment = index;
    }
  });

  const root = origin.slice();
  const splitSegments = [];
  segments.forEach(([start, end], index) => {
    if (index !== rootSegment) {
      splitSegments.push([start.slice(), end.slice()]);
      return;
    }
    if (pointDistance(root, start) > 0.25) splitSegments.push([root.slice(), start.slice()]);
    if (pointDistance(root, end) > 0.25) splitSegments.push([root.slice(), end.slice()]);
  });
  if (!splitSegments.length && rootProjection) splitSegments.push([root.slice(), rootProjection.slice()]);

  const points = [];
  const graphSegments = splitSegments.map(([start, end]) => ({
    a: addMedialGraphPoint(points, start, tolerance),
    b: addMedialGraphPoint(points, end, tolerance),
    start,
    end
  }));
  const rootIndex = addMedialGraphPoint(points, root, tolerance);
  const adjacency = Array.from({ length: points.length }, () => []);
  graphSegments.forEach((segment, index) => {
    const length = pointDistance(segment.start, segment.end);
    adjacency[segment.a].push({ node: segment.b, segmentIndex: index, length });
    adjacency[segment.b].push({ node: segment.a, segmentIndex: index, length });
  });

  const distances = Array(points.length).fill(Infinity);
  const settled = Array(points.length).fill(false);
  distances[rootIndex] = 0;
  for (let iteration = 0; iteration < points.length; iteration += 1) {
    let current = -1;
    let best = Infinity;
    distances.forEach((distance, index) => {
      if (!settled[index] && distance < best) {
        current = index;
        best = distance;
      }
    });
    if (current < 0) break;
    settled[current] = true;
    adjacency[current].forEach(({ node, length }) => {
      const candidate = best + length;
      if (candidate < distances[node]) distances[node] = candidate;
    });
  }

  let finiteMax = Math.max(0, ...distances.filter(Number.isFinite));
  distances.forEach((distance, index) => {
    if (Number.isFinite(distance)) return;
    distances[index] = finiteMax + pointDistance(root, points[index]);
  });
  finiteMax = Math.max(1e-9, ...distances);

  const available = totalDurationMs - startTimeMs;
  const scale = available / finiteMax;
  return graphSegments.flatMap(segment => {
    const firstDistance = distances[segment.a];
    const secondDistance = distances[segment.b];
    if (Math.abs(firstDistance - secondDistance) <= 0.6) {
      const midpoint = [
        (segment.start[0] + segment.end[0]) / 2,
        (segment.start[1] + segment.end[1]) / 2
      ];
      const delayMs = startTimeMs + Math.min(firstDistance, secondDistance) * scale;
      const durationMs = Math.max(1, pointDistance(segment.start, midpoint) * scale);
      return [
        { start: segment.start, end: midpoint, delayMs, durationMs },
        { start: segment.end, end: midpoint, delayMs, durationMs }
      ];
    }
    const forward = firstDistance < secondDistance;
    const start = forward ? segment.start : segment.end;
    const end = forward ? segment.end : segment.start;
    const delayMs = startTimeMs + Math.min(firstDistance, secondDistance) * scale;
    const durationMs = Math.max(1, pointDistance(start, end) * scale);
    return [{ start, end, delayMs, durationMs }];
  });
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


function dualGraphMarkup(guide, transform) {
  const facePoints = guide.dualGraph.faces.map(face => (
    transform.point(face.dualPoint ?? face.centroid)
  ));
  const schedule = dualPropagationSchedule(
    guide.dualGraph,
    guide.arrangementNodes,
    [0, 0],
    300
  );

  const edgeMarkup = guide.dualGraph.edges.map((edge, index) => {
    const timing = schedule.edgeTimes[index];
    const midpoint = transform.point([
      (edge.segment[0][0] + edge.segment[1][0]) / 2,
      (edge.segment[0][1] + edge.segment[1][1]) / 2
    ]);
    const style = `--dual-delay:${timing.delayMs.toFixed(2)}ms;--dual-duration:${timing.durationMs.toFixed(2)}ms`;

    if (edge.from === edge.to) {
      const radius = 7;
      return `<circle class="projection-guide-dual-edge projection-guide-dual-loop is-animated"
        pathLength="1" style="${style}"
        cx="${svgNumber(midpoint[0])}" cy="${svgNumber(midpoint[1])}" r="${radius}" />`;
    }

    const sourceIsFrom = timing.source === edge.from;
    const start = facePoints[sourceIsFrom ? edge.from : edge.to];
    const end = facePoints[sourceIsFrom ? edge.to : edge.from];
    return `<polyline class="projection-guide-dual-edge is-animated"
      pathLength="1" style="${style}"
      points="${svgNumber(start[0])},${svgNumber(start[1])} ${svgNumber(midpoint[0])},${svgNumber(midpoint[1])} ${svgNumber(end[0])},${svgNumber(end[1])}" />`;
  }).join('');

  const nodeMarkup = guide.dualGraph.faces.map((face, index) => {
    const point = facePoints[index];
    const style = `--dual-node-delay:${schedule.nodeTimes[index].toFixed(2)}ms`;
    return `
      <circle class="projection-guide-dual-node is-animated" style="${style}"
        cx="${svgNumber(point[0])}" cy="${svgNumber(point[1])}" r="4.5" />
      <text class="projection-guide-label projection-guide-dual-label is-animated" style="${style}"
        x="${svgNumber(point[0] + 7)}" y="${svgNumber(point[1] - 7)}">F${index + 1}</text>
    `;
  }).join('');

  return edgeMarkup + nodeMarkup;
}

function medialAxisMarkup(guide, transform) {
  const spacing = Math.max(3.5, Math.min(6, Math.min(transform.width, transform.height) / 72));
  const segments = guide.dualGraph.faces.flatMap(face => {
    const polygon = face.nodeIndices.map(index => transform.point(guide.arrangementNodes[index]));
    return medialAxisSegmentsForPolygon(polygon, spacing);
  });
  if (!segments.length) return '';

  const path = segments.map(([start, end]) => (
    `M ${svgNumber(start[0])} ${svgNumber(start[1])} L ${svgNumber(end[0])} ${svgNumber(end[1])}`
  )).join('');
  return `<path class="projection-guide-medial-axis" d="${path}" />`;
}

function renderDualGuide(overlay, guide, transform) {
  overlay.innerHTML = dualGraphMarkup(guide, transform)
    + '<text class="projection-guide-caption" x="12" y="18">최대 clearance 점 → 쌍대 노드 · 내부 공유 선분 → 간선</text>';
}

function renderMedialAxisGuide(overlay, guide, transform) {
  const markup = medialAxisMarkup(guide, transform);
  overlay.innerHTML = markup
    ? markup + '<text class="projection-guide-caption" x="12" y="18">Medial Axis · 내부 면 경계의 등거리 중심축</text>'
    : '<text class="projection-guide-caption" x="12" y="18">Medial Axis · 추출 가능한 내부 면이 없음</text>';
}

function renderDualMedialGuide(overlay, guide, transform) {
  const medialMarkup = medialAxisMarkup(guide, transform);
  overlay.innerHTML = `<g class="projection-guide-combined-medial">${medialMarkup}</g>`
    + `<g class="projection-guide-combined-dual">${dualGraphMarkup(guide, transform)}</g>`
    + '<text class="projection-guide-caption" x="12" y="18">Dual + Medial · 쌍대 노드와 중심축 비교</text>';
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
  else if (kind === 'dual-medial') renderDualMedialGuide(overlay, guide, transform);
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
