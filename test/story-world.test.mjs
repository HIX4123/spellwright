import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isNarrativeData, renderStoryWorld } from '../docs/story-world.js';

const { narrative } = JSON.parse(await readFile(new URL('../docs/data/project.json', import.meta.url), 'utf8'));

test('actual worldbuilding renders two act questions and three accessible concept diagrams without an editor', () => {
  assert.equal(isNarrativeData(narrative), true);
  const html = renderStoryWorld(narrative);
  assert.equal((html.match(/role="img"/g) || []).length, 3);
  for (const act of narrative.acts) assert.ok(html.includes(act.question));
  for (const pair of narrative.pairs) {
    assert.ok(html.includes(pair.divine));
    assert.ok(html.includes(pair.mythical));
  }
  assert.match(html, /모식도/);
  assert.doesNotMatch(html, /<textarea|contenteditable/);
});

test('old text drafts remain readable and imported structured content is validated and escaped', () => {
  const old = { story: '<script>안전</script>\n두 번째 줄', worldbuilding: '세계관' };
  assert.ok(isNarrativeData(undefined));
  assert.ok(isNarrativeData(old));
  assert.match(renderStoryWorld(old), /&lt;script&gt;안전&lt;\/script&gt;\n두 번째 줄/);
  assert.match(renderStoryWorld(), /아직 정리된/);
  assert.equal(isNarrativeData({ ...old, pairs: [{ ...narrative.pairs[0], diagram: 'unknown' }] }), false);
  assert.equal(isNarrativeData({ ...old, acts: [null] }), false);
  assert.equal(isNarrativeData({ ...old, unresolved: [42] }), false);
  const html = renderStoryWorld({ ...narrative, pairs: [{ ...narrative.pairs[0], mythical: '<img src=x>' }] });
  assert.match(html, /&lt;img src=x&gt;/);
  assert.doesNotMatch(html, /<img src=x>/);
});
