import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  dragProgress,
  frameRotationAngle,
  geometryForSolid,
  nearestSymmetryEquivalentFrame,
  platonicRotationSymmetries,
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
  filteredProjectionTargets,
  formatProjectionViewAngle,
  minimalRotationClassOrder
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
      convexHullLayers: structure.convexHullLayers.length,
      symmetryAxes: structure.symmetryAxisAngles.length,
      rotationalOrder: structure.rotationalOrder,
      eulerTrail: structure.eulerTrail
    }];
  }));
  const sample = classifications.get(solid.classes[0].id);

  assert.deepEqual(
    filteredProjectionIndices(solid.classes, classifications, { radialLayers: sample.radialLayers }),
    solid.classes.flatMap((item, index) =>
      classifications.get(item.id).radialLayers === sample.radialLayers ? [index] : [])
  );
  assert.deepEqual(
    filteredProjectionIndices(solid.classes, classifications, { convexHullLayers: sample.convexHullLayers }),
    solid.classes.flatMap((item, index) =>
      classifications.get(item.id).convexHullLayers === sample.convexHullLayers ? [index] : [])
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
    filteredProjectionIndices(solid.classes, classifications, { eulerTrail: sample.eulerTrail }),
    solid.classes.flatMap((item, index) =>
      classifications.get(item.id).eulerTrail === sample.eulerTrail ? [index] : [])
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

  const allHullLayerValues = [...new Set(
    solid.classes.map(item => classifications.get(item.id).convexHullLayers)
  )].sort((a, b) => a - b);
  assert.deepEqual(
    availableClassificationValues(solid.classes, classifications, {}, 'convexHullLayers'),
    allHullLayerValues
  );

  const allEulerValues = [...new Set(
    solid.classes.map(item => classifications.get(item.id).eulerTrail)
  )].sort((a, b) => Number(a) - Number(b));
  assert.deepEqual(
    availableClassificationValues(solid.classes, classifications, {}, 'eulerTrail'),
    allEulerValues
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
        [1, { radialLayers: 2, convexHullLayers: 1, symmetryAxes: 0, rotationalOrder: 1, eulerTrail: true }],
        [2, { radialLayers: 3, convexHullLayers: 2, symmetryAxes: 1, rotationalOrder: 2, eulerTrail: false }]
      ])
    },
    {
      solid: { classes: [{ id: 1, role: role('b1') }] },
      classificationsByClass: new Map([
        [1, { radialLayers: 4, convexHullLayers: 3, symmetryAxes: 2, rotationalOrder: 2, eulerTrail: true }]
      ])
    },
    {
      solid: { classes: [{ id: 1, role: role('c1') }, { id: 2, role: role('c2') }] },
      classificationsByClass: new Map([
        [1, { radialLayers: 2, convexHullLayers: 2, symmetryAxes: 1, rotationalOrder: 2, eulerTrail: false }],
        [2, { radialLayers: 5, convexHullLayers: 4, symmetryAxes: 0, rotationalOrder: 1, eulerTrail: true }]
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
  assert.deepEqual(
    filteredProjectionTargets(entries, [0, 2], { convexHullLayers: 2 }),
    [{ entryIndex: 0, classIndex: 1 }, { entryIndex: 2, classIndex: 0 }]
  );
  assert.deepEqual(
    filteredProjectionTargets(entries, [0, 2], { eulerTrail: true }),
    [{ entryIndex: 0, classIndex: 0 }, { entryIndex: 2, classIndex: 1 }]
  );
  assert.deepEqual(
    availableClassificationValuesAcrossEntries(entries, [0, 2], {}, 'eulerTrail'),
    [false, true]
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


test('Platonic rotational symmetry groups have the expected orders', () => {
  const expected = new Map([
    ['정사면체', 12],
    ['정육면체', 24],
    ['정팔면체', 24],
    ['정십이면체', 60],
    ['정이십면체', 60]
  ]);
  for (const [name, order] of expected) {
    const geometry = geometryForSolid(name);
    assert.equal(platonicRotationSymmetries(geometry.vertices).length, order, name);
  }
});

test('symmetry-equivalent targets never require more rotation than the canonical target', () => {
  for (const solid of projections.solids) {
    const geometry = geometryForSolid(solid.name);
    const rotations = platonicRotationSymmetries(geometry.vertices);
    const viewSolid = views.solids.find(item => item.name === solid.name);
    const frames = viewSolid.views.map(view => viewFrame(view.viewDirection, view.rollDegrees));

    for (let index = 0; index < frames.length; index += 1) {
      const source = frames[index];
      const target = frames[(index + 1) % frames.length];
      const canonicalAngle = frameRotationAngle(source, target);
      const optimized = nearestSymmetryEquivalentFrame(source, target, rotations);
      assert.ok(optimized.angle <= canonicalAngle + 1e-10, `${solid.name} ${index}`);
    }
  }
});

test('symmetry optimization finds a zero-turn equivalent for a symmetry-rotated frame', () => {
  const geometry = geometryForSolid('정육면체');
  const rotations = platonicRotationSymmetries(geometry.vertices);
  const source = viewFrame([1, 1, 1], 17);
  const rotatedTarget = {
    u: rotations[1].map(row => row.reduce((sum, value, index) => sum + value * source.u[index], 0)),
    v: rotations[1].map(row => row.reduce((sum, value, index) => sum + value * source.v[index], 0)),
    d: rotations[1].map(row => row.reduce((sum, value, index) => sum + value * source.d[index], 0))
  };
  const optimized = nearestSymmetryEquivalentFrame(source, rotatedTarget, rotations);
  assert.ok(optimized.angle < 1e-7);
});

test('default class order minimizes the symmetry-aware cyclic rotation path', () => {
  for (const solid of projections.solids) {
    const geometry = geometryForSolid(solid.name);
    const rotations = platonicRotationSymmetries(geometry.vertices);
    const viewSolid = views.solids.find(item => item.name === solid.name);
    const viewsByClass = new Map(viewSolid.views.map(view => [view.classId, view]));
    const ordered = minimalRotationClassOrder(
      solid.classes,
      viewsByClass,
      geometry,
      rotations
    );

    assert.equal(ordered[0].id, solid.classes[0].id, solid.name + ' keeps its default entry class');
    assert.deepEqual(
      [...ordered.map(item => item.id)].sort((a, b) => a - b),
      [...solid.classes.map(item => item.id)].sort((a, b) => a - b),
      solid.name + ' preserves every class exactly once'
    );

    const frameForItem = item => {
      const view = viewsByClass.get(item.id);
      return viewFrame(view.viewDirection, view.rollDegrees);
    };
    const cycleCost = items => items.reduce((sum, item, itemIndex) => {
      const next = items[(itemIndex + 1) % items.length];
      return sum + nearestSymmetryEquivalentFrame(
        frameForItem(item),
        frameForItem(next),
        rotations
      ).angle;
    }, 0);

    assert.ok(
      cycleCost(ordered) <= cycleCost(solid.classes) + 1e-10,
      solid.name + ' optimized order should never rotate more than the stored order'
    );
  }
});


test('symmetry-reduced view-angle identifiers are unique within each solid', () => {
  for (const solid of projections.solids) {
    const geometry = geometryForSolid(solid.name);
    const rotations = platonicRotationSymmetries(geometry.vertices);
    const viewSolid = views.solids.find(item => item.name === solid.name);
    const viewsByClass = new Map(viewSolid.views.map(view => [view.classId, view]));
    const referenceView = viewsByClass.get(solid.classes[0].id);
    const referenceFrame = viewFrame(referenceView.viewDirection, referenceView.rollDegrees);

    const identifiers = solid.classes.map(item => {
      const view = viewsByClass.get(item.id);
      const frame = viewFrame(view.viewDirection, view.rollDegrees);
      const angle = nearestSymmetryEquivalentFrame(referenceFrame, frame, rotations).angle * 180 / Math.PI;
      return formatProjectionViewAngle(angle);
    });

    assert.equal(identifiers[0], '0.00°', solid.name + ' reference view');
    assert.equal(new Set(identifiers).size, identifiers.length, solid.name + ' unique view angles');
  }
});
