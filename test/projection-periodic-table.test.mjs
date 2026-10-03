import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildProjectionPeriodicEntries,
  layoutProjectionPeriod
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
    assert.ok(Number.isInteger(entry.serialNumber));
    assert.ok(entry.serialNumber >= 0 && entry.serialNumber <= 999);
    assert.ok(Number.isInteger(entry.hullVertices));
    assert.match(entry.thumbnailSvg, /^<svg class="projection-periodic-live-svg"/);
    assert.ok(entry.thumbnailSvg.includes('<line '));
    assert.ok(!entry.thumbnailSvg.includes('<img'));
  }

  assert.equal(entries.filter(entry => entry.eulerTrail).length, 8);
  assert.equal(entries.filter(entry => entry.eulerCircuit).length, 4);
});

test('global serials are unique across all 43 periodic-table entries', () => {
  const entries = buildProjectionPeriodicEntries(projections, views);
  const serials = entries.map(entry => entry.serialNumber);

  assert.equal(new Set(serials).size, 43);
  assert.equal(Math.min(...serials), 0);
  assert.equal(Math.max(...serials), 999);
});

test('period layout keeps horizontal serial positions and only adds lanes for close entries', () => {
  const sample = [
    { serialNumber: 100, solidOrder: 0, classOrder: 0 },
    { serialNumber: 120, solidOrder: 1, classOrder: 0 },
    { serialNumber: 180, solidOrder: 2, classOrder: 0 },
    { serialNumber: 240, solidOrder: 3, classOrder: 0 }
  ];
  const layout = layoutProjectionPeriod(sample, 54);

  assert.deepEqual(layout.entries.map(entry => entry.serialNumber), [100, 120, 180, 240]);
  assert.deepEqual(layout.entries.map(entry => entry.lane), [0, 1, 0, 0]);
  assert.equal(layout.laneCount, 2);
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
