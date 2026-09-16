import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  geometryForSolid,
  projectionMetrics,
  viewFrame
} from '../docs/projection-core.js';
import { analyzeProjectionStructure } from '../docs/projection-geometry-analysis.js';

const projections = JSON.parse(await readFile(new URL('../docs/data/projections.json', import.meta.url), 'utf8'));
const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));
const DEG = 180 / Math.PI;
const SAMPLE_COUNT = 9000;
const MAX_CANDIDATES = 240;

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function length(v) { return Math.hypot(...v); }
function normalize(v) { const n = length(v); return v.map(x => x / n); }
function projectiveAngle(a, b) { return Math.acos(Math.min(1, Math.max(-1, Math.abs(dot(a, b))))) * DEG; }
function canonicalDirection(v) {
  const n = normalize(v);
  const sign = Math.abs(n[0]) > 1e-10 ? Math.sign(n[0]) : Math.abs(n[1]) > 1e-10 ? Math.sign(n[1]) : Math.sign(n[2] || 1);
  return sign < 0 ? n.map(x => -x) : n;
}
function directionKey(v) { return canonicalDirection(v).map(x => x.toFixed(8)).join(','); }
function edgeKey(a, b) { return a < b ? `${a}:${b}` : `${b}:${a}`; }

function adjacencyFor(structure) {
  const adjacency = Array.from({ length: structure.nodes.length }, () => []);
  for (const segment of structure.segments) {
    const [a, b] = segment.split(':').map(Number);
    adjacency[a].push(b);
    adjacency[b].push(a);
  }
  return adjacency;
}

function arrangementSignature(structure) {
  const adjacency = adjacencyFor(structure);
  let labels = structure.nodes.map((node, index) => `${node.vertexMultiplicity}:${node.degree}:${adjacency[index].length}`);
  for (let round = 0; round < 6; round += 1) {
    const descriptors = labels.map((label, index) => `${label}|${adjacency[index].map(n => labels[n]).sort().join(',')}`);
    const dictionary = new Map([...new Set(descriptors)].sort().map((value, index) => [value, String(index)]));
    const next = descriptors.map(value => dictionary.get(value));
    if (next.every((value, index) => value === labels[index])) break;
    labels = next;
  }
  const edgeLabels = [...structure.segments].map(segment => {
    const [a, b] = segment.split(':').map(Number);
    const pair = [labels[a], labels[b]].sort();
    return `${pair[0]}-${pair[1]}`;
  }).sort();
  return `N${structure.nodes.length}|E${structure.segments.size}|V${labels.slice().sort().join(',')}|L${edgeLabels.join(',')}`;
}

function classKey(geometry, item, direction) {
  const frame = viewFrame(direction, 0);
  const metrics = projectionMetrics(geometry.vertices, geometry.edges, frame);
  const structure = analyzeProjectionStructure(geometry.vertices, geometry.edges, frame);
  return `${metrics.crossings}/${metrics.vertexClusters}/${metrics.maxVertexOverlap}|${arrangementSignature(structure)}`;
}

function matrixDet(m) {
  return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
    - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
    + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
}
function inverse3(m) {
  const d = matrixDet(m);
  return [
    [(m[1][1] * m[2][2] - m[1][2] * m[2][1]) / d, (m[0][2] * m[2][1] - m[0][1] * m[2][2]) / d, (m[0][1] * m[1][2] - m[0][2] * m[1][1]) / d],
    [(m[1][2] * m[2][0] - m[1][0] * m[2][2]) / d, (m[0][0] * m[2][2] - m[0][2] * m[2][0]) / d, (m[0][2] * m[1][0] - m[0][0] * m[1][2]) / d],
    [(m[1][0] * m[2][1] - m[1][1] * m[2][0]) / d, (m[0][1] * m[2][0] - m[0][0] * m[2][1]) / d, (m[0][0] * m[1][1] - m[0][1] * m[1][0]) / d]
  ];
}
function matMul(a, b) {
  return Array.from({ length: 3 }, (_, r) => Array.from({ length: 3 }, (_, c) => a[r][0] * b[0][c] + a[r][1] * b[1][c] + a[r][2] * b[2][c]));
}
function matVec(m, v) { return [dot(m[0], v), dot(m[1], v), dot(m[2], v)]; }
function columns(v0, v1, v2) { return [[v0[0], v1[0], v2[0]], [v0[1], v1[1], v2[1]], [v0[2], v1[2], v2[2]]]; }
function gramMatch(a, b, eps = 1e-8) {
  for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) if (Math.abs(dot(a[i], a[j]) - dot(b[i], b[j])) > eps) return false;
  return true;
}
function mapsVertexSet(matrix, vertices, eps = 1e-7) {
  return vertices.every(vertex => {
    const mapped = matVec(matrix, vertex);
    return vertices.some(candidate => Math.hypot(mapped[0] - candidate[0], mapped[1] - candidate[1], mapped[2] - candidate[2]) < eps);
  });
}
function rotationGroup(vertices) {
  let ref = null;
  outer: for (let i = 0; i < vertices.length; i += 1) for (let j = i + 1; j < vertices.length; j += 1) for (let k = j + 1; k < vertices.length; k += 1) {
    const basis = columns(vertices[i], vertices[j], vertices[k]);
    if (Math.abs(matrixDet(basis)) > 1e-6) { ref = [vertices[i], vertices[j], vertices[k]]; break outer; }
  }
  const refMatrix = columns(...ref);
  const refInverse = inverse3(refMatrix);
  const matrices = new Map();
  for (let i = 0; i < vertices.length; i += 1) for (let j = 0; j < vertices.length; j += 1) if (j !== i) for (let k = 0; k < vertices.length; k += 1) if (k !== i && k !== j) {
    const target = [vertices[i], vertices[j], vertices[k]];
    if (!gramMatch(ref, target)) continue;
    const matrix = matMul(columns(...target), refInverse);
    if (matrixDet(matrix) < 0.999999) continue;
    if (!mapsVertexSet(matrix, vertices)) continue;
    const key = matrix.flat().map(value => value.toFixed(7)).join(',');
    matrices.set(key, matrix);
  }
  return [...matrices.values()];
}
function orbit(direction, rotations) {
  const result = new Map();
  for (const rotation of rotations) {
    const candidate = canonicalDirection(matVec(rotation, direction));
    result.set(directionKey(candidate), candidate);
  }
  return [...result.values()];
}

function fibonacciDirections(count) {
  const phi = (1 + Math.sqrt(5)) / 2;
  const result = [];
  for (let i = 0; i < count; i += 1) {
    const z = 1 - 2 * (i + 0.5) / count;
    const radius = Math.sqrt(Math.max(0, 1 - z * z));
    const angle = 2 * Math.PI * i / phi;
    result.push(canonicalDirection([radius * Math.cos(angle), radius * Math.sin(angle), z]));
  }
  return result;
}

function minAngleToSet(direction, directions) {
  let best = 90;
  for (const other of directions) best = Math.min(best, projectiveAngle(direction, other));
  return best;
}
function minPairAngle(selected) {
  let best = 90;
  for (let i = 0; i < selected.length; i += 1) for (let j = i + 1; j < selected.length; j += 1) best = Math.min(best, projectiveAngle(selected[i].direction, selected[j].direction));
  return best;
}

function candidateCompare(a, b) {
  if (b.margin !== a.margin) return b.margin - a.margin;
  return a.key.localeCompare(b.key);
}

function chooseRepresentatives(classes) {
  const selected = classes.map(entry => ({ ...entry, direction: entry.candidates[0].direction }));
  for (let pass = 0; pass < 16; pass += 1) {
    let changed = false;
    for (let index = 0; index < selected.length; index += 1) {
      const others = selected.filter((_, i) => i !== index).map(item => item.direction);
      let best = null;
      for (const candidate of classes[index].candidates) {
        const pairMin = minAngleToSet(candidate.direction, others);
        const sum = others.reduce((total, other) => total + projectiveAngle(candidate.direction, other), 0);
        const score = [pairMin, candidate.margin, sum];
        if (!best || score[0] > best.score[0] + 1e-9
          || (Math.abs(score[0] - best.score[0]) < 1e-9 && score[1] > best.score[1] + 1e-9)
          || (Math.abs(score[0] - best.score[0]) < 1e-9 && Math.abs(score[1] - best.score[1]) < 1e-9 && score[2] > best.score[2])) {
          best = { candidate, score };
        }
      }
      const nextKey = best.candidate.key;
      if (directionKey(selected[index].direction) !== nextKey) changed = true;
      selected[index].direction = best.candidate.direction;
    }
    if (!changed) break;
  }
  return selected;
}

function bboxFor(points) {
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}
function orientedRoll(geometry, direction, fallbackRoll) {
  const base = analyzeProjectionStructure(geometry.vertices, geometry.edges, viewFrame(direction, 0));
  const rolls = [];
  if (base.symmetryAxisAngles.length) {
    for (const axis of base.symmetryAxisAngles) {
      const value = 90 - axis * DEG;
      rolls.push(value, value + 180);
    }
  } else {
    for (let roll = 0; roll < 180; roll += 2) rolls.push(roll);
  }
  let best = null;
  for (const rawRoll of rolls) {
    const roll = ((rawRoll % 360) + 360) % 360;
    const structure = analyzeProjectionStructure(geometry.vertices, geometry.edges, viewFrame(direction, roll));
    const points = structure.nodes.map(node => node.xy);
    const box = bboxFor(points);
    const top = points.filter(p => p[1] > 0).reduce((m, p) => Math.max(m, Math.abs(p[0])), 0);
    const bottom = points.filter(p => p[1] < 0).reduce((m, p) => Math.max(m, Math.abs(p[0])), 0);
    const horizontal = box.width - box.height;
    const bottomHeavy = bottom - top;
    const score = [horizontal, bottomHeavy, -Math.abs((((roll - fallbackRoll + 540) % 360) - 180))];
    if (!best || score[0] > best.score[0] + 1e-8
      || (Math.abs(score[0] - best.score[0]) < 1e-8 && score[1] > best.score[1] + 1e-8)
      || (Math.abs(score[0] - best.score[0]) < 1e-8 && Math.abs(score[1] - best.score[1]) < 1e-8 && score[2] > best.score[2])) best = { roll, score };
  }
  return Number(best.roll.toFixed(6));
}

test('diagnose maximally separated representative view directions', () => {
  const sampleDirections = fibonacciDirections(SAMPLE_COUNT);
  const output = { solids: [], summary: [] };

  for (const solid of projections.solids) {
    const geometry = geometryForSolid(solid.name);
    const viewSolid = views.solids.find(item => item.name === solid.name);
    const rotations = rotationGroup(geometry.vertices);
    const baseline = solid.classes.map(item => {
      const view = viewSolid.views.find(v => v.classId === item.id);
      const direction = canonicalDirection(view.viewDirection);
      return { item, view, direction, key: classKey(geometry, item, direction) };
    });
    const keyGroups = new Map();
    for (const entry of baseline) {
      const list = keyGroups.get(entry.key) || [];
      list.push(entry.item.id);
      keyGroups.set(entry.key, list);
    }
    const collisions = [...keyGroups.entries()].filter(([, ids]) => ids.length > 1);

    const baselineOrbits = new Map(baseline.map(entry => [entry.item.id, orbit(entry.direction, rotations)]));
    const candidatesByClass = new Map(baseline.map(entry => [entry.item.id, new Map()]));
    for (const entry of baseline) {
      for (const direction of baselineOrbits.get(entry.item.id)) candidatesByClass.get(entry.item.id).set(directionKey(direction), direction);
    }

    const uniqueKeyToClass = new Map([...keyGroups.entries()].filter(([, ids]) => ids.length === 1).map(([key, ids]) => [key, ids[0]]));
    for (const direction of sampleDirections) {
      const metrics = projectionMetrics(geometry.vertices, geometry.edges, viewFrame(direction, 0));
      const metricPrefix = `${metrics.crossings}/${metrics.vertexClusters}/${metrics.maxVertexOverlap}|`;
      const possible = baseline.filter(entry => entry.key.startsWith(metricPrefix));
      if (!possible.length) continue;
      const structure = analyzeProjectionStructure(geometry.vertices, geometry.edges, viewFrame(direction, 0));
      const key = `${metricPrefix}${arrangementSignature(structure)}`;
      const classId = uniqueKeyToClass.get(key);
      if (!classId) continue;
      candidatesByClass.get(classId).set(directionKey(direction), direction);
    }

    const allOtherOrbits = entry => baseline.filter(other => other.item.id !== entry.item.id).flatMap(other => baselineOrbits.get(other.item.id));
    const classEntries = baseline.map(entry => {
      const others = allOtherOrbits(entry);
      const candidates = [...candidatesByClass.get(entry.item.id).values()].map(direction => ({
        direction,
        key: directionKey(direction),
        margin: minAngleToSet(direction, others)
      })).sort(candidateCompare).slice(0, MAX_CANDIDATES);
      assert.ok(candidates.length, `${solid.name} class ${entry.item.id} candidates`);
      return { ...entry, candidates };
    });

    const selected = chooseRepresentatives(classEntries);
    const before = baseline.map(entry => ({ id: entry.item.id, direction: entry.direction }));
    const after = selected.map(entry => ({ id: entry.item.id, direction: entry.direction }));
    const selectedViews = selected.map(entry => {
      const rollDegrees = orientedRoll(geometry, entry.direction, entry.view.rollDegrees);
      const metrics = projectionMetrics(geometry.vertices, geometry.edges, viewFrame(entry.direction, rollDegrees));
      assert.deepEqual(metrics, {
        crossings: entry.item.crossings,
        vertexClusters: entry.item.vertexClusters,
        maxVertexOverlap: entry.item.maxVertexOverlap
      }, `${solid.name} class ${entry.item.id} optimized topology`);
      return {
        classId: entry.item.id,
        viewDirection: entry.direction.map(value => Number(value.toFixed(15))),
        rollDegrees,
        fitScore: entry.view.fitScore
      };
    });

    const pairDetails = [];
    for (let i = 0; i < after.length; i += 1) for (let j = i + 1; j < after.length; j += 1) {
      pairDetails.push({ a: after[i].id, b: after[j].id, angle: projectiveAngle(after[i].direction, after[j].direction) });
    }
    pairDetails.sort((a, b) => a.angle - b.angle);
    output.solids.push({ id: viewSolid.id, name: solid.name, views: selectedViews });
    output.summary.push({
      name: solid.name,
      rotationGroup: rotations.length,
      signatureCollisions: collisions.map(([, ids]) => ids),
      minAngleBefore: Number(minPairAngle(before).toFixed(3)),
      minAngleAfter: Number(minPairAngle(after).toFixed(3)),
      closestPairsAfter: pairDetails.slice(0, 5).map(pair => ({ ...pair, angle: Number(pair.angle.toFixed(3)) })),
      candidateCounts: classEntries.map(entry => [entry.item.id, candidatesByClass.get(entry.item.id).size])
    });
  }

  console.log('PROJECTION_OPTIMIZER_SUMMARY');
  console.log(JSON.stringify(output.summary));
  console.log('PROJECTION_OPTIMIZER_VIEWS');
  console.log(JSON.stringify(output.solids));
  assert.equal(output.solids.reduce((sum, solid) => sum + solid.views.length, 0), 43);
});
