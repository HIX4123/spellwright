import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { geometryForSolid, projectVertices, projectionEvents, viewFrame } from '../docs/projection-core.js';

const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));
const projections = JSON.parse(await readFile(new URL('../docs/data/projections.json', import.meta.url), 'utf8'));

function normalize(v) {
  const n = Math.hypot(...v);
  return v.map(value => value / n);
}
function dot(a, b) { return a.reduce((sum, value, index) => sum + value * b[index], 0); }
function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function projectiveAngle(a, b) {
  const cosine = Math.min(1, Math.max(-1, Math.abs(dot(normalize(a), normalize(b)))));
  return Math.acos(cosine);
}
function degrees(radians) { return radians * 180 / Math.PI; }

function topologySignature(geometry, direction) {
  const points = projectVertices(geometry.vertices, viewFrame(direction, 0));
  const events = projectionEvents(points, geometry.edges);
  const vertices = events.filter(event => event.vertexIds.size > 0)
    .map(event => [...event.vertexIds].sort((a,b) => a-b).join(','))
    .sort().join('|');
  const crossings = events.filter(event => event.vertexIds.size === 0 && event.edgeIds.size >= 2)
    .map(event => [...event.edgeIds].sort((a,b) => a-b).join(','))
    .sort().join('|');
  return `${vertices}::${crossings}`;
}

function tangentBasis(direction) {
  const d = normalize(direction);
  const seed = Math.abs(d[0]) < 0.8 ? [1,0,0] : [0,1,0];
  const u = normalize(cross(d, seed));
  const v = cross(d, u);
  return { d, u, v };
}

function capCandidates(direction, maxDegrees = 28) {
  const { d, u, v } = tangentBasis(direction);
  const result = [d];
  for (let radiusDegrees = 1; radiusDegrees <= maxDegrees; radiusDegrees += 1) {
    const radius = radiusDegrees * Math.PI / 180;
    const ringCount = Math.max(24, Math.round(2 * Math.PI * radiusDegrees));
    for (let index = 0; index < ringCount; index += 1) {
      const azimuth = 2 * Math.PI * index / ringCount;
      const tangent = u.map((value, axis) => value * Math.cos(azimuth) + v[axis] * Math.sin(azimuth));
      result.push(normalize(d.map((value, axis) => value * Math.cos(radius) + tangent[axis] * Math.sin(radius))));
    }
  }
  return result;
}

function minimumSeparation(direction, entries, selfIndex) {
  let minimum = Infinity;
  for (let index = 0; index < entries.length; index += 1) {
    if (index === selfIndex) continue;
    minimum = Math.min(minimum, projectiveAngle(direction, entries[index].viewDirection));
  }
  return minimum;
}

test('search deeper representatives inside each current topology cell', () => {
  for (const solidViews of views.solids) {
    const geometry = geometryForSolid(solidViews.name);
    const meta = projections.solids.find(item => item.name === solidViews.name);
    const entries = solidViews.views.map(view => ({ ...view, viewDirection: normalize(view.viewDirection) }));
    const refs = entries.map(entry => topologySignature(geometry, entry.viewDirection));
    const beforeMinimum = Math.min(...entries.map((entry, index) => minimumSeparation(entry.viewDirection, entries, index)));

    for (let pass = 0; pass < 3; pass += 1) {
      const order = entries.map((entry, index) => ({ index, separation: minimumSeparation(entry.viewDirection, entries, index) }))
        .sort((a,b) => a.separation - b.separation);
      for (const { index } of order) {
        const base = entries[index].viewDirection;
        let best = base;
        let bestScore = minimumSeparation(base, entries, index);
        for (const candidate of capCandidates(base)) {
          if (topologySignature(geometry, candidate) !== refs[index]) continue;
          const score = minimumSeparation(candidate, entries, index);
          if (score > bestScore + 1e-8) {
            best = candidate;
            bestScore = score;
          }
        }
        entries[index].viewDirection = best;
      }
    }

    const afterMinimum = Math.min(...entries.map((entry, index) => minimumSeparation(entry.viewDirection, entries, index)));
    const rows = entries.map((entry, index) => ({
      classId: entry.classId,
      role: meta.classes.find(item => item.id === entry.classId)?.role?.name,
      direction: entry.viewDirection.map(value => Number(value.toFixed(12))),
      nearestDegrees: Number(degrees(minimumSeparation(entry.viewDirection, entries, index)).toFixed(4)),
      movedDegrees: Number(degrees(projectiveAngle(entry.viewDirection, solidViews.views[index].viewDirection)).toFixed(4))
    }));
    console.log(`VIEW-OPTIMIZER ${solidViews.name} before=${degrees(beforeMinimum).toFixed(4)} after=${degrees(afterMinimum).toFixed(4)} ${JSON.stringify(rows)}`);
  }
});
