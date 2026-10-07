import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isNarrativeData, renderStoryWorld } from '../docs/story-world.js';

const { narrative } = JSON.parse(await readFile(new URL('../docs/data/project.json', import.meta.url), 'utf8'));

test('actual worldbuilding renders two act questions and accessible concept and causal diagrams without an editor', () => {
  assert.equal(isNarrativeData(narrative), true);
  const html = renderStoryWorld(narrative);
  assert.equal((html.match(/role="img"/g) || []).length, 6);
  for (const act of narrative.acts) assert.ok(html.includes(act.question));
  for (const pair of narrative.pairs) {
    assert.ok(html.includes(pair.divine));
    assert.ok(html.includes(pair.mythical));
  }
  assert.match(html, /모식도/);
  assert.doesNotMatch(html, /<textarea|contenteditable/);
  for (const key of ['plot', 'loop', 'harvest', 'eras', 'characters', 'origins', 'cast', 'conflict', 'sacrifice', 'circuitOptions', 'meeting', 'bossPlan', 'restoration', 'bossRules', 'chronosKnowledge', 'foreshadowing']) {
    for (const item of narrative[key]) assert.ok(html.includes(item.title));
    assert.equal(isNarrativeData({ ...narrative, [key]: [null] }), false);
  }
  assert.match(html, /과거행의 목적은 배양 계획 저지/);
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

test('story navigation preserves content and links every timeline destination to a unique target', async () => {
  const { storyLocation } = await import('../docs/story-world.js');
  const { dashboardViewFromHash } = await import('../docs/dashboard-routing.js');
  assert.equal(dashboardViewFromHash('#story/plot/event-prologue'), 'story');
  assert.deepEqual(storyLocation('#story/plot/event-prologue'), { tab: 'plot', target: 'event-prologue' });
  assert.equal(storyLocation('#story/unknown').tab, 'overview');
  const html = renderStoryWorld(narrative, 'plot');
  assert.equal((html.match(/class="story-panel"/g) || []).length, 5);
  assert.equal((html.match(/class="story-panel"[^>]+ hidden/g) || []).length, 4);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, id] of html.matchAll(/href="#story\/[^/" ]+\/([^" ]+)"/g)) assert.ok(ids.includes(id), id);
  assert.equal((html.match(/class="story-event"/g) || []).length, narrative.timeline.length);
  const questions = narrative.questionGroups.flatMap(g => g.indices).sort((a,b) => a-b);
  assert.deepEqual(questions, narrative.unresolved.map((_,i) => i));
  assert.equal(isNarrativeData({ ...narrative, timeline: [null] }), false);
  assert.equal(isNarrativeData({ ...narrative, questionGroups: [{ title: 'bad', indices: [-1] }] }), false);
});
