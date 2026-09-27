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
import {
  activeProjectionEntryIndices,
  availableClassificationValues,
  availableClassificationValuesAcrossEntries,
  filteredProjectionIndices,
  filteredProjectionTargets
} from '../docs/projection-selector.js';
import { analyzeProjectionStructure } from '../docs/projection-geometry-analysis.js';

const projections = JSON.parse(await readFile(new URL('../docs/data/projections.json', import.meta.url), 'utf8'));
const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));

test('structural categories and role search filter projection classes in their original order', () => {
  const solid = projections.solids.find(item => item.name === '정십이면체');
  const viewSolid = views.solids.find(item => item.name === solid.name);
  const geometry = geometryForSolid(solid.name);
  const classifications = new Map(solid.classes.map(item => {
    const view = viewSolid.views.find(candidate => candidate.classId === item.id);
    const structure = analyzeProjectionStructure(
      geometry.vertices,
      geometry.edges,
      viewFrame(view.viewDirection, view.rollDegrees)
    );
    return [item.id, {
      radialLayers: structure.layers.length,
      symmetryAxes: structure.symmetryAxisAngles.length,
      rotationalOrder: structure.rotationalOrder
    }];
  }));
  const sample = classifications.get(solid.classes[0].id);

  assert.deepEqual(
    filteredProjectionIndices(solid.classes, classifications, { radialLayers: sample.radialLayers }),
    solid.classes.flatMap((item, index) =>
      classifications.get(item.id).radialLayers === sample.radialLayers ? [index] : [])
  );
  assert.deepEqual(
    filteredProjectionIndices(solid.classes, classifications, { symmetryAxes: sample.symmetryAxes }),
    solid.classes.flatMap((item, index) =>
      classifications.get(item.id).symmetryAxes === sample.symmetryAxes ? [index] : [])
  );
  assert.deepEqual(
    filteredProjectionIndices(solid.classes, classifications, { rotationalOrder: sample.rotationalOrder }),
    solid.classes.flatMap((item, index) =>
      classifications.get(item.id).rotationalOrder === sample.rotationalOrder ? [index] : [])
  );
  assert.deepEqual(
    filteredProjectionIndices(solid.classes, classifications, {}, '교환'),
    solid.classes.flatMap((item, index) =>
      item.role.name.includes('교환') || item.role.description.includes('교환') || item.role.example.includes('교환') ? [index] : [])
  );
  assert.equal(filteredProjectionIndices(solid.classes, classifications).length, solid.classes.length);

  const allLayerValues = [...new Set(
    solid.classes.map(item => classifications.get(item.id).radialLayers)
  )].sort((a, b) => a - b);
  assert.deepEqual(
    availableClassificationValues(solid.classes, classifications, {}, 'radialLayers'),
    allLayerValues
  );

  const expectedAxesForLayer = [...new Set(
    solid.classes
      .filter(item => classifications.get(item.id).radialLayers === sample.radialLayers)
      .map(item => classifications.get(item.id).symmetryAxes)
  )].sort((a, b) => a - b);
  assert.deepEqual(
    availableClassificationValues(
      solid.classes,
      classifications,
      { radialLayers: sample.radialLayers },
      'symmetryAxes'
    ),
    expectedAxesForLayer
  );
});

test('category toggles support none-as-all and multi-category result unions', () => {
  assert.deepEqual(activeProjectionEntryIndices(5, []), [0, 1, 2, 3, 4]);
  assert.deepEqual(activeProjectionEntryIndices(5, [3, 1, 3]), [1, 3]);

  const role = name => ({
    name,
    structure: '',
    description: '',
    example: ''
  });
  const entries = [
    {
      solid: { classes: [{ id: 1, role: role('a1') }, { id: 2, role: role('a2') }] },
      classificationsByClass: new Map([
        [1, { radialLayers: 2, symmetryAxes: 0, rotationalOrder: 1 }],
        [2, { radialLayers: 3, symmetryAxes: 1, rotationalOrder: 2 }]
      ])
    },
    {
      solid: { classes: [{ id: 1, role: role('b1') }] },
      classificationsByClass: new Map([
        [1, { radialLayers: 4, symmetryAxes: 2, rotationalOrder: 2 }]
      ])
    },
    {
      solid: { classes: [{ id: 1, role: role('c1') }, { id: 2, role: role('c2') }] },
      classificationsByClass: new Map([
        [1, { radialLayers: 2, symmetryAxes: 1, rotationalOrder: 2 }],
        [2, { radialLayers: 5, symmetryAxes: 0, rotationalOrder: 1 }]
      ])
    }
  ];

  assert.deepEqual(
    filteredProjectionTargets(entries, [0, 2], { radialLayers: 2 }),
    [{ entryIndex: 0, classIndex: 0 }, { entryIndex: 2, classIndex: 0 }]
  );
  assert.deepEqual(
    availableClassificationValuesAcrossEntries(
      entries,
      [0, 2],
      { rotationalOrder: 2 },
      'radialLayers'
    ),
    [2, 3]
  );
});

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
