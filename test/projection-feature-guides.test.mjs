import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { geometryForSolid, viewFrame } from '../docs/projection-core.js';
import { analyzeProjectionFeatures } from '../docs/projection-features.js';
import {
  analyzeProjectionGuides,
  distanceToSegment,
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
      assert.equal(
        guides.arrangementSegments.length,
        structure.segments.size,
        `${solid.name} class ${item.id} distance field segment source`
      );
      assert.ok(
        guides.dualGraph.faces.every(face => !('isOuter' in face)),
        `${solid.name} class ${item.id} dual graph excludes exterior face`
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
      assert.ok(guides.layerRadii.every((radius, index, radii) => (
        radius >= 0 && (index === 0 || radius >= radii[index - 1] - 1e-8)
      )), `${solid.name} class ${item.id} layer radii should progress outward`);
      count += 1;
    }
  }
  assert.equal(count, 43);
});
