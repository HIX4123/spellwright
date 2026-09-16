import { projectVertices, projectionEvents } from './projection-core.js';

const TAU = Math.PI * 2;
const RADIAL_TOLERANCE_FACTOR = 0.002;
const ROTATION_TOLERANCE_FACTOR = 0.006;
const REFLECTION_TOLERANCE_FACTOR = 0.005;
const AXIS_CLUSTER_TOLERANCE = Math.PI / 360;

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

function cross2d(origin, first, second) {
  return (first[0] - origin[0]) * (second[1] - origin[1])
    - (first[1] - origin[1]) * (second[0] - origin[0]);
}

function projectedArrangement(vertices, edges, frame) {
  const points = projectVertices(vertices, frame);
  const events = projectionEvents(points, edges);
  const nodes = events.map(event => ({
    xy: event.xy.slice(),
    vertexMultiplicity: event.vertexIds.size,
    incidentEdgeIds: [...event.edgeIds],
    degree: 0
  }));
  const segments = new Set();

  edges.forEach(([a, b], edgeIndex) => {
    const start = points[a];
    const end = points[b];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared < 1e-18) return;

    const onEdge = [];
    nodes.forEach((node, nodeIndex) => {
      if (!node.incidentEdgeIds.includes(edgeIndex)) return;
      const t = ((node.xy[0] - start[0]) * dx + (node.xy[1] - start[1]) * dy) / lengthSquared;
      onEdge.push({ nodeIndex, t });
    });
    onEdge.sort((first, second) => first.t - second.t);

    for (let index = 1; index < onEdge.length; index += 1) {
      const from = onEdge[index - 1].nodeIndex;
      const to = onEdge[index].nodeIndex;
      if (from !== to) segments.add(edgeKey(from, to));
    }
  });

  for (const key of segments) {
    const [a, b] = key.split(':').map(Number);
    nodes[a].degree += 1;
    nodes[b].degree += 1;
  }

  const scale = Math.max(1, ...nodes.map(node => Math.hypot(node.xy[0], node.xy[1])));
  return { points, nodes, segments, scale };
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

function concentricRadialLayers(nodes, scale) {
  const tolerance = scale * RADIAL_TOLERANCE_FACTOR;
  const sorted = nodes
    .map((node, index) => ({ index, radius: Math.hypot(node.xy[0], node.xy[1]) }))
    .sort((a, b) => a.radius - b.radius);
  const bands = [];

  for (const item of sorted) {
    const current = bands.at(-1);
    if (!current || Math.abs(item.radius - current.radius) > tolerance) {
      bands.push({ radius: item.radius, nodeIndices: [item.index], radii: [item.radius] });
      continue;
    }
    current.nodeIndices.push(item.index);
    current.radii.push(item.radius);
    current.radius = current.radii.reduce((sum, value) => sum + value, 0) / current.radii.length;
  }

  return {
    layers: bands.map(band => band.nodeIndices),
    radii: bands.map(band => band.radius)
  };
}

function reflectionTransform(axisAngle) {
  const cos = Math.cos(axisAngle * 2);
  const sin = Math.sin(axisAngle * 2);
  return ([x, y]) => [x * cos + y * sin, x * sin - y * cos];
}

function rotationTransform(angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return ([x, y]) => [x * cos - y * sin, x * sin + y * cos];
}

function transformMatchError(nodes, indices, transform) {
  const used = new Set();
  let maximum = 0;
  let sumSquares = 0;

  for (const index of indices) {
    const target = transform(nodes[index].xy);
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (const candidate of indices) {
      if (used.has(candidate)) continue;
      const dx = nodes[candidate].xy[0] - target[0];
      const dy = nodes[candidate].xy[1] - target[1];
      const distance = Math.hypot(dx, dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = candidate;
      }
    }
    if (bestIndex < 0) return { maximum: Infinity, rms: Infinity };
    used.add(bestIndex);
    maximum = Math.max(maximum, bestDistance);
    sumSquares += bestDistance * bestDistance;
  }

  return {
    maximum,
    rms: Math.sqrt(sumSquares / Math.max(1, indices.length))
  };
}

function candidateReflectionAxes(nodes, indices) {
  const candidates = [];
  const add = angle => {
    const normalized = normalizeAxisAngle(angle);
    if (candidates.some(existing => axisAngleDistance(existing, normalized) < 1e-5)) return;
    candidates.push(normalized);
  };

  for (let firstPosition = 0; firstPosition < indices.length; firstPosition += 1) {
    const first = indices[firstPosition];
    const firstAngle = Math.atan2(nodes[first].xy[1], nodes[first].xy[0]);
    add(firstAngle);
    for (let secondPosition = firstPosition + 1; secondPosition < indices.length; secondPosition += 1) {
      const second = indices[secondPosition];
      const secondAngle = Math.atan2(nodes[second].xy[1], nodes[second].xy[0]);
      const doubledAxis = Math.atan2(
        Math.sin(firstAngle + secondAngle),
        Math.cos(firstAngle + secondAngle)
      );
      add(doubledAxis / 2);
      add(doubledAxis / 2 + Math.PI / 2);
    }
  }
  return candidates;
}

function silhouetteRotationalOrder(nodes, outerLayer, tolerance) {
  const count = outerLayer.length;
  for (let order = Math.min(12, count); order >= 2; order -= 1) {
    if (count % order !== 0) continue;
    const error = transformMatchError(nodes, outerLayer, rotationTransform(TAU / order));
    if (error.maximum <= tolerance) return order;
  }
  return 1;
}

function arrangementReflectionAxes(nodes, outerLayer, validationIndices, rotationalOrder, tolerance) {
  const candidates = candidateReflectionAxes(nodes, outerLayer);
  if (!candidates.length) return [];
  let best = null;

  for (const baseAngle of candidates) {
    const family = [];
    let maximumError = 0;
    let rmsError = 0;
    for (let index = 0; index < rotationalOrder; index += 1) {
      const angle = normalizeAxisAngle(baseAngle + index * Math.PI / rotationalOrder);
      const error = transformMatchError(nodes, validationIndices, reflectionTransform(angle));
      maximumError = Math.max(maximumError, error.maximum);
      rmsError += error.rms;
      family.push(angle);
    }
    rmsError /= rotationalOrder;
    if (maximumError > tolerance) continue;
    if (!best || maximumError < best.maximumError - 1e-9
      || (Math.abs(maximumError - best.maximumError) <= 1e-9 && rmsError < best.rmsError)) {
      best = { family, maximumError, rmsError };
    }
  }

  if (!best) return [];
  const result = [];
  for (const angle of best.family.sort((a, b) => a - b)) {
    if (result.some(existing => axisAngleDistance(existing, angle) < AXIS_CLUSTER_TOLERANCE)) continue;
    result.push(angle);
  }
  return result;
}

export function analyzeProjectionStructure(vertices, edges, frame) {
  const arrangement = projectedArrangement(vertices, edges, frame);
  const radial = concentricRadialLayers(arrangement.nodes, arrangement.scale);
  const allNodeIndices = arrangement.nodes.map((_, index) => index);
  const outerLayer = convexHullIndices(
    arrangement.nodes,
    allNodeIndices,
    arrangement.scale * arrangement.scale * 1e-8
  );
  const rotationalOrder = silhouetteRotationalOrder(
    arrangement.nodes,
    outerLayer,
    arrangement.scale * ROTATION_TOLERANCE_FACTOR
  );
  const symmetryAxisAngles = arrangementReflectionAxes(
    arrangement.nodes,
    outerLayer,
    allNodeIndices,
    rotationalOrder,
    arrangement.scale * REFLECTION_TOLERANCE_FACTOR
  );

  return {
    points: arrangement.points,
    nodes: arrangement.nodes,
    segments: arrangement.segments,
    layers: radial.layers,
    layerPointCounts: radial.layers.map(layer => layer.length),
    circleCenter: [0, 0],
    circleRadii: radial.radii,
    symmetryAxisAngles,
    rotationalOrder
  };
}
