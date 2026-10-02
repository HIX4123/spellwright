import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProjectionPeriodicEntries } from '../docs/projection-periodic-table.js';

const projections = JSON.parse(await readFile(new URL('../docs/data/projections.json', import.meta.url), 'utf8'));
const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));

function distribution(entries, key) {
  return entries.reduce((result, entry) => {
    result[entry[key]] = (result[entry[key]] || 0) + 1;
    return result;
  }, {});
}

test('projection periodic table uses convex-hull depth and outer hull vertex count', () => {
  const entries = buildProjectionPeriodicEntries(projections, views);

  assert.equal(entries.length, 43);
  assert.deepEqual(distribution(entries, 'period'), { 1: 6, 2: 12, 3: 15, 4: 10 });
  assert.deepEqual(distribution(entries, 'group'), { 3: 3, 4: 9, 6: 11, 8: 5, 10: 12, 12: 3 });

  for (const entry of entries) {
    assert.ok(Number.isInteger(entry.period));
    assert.ok(entry.period >= 1 && entry.period <= 4);
    assert.ok([3, 4, 6, 8, 10, 12].includes(entry.group));
    assert.equal(entry.group, entry.hullVertices);
    assert.ok(Number.isInteger(entry.serialNumber));
    assert.ok(entry.serialNumber >= 0 && entry.serialNumber <= 999);
    assert.match(entry.thumbnailSvg, /^<svg class="projection-periodic-live-svg"/);
    assert.ok(entry.thumbnailSvg.includes('<line '));
    assert.ok(!entry.thumbnailSvg.includes('<img'));
  }
});

test('outer-hull grouping preserves all projections and expected cell collisions', () => {
  const entries = buildProjectionPeriodicEntries(projections, views);
  const cells = new Map();

  entries.forEach(entry => {
    const key = entry.period + ':' + entry.group;
    cells.set(key, (cells.get(key) || 0) + 1);
  });

  assert.equal(cells.size, 12);
  assert.equal(Math.max(...cells.values()), 10);
  assert.equal([...cells.values()].filter(count => count === 1).length, 1);
  assert.equal([...cells.values()].reduce((sum, count) => sum + count, 0), 43);
  assert.equal(entries.filter(entry => entry.eulerTrail).length, 8);
  assert.equal(entries.filter(entry => entry.eulerCircuit).length, 4);
});


test('projection thumbnails are derived from the current representative view', () => {
  const baseline = buildProjectionPeriodicEntries(projections, views);
  const shiftedViews = structuredClone(views);
  const firstView = shiftedViews.solids[0].views[0];
  firstView.rollDegrees += 17;
  const shifted = buildProjectionPeriodicEntries(projections, shiftedViews);

  const baselineEntry = baseline.find(entry =>
    entry.solidId === shiftedViews.solids[0].id && entry.classId === firstView.classId);
  const shiftedEntry = shifted.find(entry =>
    entry.solidId === shiftedViews.solids[0].id && entry.classId === firstView.classId);

  assert.ok(baselineEntry);
  assert.ok(shiftedEntry);
  assert.notEqual(
    shiftedEntry.thumbnailSvg,
    baselineEntry.thumbnailSvg,
    'changing the current representative view must immediately change the table thumbnail'
  );
});





test('periodic entries expose unique #000-#999 projection serials within each solid', () => {
  const entries = buildProjectionPeriodicEntries(projections, views);
  for (const solid of projections.solids) {
    const solidEntries = entries.filter(entry => entry.solidId === solid.id);
    const serials = solidEntries.map(entry => entry.serialNumber);
    assert.equal(new Set(serials).size, serials.length, solid.name);
    assert.ok(serials.every(value => Number.isInteger(value) && value >= 0 && value <= 999));
  }
});
