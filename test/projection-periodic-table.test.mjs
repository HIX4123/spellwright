import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildProjectionPeriodicEntries,
  buildProjectionPeriodicRows,
  PERIODIC_GROUPING_MODES,
  renderProjectionPeriodicTable,
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
  assert.ok(Math.max(...serials) <= 999);
  const haeri = entries.filter(entry => entry.solidId === 'tetrahedron');
  assert.deepEqual(Object.fromEntries(haeri.map(entry => [entry.classId, entry.serialNumber])),
    { 1: 516, 2: 599, 3: 0, 4: 598 });
  const serialByClassKey = new Map(entries.map(entry =>
    [entry.solidId + ':' + entry.classId, entry.serialNumber]));
  assert.deepEqual([
    'tetrahedron:3', 'cube:1', 'octahedron:1',
    'dodecahedron:1', 'icosahedron:1'
  ].map(key => serialByClassKey.get(key)), [0, 1, 2, 3, 4]);
  assert.equal(serialByClassKey.get('dodecahedron:4'), 999);
  assert.deepEqual(
    Object.fromEntries(entries.filter(entry => entry.solidId === 'cube')
      .map(entry => [entry.classId, [entry.serialNumber, entry.label]])),
    {
      1: [1, '지향'],
      2: [385, '기피'],
      3: [886, '도달'],
      4: [766, '실위'],
      5: [95, '추방'],
      6: [623, '호명']
    },
    'periodic-table tile labels and global IDs match the Soeoe term reference'
  );
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

test('H, P and attribute grouping produce 6/4/5 rows without losing any class', () => {
  const entries = buildProjectionPeriodicEntries(projections, views);
  assert.deepEqual(PERIODIC_GROUPING_MODES.map(mode => mode.id), ['hull', 'period', 'attribute']);
  for (const [mode, labels] of [
    ['hull', ['H3', 'H4', 'H6', 'H8', 'H10', 'H12']],
    ['period', ['P1', 'P2', 'P3', 'P4']],
    ['attribute', ['정사면체', '정육면체', '정팔면체', '정십이면체', '정이십면체']]
  ]) {
    const rows = buildProjectionPeriodicRows(entries, mode);
    assert.deepEqual(rows.map(row => row.label), labels, mode);
    assert.equal(rows.reduce((n, row) => n + row.entries.length, 0), 43, mode);
    assert.deepEqual(
      rows.flatMap(row => row.entries.map(entry => entry.key)).sort(),
      entries.map(entry => entry.key).sort(), mode
    );
    for (const row of rows) {
      const positions = row.entries.map(entry => entry.packedSerial);
      assert.ok(positions.every(p => p >= -1e-8 && p <= 999 + 1e-8), mode + ' ' + row.key);
      for (let i = 1; i < positions.length; i += 1) {
        assert.ok(row.entries[i].serialNumber > row.entries[i - 1].serialNumber, mode + ' serial order');
        assert.ok(positions[i] - positions[i - 1] >= row.minimumGap - 1e-8,
          mode + ' separation in ' + row.key);
      }
      for (const entry of row.entries) {
        const expectedKey = mode === 'hull' ? 'H' + entry.hullVertices
          : mode === 'period' ? 'P' + entry.period : entry.solidId;
        assert.equal(row.key, expectedKey, mode + ' row membership');
      }
    }
  }
});

test('grouping toggle exposes accessible buttons and re-renders all 43 projections', () => {
  const entries = buildProjectionPeriodicEntries(projections, views);
  for (const [mode, count] of [['hull', 6], ['period', 4], ['attribute', 5]]) {
    const root = { innerHTML: '', querySelectorAll: () => [] };
    renderProjectionPeriodicTable(root, entries, mode);
    assert.equal((root.innerHTML.match(/class="projection-periodic-item/g) || []).length, 43);
    assert.equal((root.innerHTML.match(/data-periodic-row=/g) || []).length, count);
    assert.equal((root.innerHTML.match(/data-periodic-group=/g) || []).length, 3);
    assert.equal((root.innerHTML.match(/aria-pressed="true"/g) || []).length, 1);
    assert.ok(root.innerHTML.includes('data-periodic-group="' + mode + '" aria-pressed="true"'));
    assert.ok(root.innerHTML.includes('data-serial="999"'));
  }
  assert.throws(() => buildProjectionPeriodicRows(entries, 'unknown'), /Unknown projection grouping mode/);
  renderProjectionPeriodicTable({ innerHTML: '', querySelectorAll: () => [] }, entries, 'hull');
});
