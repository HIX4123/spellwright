import { projectVertices, projectionEvents } from './projection-core.js';

const TAU = Math.PI * 2;
const ROTATION_TOLERANCE_FACTOR = 0.006;
const REFLECTION_TOLERANCE_FACTOR = 0.02;
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

function nestedConvexLayers(nodes, scale) {
  let remaining = nodes.map((_, index) => index);
  const outerToInner = [];
  const areaTolerance = scale * scale * 1e-8;

  while (remaining.length) {
    const hull = convexHullIndices(nodes, remaining, areaTolerance);
    const layer = hull.length ? hull : remaining.slice(0, 1);
    outerToInner.push(layer);
    const removed = new Set(layer);
    remaining = remaining.filter(index => !removed.has(index));
  }

  return outerToInner.reverse();
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

function silhouetteReflectionAxes(nodes, outerLayer, rotationalOrder, tolerance) {
  const candidates = candidateReflectionAxes(nodes, outerLayer);
  if (!candidates.length) return [];
  let best = null;

  for (const baseAngle of candidates) {
    const family = [];
    let maximumError = 0;
    let rmsError = 0;
    for (let index = 0; index < rotationalOrder; index += 1) {
      const angle = normalizeAxisAngle(baseAngle + index * Math.PI / rotationalOrder);
      const error = transformMatchError(nodes, outerLayer, reflectionTransform(angle));
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

function solveLinearSystem(matrix, vector) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-11) return null;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let value = column; value <= size; value += 1) augmented[column][value] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      if (Math.abs(factor) < 1e-15) continue;
      for (let value = column; value <= size; value += 1) {
        augmented[row][value] -= factor * augmented[column][value];
      }
    }
  }
  return augmented.map(row => row[size]);
}

function fitConcentricCircles(nodes, layers, scale) {
  if (!layers.length) return { center: [0, 0], radii: [] };
  const unknownCount = 2 + layers.length;
  const normal = Array.from({ length: unknownCount }, () => Array(unknownCount).fill(0));
  const rhs = Array(unknownCount).fill(0);

  layers.forEach((layer, layerIndex) => {
    layer.forEach(nodeIndex => {
      const [x, y] = nodes[nodeIndex].xy;
      const row = Array(unknownCount).fill(0);
      row[0] = -2 * x;
      row[1] = -2 * y;
      row[2 + layerIndex] = 1;
      const value = -(x * x + y * y);
      for (let first = 0; first < unknownCount; first += 1) {
        rhs[first] += row[first] * value;
        for (let second = 0; second < unknownCount; second += 1) {
          normal[first][second] += row[first] * row[second];
        }
      }
    });
  });

  const ridge = scale * scale * 1e-10;
  for (let index = 0; index < unknownCount; index += 1) normal[index][index] += ridge;
  const solution = solveLinearSystem(normal, rhs);
  let center;
  if (solution) {
    center = [solution[0], solution[1]];
  } else {
    const outer = layers.at(-1).map(index => nodes[index].xy);
    center = [
      outer.reduce((sum, point) => sum + point[0], 0) / outer.length,
      outer.reduce((sum, point) => sum + point[1], 0) / outer.length
    ];
  }

  let previousRadius = 0;
  const radii = layers.map(layer => {
    const rawRadius = Math.max(...layer.map(index => Math.hypot(
      nodes[index].xy[0] - center[0],
      nodes[index].xy[1] - center[1]
    )));
    const radius = Math.max(previousRadius, rawRadius);
    previousRadius = radius;
    return radius;
  });
  return { center, radii };
}

export function analyzeProjectionStructure(vertices, edges, frame) {
  const arrangement = projectedArrangement(vertices, edges, frame);
  const layers = nestedConvexLayers(arrangement.nodes, arrangement.scale);
  const circles = fitConcentricCircles(arrangement.nodes, layers, arrangement.scale);
  const outerLayer = layers.at(-1) || [];
  const rotationalOrder = silhouetteRotationalOrder(
    arrangement.nodes,
    outerLayer,
    arrangement.scale * ROTATION_TOLERANCE_FACTOR
  );
  const symmetryAxisAngles = silhouetteReflectionAxes(
    arrangement.nodes,
    outerLayer,
    rotationalOrder,
    arrangement.scale * REFLECTION_TOLERANCE_FACTOR
  );

  return {
    points: arrangement.points,
    nodes: arrangement.nodes,
    segments: arrangement.segments,
    layers,
    layerPointCounts: layers.map(layer => layer.length),
    circleCenter: circles.center,
    circleRadii: circles.radii,
    symmetryAxisAngles,
    rotationalOrder
  };
}
