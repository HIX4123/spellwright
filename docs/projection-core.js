const SWIPE_THRESHOLD = 0.23;
const VELOCITY_THRESHOLD = 0.55;
const EVENT_DIGITS = 8;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function wrapIndex(index, length) {
  if (!length) return 0;
  return ((index % length) + length) % length;
}

export function dragProgress(dx, width) {
  const span = Math.max(140, width * 0.34);
  return clamp(-dx / span, -1, 1);
}

export function swipeDirection(dx, width, elapsedMs = 1000) {
  const progress = dragProgress(dx, width);
  const velocity = Math.abs(dx) / Math.max(1, elapsedMs);
  if (Math.abs(progress) < SWIPE_THRESHOLD && velocity < VELOCITY_THRESHOLD) return 0;
  return progress > 0 ? 1 : -1;
}

function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale3(v, scalar) {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function length3(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

function normalize3(v) {
  const length = length3(v);
  if (length < 1e-12) throw new Error('Cannot normalize a zero-length vector');
  return [v[0] / length, v[1] / length, v[2] / length];
}


const PLATONIC_SYMMETRY_CACHE = new Map();

function matrix3FromColumns(first, second, third) {
  return [
    [first[0], second[0], third[0]],
    [first[1], second[1], third[1]],
    [first[2], second[2], third[2]]
  ];
}

function determinant3(matrix) {
  return matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1])
    - matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0])
    + matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]);
}

function inverse3(matrix) {
  const determinant = determinant3(matrix);
  if (Math.abs(determinant) < 1e-12) return null;
  const scale = 1 / determinant;
  return [
    [
      (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) * scale,
      (matrix[0][2] * matrix[2][1] - matrix[0][1] * matrix[2][2]) * scale,
      (matrix[0][1] * matrix[1][2] - matrix[0][2] * matrix[1][1]) * scale
    ],
    [
      (matrix[1][2] * matrix[2][0] - matrix[1][0] * matrix[2][2]) * scale,
      (matrix[0][0] * matrix[2][2] - matrix[0][2] * matrix[2][0]) * scale,
      (matrix[0][2] * matrix[1][0] - matrix[0][0] * matrix[1][2]) * scale
    ],
    [
      (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]) * scale,
      (matrix[0][1] * matrix[2][0] - matrix[0][0] * matrix[2][1]) * scale,
      (matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0]) * scale
    ]
  ];
}

function multiplyMatrix3(first, second) {
  return first.map((row, rowIndex) => second[0].map((_, columnIndex) =>
    row.reduce((sum, value, innerIndex) =>
      sum + value * second[innerIndex][columnIndex], 0)));
}

function rotateVector3(matrix, vector) {
  return matrix.map(row => dot3(row, vector));
}

function matrixMaximumDifference(first, second) {
  let maximum = 0;
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      maximum = Math.max(maximum, Math.abs(first[row][column] - second[row][column]));
    }
  }
  return maximum;
}

function symmetryCacheKey(vertices) {
  return vertices.map(vertex =>
    vertex.map(value => Number(value).toPrecision(12)).join(',')
  ).join(';');
}

export function platonicRotationSymmetries(vertices) {
  const key = symmetryCacheKey(vertices);
  const cached = PLATONIC_SYMMETRY_CACHE.get(key);
  if (cached) return cached;

  let sourceMatrix = null;
  let largestDeterminant = 0;
  for (let first = 0; first < vertices.length - 2; first += 1) {
    for (let second = first + 1; second < vertices.length - 1; second += 1) {
      for (let third = second + 1; third < vertices.length; third += 1) {
        const candidate = matrix3FromColumns(vertices[first], vertices[second], vertices[third]);
        const determinant = Math.abs(determinant3(candidate));
        if (determinant > largestDeterminant) {
          largestDeterminant = determinant;
          sourceMatrix = candidate;
        }
      }
    }
  }
  if (!sourceMatrix) return [];

  const sourceInverse = inverse3(sourceMatrix);
  if (!sourceInverse) return [];
  const sourceColumns = [
    [sourceMatrix[0][0], sourceMatrix[1][0], sourceMatrix[2][0]],
    [sourceMatrix[0][1], sourceMatrix[1][1], sourceMatrix[2][1]],
    [sourceMatrix[0][2], sourceMatrix[1][2], sourceMatrix[2][2]]
  ];
  const sourceGram = sourceColumns.map(first =>
    sourceColumns.map(second => dot3(first, second)));
  const radius = Math.max(1, ...vertices.map(vertex => length3(vertex)));
  const gramTolerance = radius * radius * 1e-8;
  const vertexTolerance = radius * 1e-7;
  const rotations = [];

  for (let first = 0; first < vertices.length; first += 1) {
    for (let second = 0; second < vertices.length; second += 1) {
      if (second === first) continue;
      for (let third = 0; third < vertices.length; third += 1) {
        if (third === first || third === second) continue;
        const targetColumns = [vertices[first], vertices[second], vertices[third]];
        let gramMatches = true;
        for (let row = 0; row < 3 && gramMatches; row += 1) {
          for (let column = 0; column < 3; column += 1) {
            if (Math.abs(dot3(targetColumns[row], targetColumns[column]) - sourceGram[row][column])
              > gramTolerance) {
              gramMatches = false;
              break;
            }
          }
        }
        if (!gramMatches) continue;

        const targetMatrix = matrix3FromColumns(...targetColumns);
        const rotation = multiplyMatrix3(targetMatrix, sourceInverse);
        if (determinant3(rotation) < 1 - 1e-7) continue;

        const mapsVertices = vertices.every(vertex => {
          const rotated = rotateVector3(rotation, vertex);
          return vertices.some(candidate =>
            Math.hypot(
              rotated[0] - candidate[0],
              rotated[1] - candidate[1],
              rotated[2] - candidate[2]
            ) <= vertexTolerance
          );
        });
        if (!mapsVertices) continue;
        if (rotations.some(existing => matrixMaximumDifference(existing, rotation) < 1e-8)) continue;
        rotations.push(rotation);
      }
    }
  }

  PLATONIC_SYMMETRY_CACHE.set(key, rotations);
  return rotations;
}

export function rotateFrame(frame, rotation) {
  return {
    u: rotateVector3(rotation, frame.u),
    v: rotateVector3(rotation, frame.v),
    d: rotateVector3(rotation, frame.d)
  };
}

export function frameRotationAngle(first, second) {
  const trace = dot3(first.u, second.u) + dot3(first.v, second.v) + dot3(first.d, second.d);
  return Math.acos(clamp((trace - 1) / 2, -1, 1));
}

export function nearestSymmetryEquivalentFrame(sourceFrame, targetFrame, rotations) {
  if (!sourceFrame || !rotations?.length) return {
    frame: targetFrame,
    angle: sourceFrame ? frameRotationAngle(sourceFrame, targetFrame) : 0
  };

  let bestFrame = targetFrame;
  let bestAngle = frameRotationAngle(sourceFrame, targetFrame);
  for (const rotation of rotations) {
    const candidate = rotateFrame(targetFrame, rotation);
    const angle = frameRotationAngle(sourceFrame, candidate);
    if (angle + 1e-10 < bestAngle) {
      bestAngle = angle;
      bestFrame = candidate;
    }
  }
  return { frame: bestFrame, angle: bestAngle };
}

export function projectionBasis(direction) {
  const d = normalize3(direction);
  const a = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = normalize3(cross3(d, a));
  const v = cross3(d, u);
  return { u, v, d };
}

export function viewFrame(direction, rollDegrees = 0) {
  const base = projectionBasis(direction);
  const angle = rollDegrees * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    u: add3(scale3(base.u, cos), scale3(base.v, -sin)),
    v: add3(scale3(base.u, sin), scale3(base.v, cos)),
    d: base.d.slice()
  };
}

function frameMatrix(frame) {
  return [
    [frame.u[0], frame.v[0], frame.d[0]],
    [frame.u[1], frame.v[1], frame.d[1]],
    [frame.u[2], frame.v[2], frame.d[2]]
  ];
}

function matrixFrame(matrix) {
  return {
    u: [matrix[0][0], matrix[1][0], matrix[2][0]],
    v: [matrix[0][1], matrix[1][1], matrix[2][1]],
    d: [matrix[0][2], matrix[1][2], matrix[2][2]]
  };
}

function normalizeQuaternion(q) {
  const length = Math.hypot(q[0], q[1], q[2], q[3]);
  return q.map(value => value / length);
}

function matrixQuaternion(matrix) {
  const m00 = matrix[0][0], m01 = matrix[0][1], m02 = matrix[0][2];
  const m10 = matrix[1][0], m11 = matrix[1][1], m12 = matrix[1][2];
  const m20 = matrix[2][0], m21 = matrix[2][1], m22 = matrix[2][2];
  const trace = m00 + m11 + m22;
  let q;

  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
  }
  return normalizeQuaternion(q);
}

function quaternionMatrix(quaternion) {
  const [x, y, z, w] = normalizeQuaternion(quaternion);
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;
  return [
    [1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy)],
    [2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx)],
    [2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)]
  ];
}

function slerpQuaternion(from, to, t) {
  let q0 = normalizeQuaternion(from);
  let q1 = normalizeQuaternion(to);
  let cosine = q0.reduce((sum, value, index) => sum + value * q1[index], 0);

  if (cosine < 0) {
    q1 = q1.map(value => -value);
    cosine = -cosine;
  }

  if (cosine > 0.9995) {
    return normalizeQuaternion(q0.map((value, index) => value + (q1[index] - value) * t));
  }

  const theta = Math.acos(clamp(cosine, -1, 1));
  const sinTheta = Math.sin(theta);
  const a = Math.sin((1 - t) * theta) / sinTheta;
  const b = Math.sin(t * theta) / sinTheta;
  return q0.map((value, index) => value * a + q1[index] * b);
}

export function interpolateFrames(from, to, t) {
  if (t <= 0) return { u: from.u.slice(), v: from.v.slice(), d: from.d.slice() };
  if (t >= 1) return { u: to.u.slice(), v: to.v.slice(), d: to.d.slice() };
  const q0 = matrixQuaternion(frameMatrix(from));
  const q1 = matrixQuaternion(frameMatrix(to));
  return matrixFrame(quaternionMatrix(slerpQuaternion(q0, q1, t)));
}

export function projectVertices(vertices, frame) {
  return vertices.map(vertex => [dot3(vertex, frame.u), dot3(vertex, frame.v)]);
}

export function regularEdges(vertices, tolerance = 1.05) {
  let minimum = Infinity;
  for (let i = 0; i < vertices.length; i += 1) {
    for (let j = i + 1; j < vertices.length; j += 1) {
      const distance = Math.hypot(
        vertices[i][0] - vertices[j][0],
        vertices[i][1] - vertices[j][1],
        vertices[i][2] - vertices[j][2]
      );
      if (distance > 1e-12 && distance < minimum) minimum = distance;
    }
  }

  const edges = [];
  for (let i = 0; i < vertices.length; i += 1) {
    for (let j = i + 1; j < vertices.length; j += 1) {
      const distance = Math.hypot(
        vertices[i][0] - vertices[j][0],
        vertices[i][1] - vertices[j][1],
        vertices[i][2] - vertices[j][2]
      );
      if (distance < minimum * tolerance) edges.push([i, j]);
    }
  }
  return edges;
}

export function geometryForSolid(name) {
  const phi = (1 + Math.sqrt(5)) / 2;
  const vertices = [];

  if (name === '정사면체') {
    vertices.push([1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]);
  } else if (name === '정육면체') {
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) vertices.push([x, y, z]);
  } else if (name === '정팔면체') {
    vertices.push([1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]);
  } else if (name === '정십이면체') {
    for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) vertices.push([a, b, c]);
    for (const a of [-1, 1]) for (const b of [-1, 1]) vertices.push([0, a / phi, b * phi]);
    for (const a of [-1, 1]) for (const b of [-1, 1]) vertices.push([a / phi, b * phi, 0]);
    for (const a of [-1, 1]) for (const b of [-1, 1]) vertices.push([a * phi, 0, b / phi]);
  } else if (name === '정이십면체') {
    for (const a of [-1, 1]) for (const b of [-1, 1]) vertices.push([0, a, b * phi]);
    for (const a of [-1, 1]) for (const b of [-1, 1]) vertices.push([a, b * phi, 0]);
    for (const a of [-1, 1]) for (const b of [-1, 1]) vertices.push([a * phi, 0, b]);
  } else {
    throw new Error(`Unsupported Platonic solid: ${name}`);
  }

  return { vertices, edges: regularEdges(vertices) };
}

function cross2(a, b) {
  return a[0] * b[1] - a[1] * b[0];
}

function eventKey(point) {
  const scale = 10 ** EVENT_DIGITS;
  const x = Math.round(point[0] * scale) / scale;
  const y = Math.round(point[1] * scale) / scale;
  return `${x},${y}`;
}

export function projectionEvents(points, edges) {
  const incident = Array.from({ length: points.length }, () => []);
  edges.forEach(([a, b], edgeIndex) => {
    incident[a].push(edgeIndex);
    incident[b].push(edgeIndex);
  });

  const records = [];
  points.forEach((point, vertexIndex) => {
    records.push({ xy: point.slice(), vertexIds: [vertexIndex], edgeIds: incident[vertexIndex].slice() });
  });

  for (let first = 0; first < edges.length; first += 1) {
    const [a, b] = edges[first];
    const p = points[a];
    const r = [points[b][0] - p[0], points[b][1] - p[1]];
    const rr = r[0] * r[0] + r[1] * r[1];

    for (let second = first + 1; second < edges.length; second += 1) {
      const [c, d] = edges[second];
      const q = points[c];
      const s = [points[d][0] - q[0], points[d][1] - q[1]];
      const denominator = cross2(r, s);
      const qp = [q[0] - p[0], q[1] - p[1]];
      const scale = Math.max(1, Math.hypot(...r), Math.hypot(...s));
      const epsilon = 1e-10 * scale * scale;

      if (Math.abs(denominator) > epsilon) {
        const t = cross2(qp, s) / denominator;
        const u = cross2(qp, r) / denominator;
        if (t >= -1e-8 && t <= 1 + 1e-8 && u >= -1e-8 && u <= 1 + 1e-8) {
          records.push({
            xy: [p[0] + t * r[0], p[1] + t * r[1]],
            vertexIds: [],
            edgeIds: [first, second]
          });
        }
      } else if (Math.abs(cross2(qp, r)) <= epsilon && rr > 1e-18) {
        const t0 = (qp[0] * r[0] + qp[1] * r[1]) / rr;
        const qPlusS = [q[0] + s[0] - p[0], q[1] + s[1] - p[1]];
        const t1 = (qPlusS[0] * r[0] + qPlusS[1] * r[1]) / rr;
        const low = Math.max(0, Math.min(t0, t1));
        const high = Math.min(1, Math.max(t0, t1));
        if (high >= low - 1e-8) {
          for (const t of [low, high]) {
            records.push({
              xy: [p[0] + t * r[0], p[1] + t * r[1]],
              vertexIds: [],
              edgeIds: [first, second]
            });
          }
        }
      }
    }
  }

  const clustered = new Map();
  records.forEach(record => {
    const key = eventKey(record.xy);
    const existing = clustered.get(key);
    if (!existing) {
      clustered.set(key, {
        xy: record.xy.slice(),
        vertexIds: new Set(record.vertexIds),
        edgeIds: new Set(record.edgeIds)
      });
      return;
    }
    record.vertexIds.forEach(id => existing.vertexIds.add(id));
    record.edgeIds.forEach(id => existing.edgeIds.add(id));
  });
  return [...clustered.values()];
}

export function projectionMetrics(vertices, edges, frame) {
  const points = projectVertices(vertices, frame);
  const events = projectionEvents(points, edges);
  const vertexEvents = events.filter(event => event.vertexIds.size > 0);
  return {
    crossings: events.filter(event => event.vertexIds.size === 0 && event.edgeIds.size >= 2).length,
    vertexClusters: vertexEvents.length,
    maxVertexOverlap: Math.max(1, ...vertexEvents.map(event => event.vertexIds.size))
  };
}

export function projectionScreenTransform(points, width, height) {
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
