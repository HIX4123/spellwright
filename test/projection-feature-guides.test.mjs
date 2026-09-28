import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { geometryForSolid, viewFrame } from '../docs/projection-core.js';
import { analyzeProjectionFeatures } from '../docs/projection-features.js';
import {
  analyzeProjectionGuides,
  distanceToSegment,
  dualPropagationSchedule,
  maximumClearancePointForPolygon,
  medialPropagationSchedule,
  medialAxisSegmentsForPolygon,
  orderedHullBoundary,
  planarDualFromStructure,
  screenLayerRadii
} from '../docs/projection-feature-guides.js';
import { analyzeProjectionStructure } from '../docs/projection-geometry-analysis.js';

const projections = JSON.parse(await readFile(new URL('../docs/data/projections.json', import.meta.url), 'utf8'));
const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));

test('screen guide radii preserve computed concentric radii without visual displacement', () => {
  assert.deepEqual(screenLayerRadii([0.65, 0.68, 0.70, 1.2], 100), [65, 68, 70, 120]);
  assert.deepEqual(screenLayerRadii([0.01, 0.02, 0.03], 100), [1, 2, 3]);
});

test('ordered hull boundary reduces collinear shell points to the visible hull outline', () => {
  assert.deepEqual(
    orderedHullBoundary([[0, 0], [1, 0], [2, 0], [2, 2], [0, 2]]),
    [[0, 0], [2, 0], [2, 2], [0, 2]]
  );
  assert.deepEqual(orderedHullBoundary([[0, 0]]), [[0, 0]]);
});

test('planar dual omits the exterior face and every edge incident to it', () => {
  const square = {
    nodes: [
      { xy: [0, 0] },
      { xy: [1, 0] },
      { xy: [1, 1] },
      { xy: [0, 1] }
    ],
    segments: new Set(['0:1', '1:2', '2:3', '0:3']),
    scale: 1
  };
  const squareDual = planarDualFromStructure(square);
  assert.equal(squareDual.faces.length, 1);
  assert.equal(squareDual.edges.length, 0);
  assert.ok(squareDual.faces.every(face => !('isOuter' in face)));

  const splitRectangle = {
    nodes: [
      { xy: [0, 0] },
      { xy: [1, 0] },
      { xy: [2, 0] },
      { xy: [2, 1] },
      { xy: [1, 1] },
      { xy: [0, 1] }
    ],
    segments: new Set(['0:1', '1:2', '2:3', '3:4', '4:5', '0:5', '1:4']),
    scale: 2
  };
  const splitDual = planarDualFromStructure(splitRectangle);
  assert.equal(splitDual.faces.length, 2);
  assert.equal(splitDual.edges.length, 1);
  assert.deepEqual(
    [splitDual.edges[0].from, splitDual.edges[0].to].sort((a, b) => a - b),
    [0, 1]
  );
});



test('dual propagation starts from a centered dual node when one exists', () => {
  const dualGraph = {
    faces: [
      { dualPoint: [0, 0], centroid: [0, 0], nodeIndices: [] },
      { dualPoint: [2, 0], centroid: [2, 0], nodeIndices: [] }
    ],
    edges: [
      { from: 0, to: 1, segment: [[1, -1], [1, 1]] }
    ]
  };
  const schedule = dualPropagationSchedule(dualGraph, [0, 0], 1000);
  assert.equal(schedule.seedMode, 'center-node');
  assert.equal(schedule.nodeTimes[0], 0);
  assert.ok(schedule.nodeTimes[1] > 0);
  assert.equal(schedule.edgeTimes[0].mode, 'forward');
});

test('dual propagation creates a virtual edge-midpoint seed when an edge crosses the center', () => {
  const dualGraph = {
    faces: [
      { dualPoint: [-2, 0], centroid: [-2, 0], nodeIndices: [] },
      { dualPoint: [2, 0], centroid: [2, 0], nodeIndices: [] }
    ],
    edges: [
      { from: 0, to: 1, segment: [[0, -1], [0, 1]] }
    ]
  };
  const schedule = dualPropagationSchedule(dualGraph, [0, 0], 1000);
  assert.equal(schedule.seedMode, 'center-edge');
  assert.equal(schedule.edgeTimes[0].mode, 'split');
  assert.ok(schedule.nodeTimes[0] > 0 && schedule.nodeTimes[1] > 0);
  assert.equal(schedule.nodeTimes[0], schedule.nodeTimes[1]);
});

test('dual propagation starts every node on the innermost radial tier and meets on equal-level edges', () => {
  const dualGraph = {
    faces: [
      { dualPoint: [-1, 0], centroid: [-1, 0], nodeIndices: [] },
      { dualPoint: [1, 0], centroid: [1, 0], nodeIndices: [] },
      { dualPoint: [0, 4], centroid: [0, 4], nodeIndices: [] }
    ],
    edges: [
      { from: 0, to: 1, segment: [[0, 5], [0, 7]] },
      { from: 0, to: 2, segment: [[-2, 2], [-1, 3]] },
      { from: 1, to: 2, segment: [[1, 3], [2, 2]] }
    ]
  };
  const schedule = dualPropagationSchedule(dualGraph, [0, 0], 1000);
  const nodeSeeds = schedule.seeds.filter(seed => seed.type === 'node').map(seed => seed.node).sort();
  assert.deepEqual(nodeSeeds, [0, 1]);
  assert.deepEqual(schedule.levels, [0, 0, 1]);
  assert.equal(schedule.edgeTimes[0].mode, 'meet');
  assert.equal(schedule.nodeTimes[0], 0);
  assert.equal(schedule.nodeTimes[1], 0);
});

test('edge midpoints participate only in initial seed selection', () => {
  const dualGraph = {
    faces: [
      { dualPoint: [-2, 2], centroid: [-2, 2], nodeIndices: [] },
      { dualPoint: [2, 2], centroid: [2, 2], nodeIndices: [] },
      { dualPoint: [0, 6], centroid: [0, 6], nodeIndices: [] }
    ],
    edges: [
      { from: 0, to: 1, segment: [[0.5, 0.8], [0.5, 1.2]] },
      { from: 1, to: 2, segment: [[1, 4], [2, 4]] }
    ]
  };
  const schedule = dualPropagationSchedule(dualGraph, [0, 0], 1000);
  assert.ok(schedule.seeds.some(seed => seed.type === 'edge' && seed.edgeIndex === 0));
  assert.equal(schedule.edgeTimes[0].mode, 'split');
  assert.ok(schedule.levels[2] > schedule.levels[1]);
});

test('combined medial propagation starts no earlier than its dual node activation', () => {
  const segments = [
    [[0, 0], [10, 0]],
    [[10, 0], [20, 0]]
  ];
  const parts = medialPropagationSchedule(segments, [0, 0], 400, 1000);
  assert.ok(parts.length > 0);
  assert.ok(parts.every(part => part.delayMs >= 400 - 1e-8));
  assert.ok(parts.every(part => part.delayMs + part.durationMs <= 1000 + 1e-8));
});

test('distance field uses Euclidean distance to the nearest point on a segment', () => {
  assert.equal(distanceToSegment([0.5, 1], [0, 0], [1, 0]), 1);
  assert.equal(distanceToSegment([-1, 0], [0, 0], [1, 0]), 1);
  assert.equal(distanceToSegment([0.25, 0], [0, 0], [1, 0]), 0);
});

test('medial axis extraction follows equal-distance boundaries inside a polygon', () => {
  const square = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const segments = medialAxisSegmentsForPolygon(square, 5);
  assert.ok(segments.length > 0);
  assert.ok(segments.flat().every(([x, y]) => x >= 0 && x <= 100 && y >= 0 && y <= 100));
  assert.ok(segments.flat().some(([x, y]) => Math.hypot(x - 50, y - 50) < 8));

  const rectangle = [[0, 0], [160, 0], [160, 80], [0, 80]];
  const rectangleSegments = medialAxisSegmentsForPolygon(rectangle, 5);
  assert.ok(rectangleSegments.length > 0);
  assert.ok(rectangleSegments.flat().some(([, y]) => Math.abs(y - 40) < 6));
});


test('maximum-clearance dual point follows the medial center rather than area centroid', () => {
  const square = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const squareCenter = maximumClearancePointForPolygon(square, 0.01);
  assert.ok(Math.hypot(squareCenter.point[0] - 50, squareCenter.point[1] - 50) < 0.05);
  assert.ok(Math.abs(squareCenter.clearance - 50) < 0.05);

  const rightTriangle = [[0, 0], [4, 0], [0, 3]];
  const triangleCenter = maximumClearancePointForPolygon(rightTriangle, 0.001);
  assert.ok(Math.hypot(triangleCenter.point[0] - 1, triangleCenter.point[1] - 1) < 0.01);
  assert.ok(Math.abs(triangleCenter.clearance - 1) < 0.01);
  assert.ok(
    Math.hypot(triangleCenter.point[0] - 4 / 3, triangleCenter.point[1] - 1) > 0.25,
    'right-triangle dual point should not remain at the area centroid'
  );
});

test('hover guide geometry stays aligned with all 43 feature classifications', () => {
  let count = 0;
  for (const solid of projections.solids) {
    const viewSolid = views.solids.find(item => item.name === solid.name);
    const geometry = geometryForSolid(solid.name);
    for (const item of solid.classes) {
      const view = viewSolid.views.find(candidate => candidate.classId === item.id);
      const frame = viewFrame(view.viewDirection, view.rollDegrees);
      const structure = analyzeProjectionStructure(geometry.vertices, geometry.edges, frame);
      const features = analyzeProjectionFeatures(geometry.vertices, geometry.edges, frame, structure);
      const guides = analyzeProjectionGuides(geometry.vertices, geometry.edges, frame, structure);

      assert.equal(
        guides.symmetryAxisAngles.length,
        features.symmetryAxes,
        `${solid.name} class ${item.id} symmetry guide count`
      );
      assert.equal(
        guides.layerRadii.length,
        features.radialLayers,
        `${solid.name} class ${item.id} radial guide count`
      );
      assert.deepEqual(guides.layerCenter, [0, 0], `${solid.name} class ${item.id} radial guide center`);
      assert.equal(
        guides.hullLayers.length,
        features.convexHullLayers,
        `${solid.name} class ${item.id} convex hull guide count`
      );
      assert.deepEqual(
        guides.hullLayerPointCounts,
        features.convexHullLayerPointCounts,
        `${solid.name} class ${item.id} convex hull layer signature`
      );
      assert.ok(
        guides.dualGraph.faces.every(face => !('isOuter' in face)),
        `${solid.name} class ${item.id} dual graph excludes exterior face`
      );
      assert.ok(
        guides.dualGraph.faces.every(face => (
          Array.isArray(face.dualPoint)
          && face.dualPoint.length === 2
          && face.dualPoint.every(Number.isFinite)
          && Number.isFinite(face.clearance)
          && face.clearance >= 0
        )),
        `${solid.name} class ${item.id} dual nodes use finite maximum-clearance points`
      );
      assert.ok(
        guides.dualGraph.edges.length <= structure.segments.size,
        `${solid.name} class ${item.id} dual graph only keeps internal shared segments`
      );
      assert.ok(
        guides.dualGraph.edges.every(edge => (
          Number.isInteger(edge.from)
          && Number.isInteger(edge.to)
          && edge.from >= 0
          && edge.to >= 0
          && edge.from < guides.dualGraph.faces.length
          && edge.to < guides.dualGraph.faces.length
        )),
        `${solid.name} class ${item.id} dual edges reference only finite faces`
      );
      const propagation = dualPropagationSchedule(
        guides.dualGraph,
        [0, 0],
        1000
      );
      assert.equal(
        propagation.nodeTimes.length,
        guides.dualGraph.faces.length,
        `${solid.name} class ${item.id} dual propagation node timing count`
      );
      assert.equal(
        propagation.edgeTimes.length,
        guides.dualGraph.edges.length,
        `${solid.name} class ${item.id} dual propagation edge timing count`
      );
      assert.ok(
        propagation.nodeTimes.every(time => Number.isFinite(time) && time >= 0 && time <= 1000 + 1e-8),
        `${solid.name} class ${item.id} dual propagation node timings stay within 1000ms`
      );
      assert.ok(
        propagation.edgeTimes.every(({ delayMs, durationMs }) => (
          Number.isFinite(delayMs)
          && Number.isFinite(durationMs)
          && delayMs >= 0
          && durationMs >= 0
          && delayMs + durationMs <= 1000 + 1e-8
        )),
        `${solid.name} class ${item.id} dual propagation edge timings stay within 1000ms`
      );
      assert.ok(guides.layerRadii.every((radius, index, radii) => (
        radius >= 0 && (index === 0 || radius >= radii[index - 1] - 1e-8)
      )), `${solid.name} class ${item.id} layer radii should progress outward`);
      count += 1;
    }
  }
  assert.equal(count, 43);
});
