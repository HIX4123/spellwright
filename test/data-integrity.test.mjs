import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveSystem } from '../docs/system-resolver.mjs';

const read = async name => JSON.parse(await readFile(new URL('../docs/data/' + name, import.meta.url), 'utf8'));
const [project, stats] = await Promise.all([read('project.json'), read('stats.json')]);

test('linked stats are defined only in the canonical character data', () => {
  const catalog = new Map(stats.stats.map(stat => [stat.id, stat]));
  const linked = project.systems.filter(system => system.statRef);
  assert.equal(linked.length, 6);
  for (const system of linked) {
    assert.ok(!('definition' in system) && !('details' in system));
    const resolved = resolveSystem(system, catalog);
    assert.equal(resolved.definition, catalog.get(system.statRef).definition);
    assert.equal(resolved.details, catalog.get(system.statRef).details);
    assert.ok(resolved.details.length > 20);
  }
});

test('canonical narrative plot and question groups are complete', () => {
  const n = project.narrative;
  const indices = n.questionGroups.flatMap(group => group.indices);
  assert.deepEqual(indices.sort((a,b)=>a-b), n.unresolved.map((_,i)=>i));
});
