import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CORE_BLOCKS,
  buildProjectionPeriodicEntries,
  projectionCoreBlock
} from '../docs/projection-periodic-table.js';

const projections = JSON.parse(await readFile(new URL('../docs/data/projections.json', import.meta.url), 'utf8'));
const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));

function distribution(entries, key) {
  return entries.reduce((result, entry) => {
    result[entry[key]] = (result[entry[key]] || 0) + 1;
    return result;
  }, {});
}

test('projection periodic table keeps the B-axis classification and adds mutually exclusive core blocks', () => {
  const entries = buildProjectionPeriodicEntries(projections, views);

  assert.equal(entries.length, 43);
  assert.deepEqual(distribution(entries, 'period'), { 1: 6, 2: 12, 3: 15, 4: 10 });
  assert.deepEqual(distribution(entries, 'group'), { 1: 9, 2: 7, 3: 10, 4: 5, 5: 10, 6: 2 });
  assert.deepEqual(distribution(entries, 'coreBlock'), { ring: 27, point: 6, pair: 10 });
  assert.deepEqual(CORE_BLOCKS.map(block => block.id), ['point', 'pair', 'ring']);

  assert.equal(projectionCoreBlock(1), 'point');
  assert.equal(projectionCoreBlock(2), 'pair');
  assert.equal(projectionCoreBlock(3), 'ring');
  assert.equal(projectionCoreBlock(10), 'ring');

  for (const entry of entries) {
    assert.ok(Number.isInteger(entry.period));
    assert.ok(entry.period >= 1 && entry.period <= 4);
    assert.ok(Number.isInteger(entry.group));
    assert.ok(entry.group >= 1 && entry.group <= 6);
    assert.ok(Number.isInteger(entry.coreSize));
    assert.ok(entry.coreSize >= 1);
    assert.equal(entry.hullVertices % entry.rotationalOrder, 0);
    assert.equal(entry.group, entry.hullVertices / entry.rotationalOrder);
    assert.equal(entry.coreBlock, projectionCoreBlock(entry.coreSize));
  }
});

test('core blocks expand collisions while preserving every projection', () => {
  const entries = buildProjectionPeriodicEntries(projections, views);
  const cells = new Map();

  entries.forEach(entry => {
    const key = entry.period + ':' + entry.group + ':' + entry.coreBlock;
    cells.set(key, (cells.get(key) || 0) + 1);
  });

  assert.equal(cells.size, 22);
  assert.equal(Math.max(...cells.values()), 6);
  assert.equal([...cells.values()].reduce((sum, count) => sum + count, 0), 43);
  assert.equal(entries.filter(entry => entry.eulerTrail).length, 8);
  assert.equal(entries.filter(entry => entry.eulerCircuit).length, 4);
});
