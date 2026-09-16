import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));

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
  return solid.views.find(item => item.classId === classId).viewDirection;
}

function assertSeparated(solidName, firstId, secondId, minimumDegrees, label) {
  const angle = projectiveAngleDegrees(
    directionFor(solidName, firstId),
    directionFor(solidName, secondId)
  );
  assert.ok(angle >= minimumDegrees, `${label}: ${angle.toFixed(3)}° should be >= ${minimumDegrees}°`);
}

test('general-cell representatives stay visibly away from formerly collapsed neighbors', () => {
  assertSeparated('정십이면체', 1, 10, 10, '고착 결속-교환');
  assertSeparated('정십이면체', 10, 11, 8, '고착 교환-연쇄');
  assertSeparated('정십이면체', 11, 13, 6, '고착 연쇄-다중 종속');
  assertSeparated('정십이면체', 4, 14, 5, '고착 고정-관계망');

  assertSeparated('정이십면체', 1, 6, 10, '반추 보존-치환');
  assertSeparated('정이십면체', 6, 11, 7, '반추 치환-재합류');
  assertSeparated('정이십면체', 3, 13, 5, '반추 확산-확정');
});
