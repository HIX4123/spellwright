import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { geometryForSolid, viewFrame } from '../docs/projection-core.js';
import {
  analyzeProjectionFeatures,
  projectionFeatureItems,
  projectionHashtags
} from '../docs/projection-features.js';

const projections = JSON.parse(await readFile(new URL('../docs/data/projections.json', import.meta.url), 'utf8'));
const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));

function featuresFor(solidName, classId) {
  const solid = projections.solids.find(item => item.name === solidName);
  const viewSolid = views.solids.find(item => item.name === solidName);
  const view = viewSolid.views.find(item => item.classId === classId);
  const geometry = geometryForSolid(solidName);
  return analyzeProjectionFeatures(
    geometry.vertices,
    geometry.edges,
    viewFrame(view.viewDirection, view.rollDegrees)
  );
}

test('all 43 projections expose six stable geometry tags from every visible point', () => {
  let count = 0;
  for (const solid of projections.solids) {
    const viewSolid = views.solids.find(item => item.name === solid.name);
    const viewsByClass = new Map(viewSolid.views.map(view => [view.classId, view]));
    const geometry = geometryForSolid(solid.name);
    for (const item of solid.classes) {
      const view = viewsByClass.get(item.id);
      const features = analyzeProjectionFeatures(
        geometry.vertices,
        geometry.edges,
        viewFrame(view.viewDirection, view.rollDegrees)
      );
      const visiblePointCount = item.vertexClusters + item.crossings;
      assert.equal(projectionFeatureItems(features).length, 6, `${solid.name} class ${item.id}`);
      assert.equal(
        features.layerPointCounts.reduce((sum, value) => sum + value, 0),
        visiblePointCount,
        `${solid.name} class ${item.id} radial layers include projected vertices and crossings`
      );
      assert.ok(features.radialLayers >= 1);
      assert.ok(features.radialLayers <= visiblePointCount);
      assert.equal(features.layerPointCounts.length, features.radialLayers);
      assert.ok(features.hullVertices >= 2);
      assert.ok(features.rotationalOrder >= 1);
      assert.ok(features.symmetryAxes >= 0);

      const tags = projectionHashtags(features);
      assert.ok(tags.filter(tag => tag === '#중심점' || /^#정\d+각핵$/.test(tag)).length <= 1);
      assert.ok(tags.filter(tag => tag === '#짝수대칭' || tag === '#홀수대칭').length <= 1);
      assert.ok(tags.filter(tag => tag === '#저층형' || tag === '#극저층형').length <= 1);
      count += 1;
    }
  }
  assert.equal(count, 43);
});

test('radial layers group all visible points by distance from the projection center', () => {
  const cases = [
    ['정사면체', 3, [1, 2]],
    ['정사면체', 4, [1, 2, 1]],
    ['정사면체', 2, [1, 4]],
    ['정육면체', 6, [2, 2, 4]],
    ['정팔면체', 1, [2, 2]],
    ['정팔면체', 4, [2, 2, 4]],
    ['정십이면체', 4, [2, 2, 2, 4, 2, 4, 4]],
    ['정십이면체', 6, [2, 2, 2, 2, 2, 2, 2, 2, 2, 4]],
    ['정십이면체', 7, [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]],
    ['정십이면체', 8, [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4]],
    ['정십이면체', 10, [6, 12, 4, 4]],
    ['정십이면체', 9, [2, 2, 4, 4, 4, 2, 4, 4]],
    ['정십이면체', 12, [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]],
    ['정십이면체', 14, [2, 10, 2, 4, 2, 4, 4]],
    ['정십이면체', 1, [2, 4, 2, 4]],
    ['정이십면체', 1, [2, 2, 4]],
    ['정이십면체', 4, [2, 2, 2, 2, 2, 2, 2, 2]],
    ['정이십면체', 5, [2, 2, 4, 2, 4, 2, 4, 4, 2]],
    ['정이십면체', 7, [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]],
    ['정이십면체', 8, [2, 2, 4, 4, 4, 2, 2, 4, 4]],
    ['정이십면체', 9, [2, 4, 2, 2, 4, 4, 2, 4, 4]],
    ['정이십면체', 10, [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]],
    ['정이십면체', 11, [12, 16, 4]],
    ['정이십면체', 12, [2, 2, 4, 4, 4, 2, 4, 2, 2, 4, 4]]
  ];

  for (const [solidName, classId, expectedCounts] of cases) {
    const features = featuresFor(solidName, classId);
    assert.equal(features.radialLayers, expectedCounts.length, `${solidName} class ${classId} layer count`);
    assert.deepEqual(features.layerPointCounts, expectedCounts, `${solidName} class ${classId} layer signature`);
  }

  assert.deepEqual(featuresFor('정육면체', 6).layerPointCounts, [2, 2, 4], '소외-전이 stays 2-2-4');

  const threeLayer = projectionHashtags(featuresFor('정육면체', 6));
  assert.ok(threeLayer.includes('#극저층형'));
  const fourLayer = projectionHashtags(featuresFor('정십이면체', 1));
  assert.ok(fourLayer.includes('#저층형'));
  assert.ok(!fourLayer.includes('#극저층형'));
  const sevenLayer = projectionHashtags(featuresFor('정십이면체', 4));
  assert.ok(!sevenLayer.includes('#저층형'));
  assert.ok(!sevenLayer.includes('#극저층형'));
});

test('silhouette symmetry regressions cover reported and audit-discovered cases', () => {
  const cases = [
    ['정육면체', 4, 2],
    ['정팔면체', 4, 2],
    ['정십이면체', 10, 2],
    ['정십이면체', 11, 2],
    ['정십이면체', 12, 2],
    ['정십이면체', 13, 2],
    ['정십이면체', 14, 2],
    ['정이십면체', 6, 2],
    ['정이십면체', 13, 10],
    ['정십이면체', 6, 2],
    ['정십이면체', 8, 2],
    ['정이십면체', 11, 2]
  ];
  for (const [solidName, classId, expectedAxes] of cases) {
    assert.equal(
      featuresFor(solidName, classId).symmetryAxes,
      expectedAxes,
      `${solidName} class ${classId} reflection-axis count`
    );
  }
});

test('canonical high-symmetry views are classified as expected', () => {
  const tetraVertex = featuresFor('정사면체', 1);
  assert.deepEqual(tetraVertex.centerStructure, { kind: 'point' });
  assert.equal(tetraVertex.symmetryAxes, 3);
  assert.equal(tetraVertex.rotationalOrder, 3);
  assert.equal(tetraVertex.hullVertices, 3);
  assert.ok(projectionHashtags(tetraVertex).includes('#중심점'));
  assert.ok(projectionHashtags(tetraVertex).includes('#홀수대칭'));

  const cubeFace = featuresFor('정육면체', 1);
  assert.deepEqual(cubeFace.centerStructure, { kind: 'none' });
  assert.equal(cubeFace.symmetryAxes, 4);
  assert.equal(cubeFace.rotationalOrder, 4);
  assert.equal(cubeFace.hullVertices, 4);
  assert.ok(projectionHashtags(cubeFace).includes('#짝수대칭'));
});
