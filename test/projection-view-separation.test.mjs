import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));
const minimumBySolid = new Map([
  ['정사면체', 54.0],
  ['정육면체', 46.0],
  ['정팔면체', 44.9],
  ['정십이면체', 32.0],
  ['정이십면체', 31.0]
]);

function normalize(vector) {
  const length = Math.hypot(...vector);
  return vector.map(value => value / length);
}

function projectiveAngleDegrees(first, second) {
  const a = normalize(first);
  const b = normalize(second);
  const dot = a.reduce((sum, value, index) => sum + value * b[index], 0);
  return Math.acos(Math.min(1, Math.max(-1, Math.abs(dot)))) * 180 / Math.PI;
}

function directionFor(solidName, classId) {
  const solid = views.solids.find(item => item.name === solidName);
  const view = solid?.views.find(item => item.classId === classId);
  assert.ok(view, `${solidName} class ${classId} representative exists`);
  return view.viewDirection;
}

test('all representative directions stay globally separated within each solid', () => {
  for (const solid of views.solids) {
    const minimum = minimumBySolid.get(solid.name);
    assert.ok(minimum, `${solid.name} separation threshold`);
    for (let first = 0; first < solid.views.length; first += 1) {
      for (let second = first + 1; second < solid.views.length; second += 1) {
        const a = solid.views[first];
        const b = solid.views[second];
        const angle = projectiveAngleDegrees(a.viewDirection, b.viewDirection);
        assert.ok(
          angle >= minimum,
          `${solid.name} classes ${a.classId}/${b.classId}: ${angle.toFixed(3)}° should be >= ${minimum}°`
        );
      }
    }
  }
});

test('formerly collapsed representative pairs stay visibly separated', () => {
  const bindingExchange = projectiveAngleDegrees(
    directionFor('정십이면체', 1),
    directionFor('정십이면체', 10)
  );
  assert.ok(bindingExchange >= 75, `고착 결속-교환: ${bindingExchange.toFixed(3)}° should be >= 75°`);

  const emissionDistribution = projectiveAngleDegrees(
    directionFor('정팔면체', 2),
    directionFor('정팔면체', 4)
  );
  assert.ok(emissionDistribution >= 45, `초조 방출-분배: ${emissionDistribution.toFixed(3)}° should be >= 45°`);
});
