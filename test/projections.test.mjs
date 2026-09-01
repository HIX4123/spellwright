import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const projections = JSON.parse(readFileSync(new URL('../docs/data/projections.json', import.meta.url)));

test('publishes all 43 generated projection classes in stable complexity order', () => {
  assert.deepEqual(projections.solids.map(solid => solid.classes.length), [4, 6, 6, 14, 13]);
  assert.equal(projections.solids.flatMap(solid => solid.classes).length, 43);

  for (const solid of projections.solids) {
    const crossings = solid.classes.map(item => item.crossings);
    assert.deepEqual(crossings, crossings.toSorted((a, b) => a - b));
    assert.equal(new Set(solid.classes.map(item => item.id)).size, solid.classes.length);
    for (const item of solid.classes) {
      assert.ok(existsSync(new URL(`../docs/${item.image.slice(2)}`, import.meta.url)), item.image);
    }
  }
});
