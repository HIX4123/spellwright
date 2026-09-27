import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { geometryForSolid, viewFrame } from '../docs/projection-core.js';
import { analyzeProjectionFeatures } from '../docs/projection-features.js';
import { analyzeProjectionGuides, orderedHullBoundary, screenLayerRadii } from '../docs/projection-feature-guides.js';

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

test('hover guide geometry stays aligned with all 43 feature classifications', () => {
  let count = 0;
  for (const solid of projections.solids) {
    const viewSolid = views.solids.find(item => item.name === solid.name);
    const geometry = geometryForSolid(solid.name);
    for (const item of solid.classes) {
      const view = viewSolid.views.find(candidate => candidate.classId === item.id);
      const frame = viewFrame(view.viewDirection, view.rollDegrees);
      const features = analyzeProjectionFeatures(geometry.vertices, geometry.edges, frame);
      const guides = analyzeProjectionGuides(geometry.vertices, geometry.edges, frame);

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
      assert.ok(guides.layerRadii.every((radius, index, radii) => (
        radius >= 0 && (index === 0 || radius >= radii[index - 1] - 1e-8)
      )), `${solid.name} class ${item.id} layer radii should progress outward`);
      count += 1;
    }
  }
  assert.equal(count, 43);
});
