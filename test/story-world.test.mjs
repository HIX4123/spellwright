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
  assert.match(html, /단일 역사 · 인과 연결/);
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
  assert.equal((html.match(/class="story-panel"/g) || []).length, 4);
  assert.equal((html.match(/class="story-panel"[^>]+ hidden/g) || []).length, 3);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, id] of html.matchAll(/href="#story\/[^/" ]+\/([^" ]+)"/g)) assert.ok(ids.includes(id), id);
  assert.equal((html.match(/class="story-event"/g) || []).length, narrative.timeline.length);
  const questions = narrative.questionGroups.flatMap(g => g.indices).sort((a,b) => a-b);
  assert.deepEqual(questions, narrative.unresolved.map((_,i) => i));
  assert.equal(isNarrativeData({ ...narrative, timeline: [null] }), false);
  assert.equal(isNarrativeData({ ...narrative, questionGroups: [{ title: 'bad', indices: [-1] }] }), false);
});


test('canonical plot records supply third-act timeline events and world chronology is visible', () => {
  const html = renderStoryWorld(narrative, 'plot');
  for (const index of [8, 9, 10]) assert.ok(html.includes(narrative.plot[index].description));
  for (const entry of narrative.worldChronology) assert.ok(html.includes(entry.title));
  assert.equal(narrative.origins.length, 1, 'duplicated harvest notes are represented only once');
  assert.equal('worldbuilding' in narrative, false, 'world rules live in structured principles');
});


test('legacy story question URLs resolve to consolidated Open Questions', async () => {
  const { dashboardViewFromHash } = await import('../docs/dashboard-routing.js');
  assert.equal(dashboardViewFromHash('#story/questions/questions'), 'questions');
});


test('first act timeline may reference canon actOneArc data and validates its fields', () => {
  assert.equal(isNarrativeData(narrative), true);
  const event = narrative.timeline.find(entry => entry.source === 'actOneArc');
  assert.ok(event, 'the first-act arc is referenced by the timeline');
  assert.equal(narrative.actOneArc[event.index].title.length > 0, true);
  assert.equal(isNarrativeData({ ...narrative, actOneArc: [{ title: 'bad' }] }), false);
  assert.equal(isNarrativeData({
    ...narrative, timeline: narrative.timeline.map(entry => (
      entry.source === 'actOneArc' ? { ...entry, source: 'unknown' } : entry
    ))
  }), false);
});

test('Eloi late-life visual rules and Kai four-stage design render as text-only canon proposals', () => {
  assert.equal(isNarrativeData(narrative), true);
  assert.equal(narrative.kaiDesignStages.length, 4);
  for (const [index, item] of narrative.kaiDesignStages.entries()) {
    assert.ok(item.title.startsWith(String(index + 1) + '단계'));
    assert.ok(item.status.length > 0);
  }
  const world = renderStoryWorld(narrative, 'world');
  const cast = renderStoryWorld(narrative, 'cast');
  assert.match(world, /엘로이족 · 외형과 노년 색채/);
  assert.match(world, /머리카락 끝/);
  assert.match(world, /자주빛 금속광/);
  assert.match(cast, /카이 · 외형 변화 4단계/);
  assert.match(cast, /고속 회전/);
  assert.match(cast, /등 뒤/);
  assert.match(cast, /엘린/);
  assert.match(cast, /케이프·망토/);
  assert.doesNotMatch(cast, /<img\b/);
  for (const key of ['eloiAppearance', 'kaiDesignStages', 'kaiDesignNotes']) {
    assert.equal(isNarrativeData({ ...narrative, [key]: [null] }), false);
  }
});

test('six beast forms render as non-binding visual motifs without changing the divine concepts', () => {
  assert.equal(isNarrativeData(narrative), true);
  assert.equal(narrative.beastForms.length, 6);
  const world = renderStoryWorld(narrative, 'world');
  assert.match(world, /육환신수 · 본질 형상의 생물 모티브/);
  for (const name of ['메가네우라', '물곰', '담요문어', '대왕고래', '메갈로케로스', '큰정원사새']) {
    assert.ok(world.includes(name), name);
  }
  assert.match(world, /인간 출신/);
  assert.equal(isNarrativeData({ ...narrative, beastForms: [null] }), false);
  assert.equal(isNarrativeData({ ...narrative, beastForms: [{ title: '불완전한 기록' }] }), false);
  assert.doesNotMatch(world, /<img\b/);
});


test('Kai psychology, voluntary joining, aftermath, and narration rules appear in the existing story tabs', () => {
  assert.equal(isNarrativeData(narrative), true);
  for (const key of ['kaiPsychology', 'kaiJoining', 'kaiAftermath', 'kaiNarration']) {
    assert.ok(narrative[key].length >= 3, key);
    assert.equal(isNarrativeData({ ...narrative, [key]: [null] }), false, key);
  }
  const cast = renderStoryWorld(narrative, 'cast');
  const plot = renderStoryWorld(narrative, 'plot');
  assert.match(cast, /카이 · 일상과 상실에 대한 작가용 심리/);
  assert.match(cast, /엘린의 죽음/);
  assert.match(plot, /카이 · 경계에서 자발적 합류까지/);
  assert.match(plot, /카이 · 라키르와 니벨이 남긴 일상/);
  assert.match(plot, /카이의 서술 거리 · B에서 A로/);
  assert.match(plot, /마법사의 일상에서 시작한 호기심/);
  assert.ok(narrative.timeline.some(e => e.id === 'aftermath' && e.source === 'actOneArc'));
  assert.deepEqual(narrative.questionGroups.flatMap(g => g.indices).sort((a,b)=>a-b), narrative.unresolved.map((_,i)=>i));
});
