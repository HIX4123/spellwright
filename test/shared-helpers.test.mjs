import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, section } from '../docs/html.js';
import { projectionScreenTransform } from '../docs/projection-core.js';
import { convexHullIndices, groupedRadiusBands } from '../docs/projection-geometry-analysis.js';
import { distanceToSegment } from '../docs/projection-feature-guides.js';

test('shared geometry keeps degenerate cases, caller tolerances, and viewport orientation', () => {
  const nodes = [[0, 0], [1, 0.001], [2, 0]].map(xy => ({ xy }));
  assert.deepEqual(convexHullIndices(nodes, [], 0), []);
  assert.deepEqual(convexHullIndices(nodes, [1], 0), [1]);
  assert.deepEqual(convexHullIndices(nodes, [2, 0], 0), [2, 0]);
  assert.equal(convexHullIndices(nodes, [0, 1, 2], 0).length, 3);
  assert.deepEqual(convexHullIndices(nodes, [0, 1, 2], 0.01), [0, 2]);
  const radial = [1, 1.001, 2].map(x => ({ xy: [x, 0] }));
  assert.equal(groupedRadiusBands(radial, 0.00001).length, 3);
  assert.deepEqual(groupedRadiusBands(radial, 0.002).map(band => band.nodeIndices), [[0, 1], [2]]);
  assert.equal(distanceToSegment([3, 4], [0, 0], [0, 0]), 5);
  for (const [width, height] of [[390, 300], [800, 600]]) {
    const transform = projectionScreenTransform([[2, 3], [6, 5]], width, height);
    assert.deepEqual(transform.point([4, 4]), [width / 2, height / 2]);
    assert.ok(transform.point([2, 5])[1] < height / 2);
    assert.ok(transform.point([6, 3])[0] < width);
    assert.deepEqual(projectionScreenTransform([[2, 3]], width, height).point([2, 3]), [width / 2, height / 2]);
  }
});

test('shared HTML helpers escape text and attribute delimiters', () => {
  assert.equal(escapeHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#039;');
  assert.equal(escapeHtml(0), '0');
  assert.equal(escapeHtml(), '');
  assert.equal(section('<title>', '&subtitle'), '<div class="section-head"><h2>&lt;title&gt;</h2><p>&amp;subtitle</p></div>');
});
