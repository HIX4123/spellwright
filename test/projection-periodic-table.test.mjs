import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildProjectionPeriodicEntries,
  layoutProjectionSubrow
} from '../docs/projection-periodic-table.js';

const projections = JSON.parse(await readFile(new URL('../docs/data/projections.json', import.meta.url), 'utf8'));
const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));

function distribution(entries, key) {
  return entries.reduce((result, entry) => {
    result[entry[key]] = (result[entry[key]] || 0) + 1;
    return result;
  }, {});
}

test('projection periodic table preserves all 43 projections on P1-P4', () => {
  const entries = buildProjectionPeriodicEntries(projections, views);

  assert.equal(entries.length, 43);
  assert.deepEqual(distribution(entries, 'period'), { 1: 6, 2: 12, 3: 15, 4: 10 });

  for (const entry of entries) {
    assert.ok(Number.isInteger(entry.period));
    assert.ok(entry.period >= 1 && entry.period <= 4);
    assert.ok(Number.isInteger(entry.hullVertices));
    assert.ok([3, 4, 6, 8, 10, 12].includes(entry.hullVertices));
    assert.ok(Number.isInteger(entry.serialNumber));
    assert.ok(entry.serialNumber >= 0 && entry.serialNumber <= 999);
    assert.match(entry.thumbnailSvg, /^<svg class="projection-periodic-live-svg"/);
    assert.ok(entry.thumbnailSvg.includes('<line '));
    assert.ok(!entry.thumbnailSvg.includes('<img'));
  }

  assert.equal(entries.filter(entry => entry.eulerTrail).length, 8);
  assert.equal(entries.filter(entry => entry.eulerCircuit).length, 4);
});

test('H-P subrows match the structural distribution and H-first order', () => {
  const entries = buildProjectionPeriodicEntries(projections, views);
  const matrix = new Map();

  for (const entry of entries) {
    const key = 'H' + entry.hullVertices + ':P' + entry.period;
    matrix.set(key, (matrix.get(key) || 0) + 1);
  }

  assert.deepEqual(Object.fromEntries(matrix), {
    'H3:P1': 2,
    'H3:P2': 1,
    'H4:P1': 4,
    'H4:P2': 5,
    'H6:P2': 6,
    'H6:P3': 2,
    'H6:P4': 3,
    'H8:P3': 3,
    'H8:P4': 2,
    'H10:P3': 10,
    'H10:P4': 2,
    'H12:P4': 3
  });

  const hierarchy = [...new Set(
    entries
      .slice()
      .sort((first, second) =>
        first.hullVertices - second.hullVertices
        || first.period - second.period)
      .map(entry => 'H' + entry.hullVertices + ':P' + entry.period)
  )];

  assert.deepEqual(hierarchy, [
    'H3:P1', 'H3:P2',
    'H4:P1', 'H4:P2',
    'H6:P2', 'H6:P3', 'H6:P4',
    'H8:P3', 'H8:P4',
    'H10:P3', 'H10:P4',
    'H12:P4'
  ]);
});

test('global serials are unique across all 43 periodic-table entries', () => {
  const entries = buildProjectionPeriodicEntries(projections, views);
  const serials = entries.map(entry => entry.serialNumber);

  assert.equal(new Set(serials).size, 43);
  assert.equal(Math.min(...serials), 0);
  assert.equal(Math.max(...serials), 999);
});

test('subrow layout packs one H-P pair into one line with minimum displacement', () => {
  const sample = [
    { serialNumber: 100, solidOrder: 0, classOrder: 0, hullVertices: 6, period: 3 },
    { serialNumber: 120, solidOrder: 1, classOrder: 0, hullVertices: 6, period: 3 },
    { serialNumber: 180, solidOrder: 2, classOrder: 0, hullVertices: 6, period: 3 },
    { serialNumber: 240, solidOrder: 3, classOrder: 0, hullVertices: 6, period: 3 }
  ];
  const layout = layoutProjectionSubrow(sample, 54);

  assert.deepEqual(layout.entries.map(entry => entry.serialNumber), [100, 120, 180, 240]);
  assert.deepEqual(layout.entries.map(entry => entry.hullVertices), [6, 6, 6, 6]);
  assert.deepEqual(layout.entries.map(entry => entry.period), [3, 3, 3, 3]);
  assert.deepEqual(layout.entries.map(entry => entry.packedSerial), [79, 133, 187, 241]);
  assert.equal(layout.minimumGap, 54);
});

test('packed subrows preserve order, bounds, and minimum spacing for real data', () => {
  const entries = buildProjectionPeriodicEntries(projections, views);
  const groups = new Map();

  for (const entry of entries) {
    const key = entry.hullVertices + ':' + entry.period;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  for (const [key, group] of groups) {
    const layout = layoutProjectionSubrow(group, 54);
    const packed = layout.entries.map(entry => entry.packedSerial);

    assert.ok(packed.every(value => value >= -1e-9 && value <= 999 + 1e-9), key);
    for (let index = 1; index < packed.length; index += 1) {
      assert.ok(packed[index] > packed[index - 1], key + ' order');
      assert.ok(
        packed[index] - packed[index - 1] >= layout.minimumGap - 1e-9,
        key + ' minimum gap'
      );
    }
  }
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
