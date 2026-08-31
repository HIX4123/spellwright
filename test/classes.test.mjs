import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const data = JSON.parse(readFileSync(new URL('../docs/data/classes.json', import.meta.url)));

const coreStats = ['health', 'mana', 'circle', 'engraving-capacity', 'insight', 'mental-strength'];
const expectedPairCount = coreStats.length * (coreStats.length - 1) / 2;

const nameToId = new Map([
  ['체력', 'health'],
  ['마력', 'mana'],
  ['서클', 'circle'],
  ['각인력', 'engraving-capacity'],
  ['통찰력', 'insight'],
  ['정신력', 'mental-strength']
]);

function pairKey(stats) {
  return stats.map(name => nameToId.get(name)).sort().join('::');
}

test('keeps all class drafts in review status', () => {
  assert.equal(data.classes.length, 16);
  assert.ok(data.classes.every(item => item.status === 'review'));
});

test('covers every unordered pair of the six core stats exactly once', () => {
  const potentialId = data.assignmentRule.potential.classId;
  const regular = data.classes.filter(item => item.id !== potentialId);
  assert.equal(regular.length, expectedPairCount);

  const actual = regular.map(item => pairKey(item.stats));
  assert.ok(actual.every(Boolean));
  assert.equal(new Set(actual).size, expectedPairCount);

  const expected = [];
  for (let left = 0; left < coreStats.length; left += 1) {
    for (let right = left + 1; right < coreStats.length; right += 1) {
      expected.push([coreStats[left], coreStats[right]].sort().join('::'));
    }
  }

  assert.deepEqual([...new Set(actual)].sort(), expected.sort());
});

test('defines the potential challenge class separately from two-stat matching', () => {
  const potential = data.classes.find(item => item.id === data.assignmentRule.potential.classId);
  assert.ok(potential);
  assert.deepEqual(potential.stats, ['잠재력']);
  assert.match(potential.assignmentCondition, /P >= S1 \+ S2/);
  assert.match(potential.assignmentCondition, /40%/);
  assert.match(potential.playstyle, /챌린지형/);
});
