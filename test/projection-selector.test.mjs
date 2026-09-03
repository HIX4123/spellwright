import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  dragProgress,
  geometryForSolid,
  projectionBasis,
  projectionMetrics,
  swipeDirection,
  viewFrame,
  wrapIndex
} from '../docs/projection-core.js';

const projections = JSON.parse(await readFile(new URL('../docs/data/projections.json', import.meta.url), 'utf8'));
const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));

test('wrapIndex cycles projection classes in both directions', () => {
  assert.equal(wrapIndex(6, 6), 0);
  assert.equal(wrapIndex(-1, 6), 5);
  assert.equal(wrapIndex(2, 6), 2);
});

test('horizontal drag maps left to next and right to previous', () => {
  assert.ok(dragProgress(-120, 600) > 0);
  assert.ok(dragProgress(120, 600) < 0);
  assert.equal(swipeDirection(-120, 600, 500), 1);
  assert.equal(swipeDirection(120, 600, 500), -1);
});

test('swipeDirection ignores a short slow drag but accepts a quick flick', () => {
  assert.equal(swipeDirection(-15, 600, 500), 0);
  assert.equal(swipeDirection(-70, 600, 80), 1);
});

test('projection basis is orthonormal', () => {
  const { u, v, d } = projectionBasis([0.2, -0.4, 0.7]);
  const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
  const length = a => Math.hypot(...a);
  assert.ok(Math.abs(length(u) - 1) < 1e-12);
  assert.ok(Math.abs(length(v) - 1) < 1e-12);
  assert.ok(Math.abs(length(d) - 1) < 1e-12);
  assert.ok(Math.abs(dot(u, v)) < 1e-12);
  assert.ok(Math.abs(dot(u, d)) < 1e-12);
  assert.ok(Math.abs(dot(v, d)) < 1e-12);
});

test('all five Platonic solids have the expected edge counts', () => {
  const expected = new Map([
    ['정사면체', 6],
    ['정육면체', 12],
    ['정팔면체', 12],
    ['정십이면체', 30],
    ['정이십면체', 30]
  ]);
  for (const [name, count] of expected) assert.equal(geometryForSolid(name).edges.length, count, name);
});

test('all 43 endpoint views reproduce stored projection topology metrics', () => {
  let count = 0;
  for (const solid of projections.solids) {
    const viewSolid = views.solids.find(item => item.name === solid.name);
    assert.ok(viewSolid, `${solid.name} view data`);
    const viewsByClass = new Map(viewSolid.views.map(view => [view.classId, view]));
    const geometry = geometryForSolid(solid.name);

    for (const item of solid.classes) {
      const view = viewsByClass.get(item.id);
      assert.ok(view, `${solid.name} class ${item.id} view`);
      assert.equal(typeof view.rollDegrees, 'number', `${solid.name} class ${item.id} roll`);
      const metrics = projectionMetrics(
        geometry.vertices,
        geometry.edges,
        viewFrame(view.viewDirection, view.rollDegrees)
      );
      assert.deepEqual(metrics, {
        crossings: item.crossings,
        vertexClusters: item.vertexClusters,
        maxVertexOverlap: item.maxVertexOverlap
      }, `${solid.name} class ${item.id}`);
      count += 1;
    }
  }
  assert.equal(count, 43);
});
