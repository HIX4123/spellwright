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

test('all 43 projections expose six stable geometry tags', () => {
  let count = 0;
  const layerSummary = [];
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
      assert.equal(projectionFeatureItems(features).length, 6, `${solid.name} class ${item.id}`);
      assert.equal(
        features.layerPointCounts.reduce((sum, value) => sum + value, 0),
        item.vertexClusters,
        `${solid.name} class ${item.id} radial layers cover every projected vertex cluster`
      );
      assert.ok(features.radialLayers >= 1);
      assert.ok(features.radialLayers <= item.vertexClusters);
      assert.equal(features.layerPointCounts.length, features.radialLayers);
      assert.ok(features.hullVertices >= 2);
      assert.ok(features.rotationalOrder >= 1);
      assert.ok(features.symmetryAxes >= 0);

      const tags = projectionHashtags(features);
      assert.ok(tags.filter(tag => tag === '#중심점' || /^#정\d+각핵$/.test(tag)).length <= 1);
      assert.ok(tags.filter(tag => tag === '#짝수대칭' || tag === '#홀수대칭').length <= 1);
      assert.ok(tags.filter(tag => tag === '#저층형' || tag === '#극저층형').length <= 1);
      layerSummary.push(`${solid.name}#${item.id}:${features.layerPointCounts.join('-')}`);
      count += 1;
    }
  }
  console.log(`projection layer audit: ${layerSummary.join(', ')}`);
  assert.equal(count, 43);
});

test('radial layers count nested hull corners rather than distinct radii', () => {
  const dissociationBarrier = featuresFor('정사면체', 4);
  assert.equal(dissociationBarrier.radialLayers, 2);
  assert.deepEqual(dissociationBarrier.layerPointCounts, [1, 3]);

  const tetraVertex = featuresFor('정사면체', 1);
  assert.equal(tetraVertex.radialLayers, 2);
  assert.deepEqual(tetraVertex.layerPointCounts, [1, 3]);

  const tetraEdge = featuresFor('정사면체', 2);
  assert.equal(tetraEdge.radialLayers, 1);
  assert.deepEqual(tetraEdge.layerPointCounts, [4]);

  const cubeFace = featuresFor('정육면체', 1);
  assert.equal(cubeFace.radialLayers, 1);
  assert.deepEqual(cubeFace.layerPointCounts, [4]);

  const octaVertex = featuresFor('정팔면체', 2);
  assert.equal(octaVertex.radialLayers, 2);
  assert.deepEqual(octaVertex.layerPointCounts, [1, 4]);
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
