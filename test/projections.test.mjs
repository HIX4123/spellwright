import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const projections = JSON.parse(readFileSync(new URL('../docs/data/projections.json', import.meta.url)));

test('publishes all 43 generated projection classes in point-line-face order', () => {
  assert.equal(projections.orientation, 'vertical-axis-wide-horizontal-bottom-heavy');
  assert.equal(projections.sort, 'points-lines-faces-class-id');
  assert.deepEqual(projections.solids.map(solid => solid.classes.length), [4, 6, 6, 14, 13]);
  assert.equal(projections.solids.flatMap(solid => solid.classes).length, 43);
  assert.deepEqual(
    projections.solids.map(solid => solid.classes.map(item => item.id)),
    [
      [3, 4, 1, 2],
      [1, 2, 3, 5, 6, 4],
      [1, 2, 5, 6, 4, 3],
      [1, 4, 6, 5, 7, 8, 2, 10, 11, 9, 12, 13, 14, 3],
      [1, 4, 2, 5, 7, 6, 8, 9, 3, 10, 11, 12, 13],
    ],
  );

  for (const solid of projections.solids) {
    assert.equal(new Set(solid.classes.map(item => item.id)).size, solid.classes.length);
    for (const item of solid.classes) {
      const imagePath = item.image.split('?')[0];
      assert.ok(existsSync(new URL(`../docs/${imagePath.slice(2)}`, import.meta.url)), item.image);
    }
  }
});
