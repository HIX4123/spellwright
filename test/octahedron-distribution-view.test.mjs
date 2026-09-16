import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  geometryForSolid,
  projectVertices,
  projectionEvents,
  projectionMetrics,
  viewFrame
} from '../docs/projection-core.js';
import { analyzeProjectionFeatures } from '../docs/projection-features.js';

const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));
const octaViews = views.solids.find(solid => solid.name === '정팔면체').views;
const geometry = geometryForSolid('정팔면체');

function frameFor(classId) {
  const view = octaViews.find(candidate => candidate.classId === classId);
  return {
    view,
    frame: viewFrame(view.viewDirection, view.rollDegrees)
  };
}

test('초조-분배 representative stays visibly separate from 초조-방출', () => {
  const emission = frameFor(2);
  const distribution = frameFor(4);

  const emissionMetrics = projectionMetrics(geometry.vertices, geometry.edges, emission.frame);
  const distributionMetrics = projectionMetrics(geometry.vertices, geometry.edges, distribution.frame);
  assert.deepEqual(
    [emissionMetrics.crossings, emissionMetrics.vertexClusters, emissionMetrics.maxVertexOverlap],
    [0, 5, 2],
    '초조-방출 keeps the exact vertex-axis projection'
  );
  assert.deepEqual(
    [distributionMetrics.crossings, distributionMetrics.vertexClusters, distributionMetrics.maxVertexOverlap],
    [2, 6, 1],
    '초조-분배 stays inside its two-crossing topology class'
  );

  const emissionFeatures = analyzeProjectionFeatures(geometry.vertices, geometry.edges, emission.frame);
  const distributionFeatures = analyzeProjectionFeatures(geometry.vertices, geometry.edges, distribution.frame);
  assert.deepEqual(emissionFeatures.centerStructure, { kind: 'point' });
  assert.deepEqual(distributionFeatures.centerStructure, { kind: 'none' });
  assert.deepEqual(distributionFeatures.layerPointCounts, [2, 2, 4]);
  assert.equal(distributionFeatures.symmetryAxes, 2);

  const projected = projectVertices(geometry.vertices, distribution.frame);
  const events = projectionEvents(projected, geometry.edges);
  const radii = events.map(event => Math.hypot(event.xy[0], event.xy[1]));
  const innerRadius = Math.min(...radii);
  const outerRadius = Math.max(...radii);
  assert.ok(innerRadius / outerRadius > 0.2, 'central four points remain visibly separated from the projection center');

  const xs = projected.map(point => point[0]);
  const ys = projected.map(point => point[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  assert.ok(width > height, 'multiple-axis orientation keeps the wider extent horizontal');
});
