import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isNarrativeData, isWikiIndex, isWikiDocument, renderStoryWorld, storyLocation, linkText } from '../docs/story-world.js';

const read = async path => JSON.parse(await readFile(new URL('../docs/data/' + path, import.meta.url), 'utf8'));
const { narrative } = await read('project.json');
const index = await read('wiki/index.json');
const documents = await Promise.all(index.documents.map(d => read('wiki/' + d.id + '.json')));
const byId = new Map(documents.map(d => [d.id, d]));
const page = id => renderStoryWorld(narrative, index, { tab: 'wiki', article: id }, byId.get(id));

test('every catalog entry has one valid, independently rendered document and all links resolve', () => {
  assert.ok(isNarrativeData(narrative));
  assert.ok(isWikiIndex(index));
  for (const doc of documents) {
    assert.ok(isWikiDocument(doc, index), doc.id);
    assert.equal(doc.title, index.documents.find(d => d.id === doc.id).title);
    const html = page(doc.id);
    assert.doesNotMatch(html, /<textarea|contenteditable/);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, new Set(ids).size, doc.id + ' duplicate anchor');
    for (const [, href] of html.matchAll(/href="(#story[^" ]*)"/g)) {
      const route = storyLocation(href, index);
      if (route.article) {
        assert.ok(byId.has(route.article), doc.id + ': ' + href);
        if (route.target) assert.ok(byId.get(route.article).sections.some(s => s.id === route.target), href);
      }
    }
    for (const section of doc.sections) for (const item of section.items || []) {
      // All item titles and status qualifiers remain readable, including linked words.
      const text = html.replace(/<[^>]*>/g, '').replaceAll('&#039;', "'").replaceAll('&quot;', '"').replaceAll('&amp;', '&');
      assert.ok(text.includes((item.title || item.divine)), doc.id + ': ' + item.title);
      if (item.status) assert.ok(text.includes(item.status), item.status);
    }
  }
});

test('index groups and searches titles and old names without rendering every article body', () => {
  const html = renderStoryWorld(narrative, index);
  for (const doc of index.documents) assert.ok(html.includes('#story/wiki/' + doc.id));
  assert.match(html, /id="wikiSearch"/);
  assert.match(html, /카이/);
  assert.doesNotMatch(html, /id="kaipsychology-0"/);
  assert.match(page('kar'), /id="kaipsychology-0"/);
  assert.doesNotMatch(page('kar'), /id="eloiappearance-0"/);
  assert.match(page('kar'), /href="#story\/wiki\/elin"/);
  assert.match(page('eloi'), /자주빛 금속광/);
  assert.match(page('eloi-civilization'), /인위적으로 완벽/);
  assert.match(page('ieumsae'), /이음새/);
});

test('legacy bookmarks, diagram destinations and section URLs map to canonical articles', () => {
  assert.deepEqual(storyLocation('#story/cast/kai-design', index), {tab:'wiki', article:'kar', target:''});
  assert.equal(storyLocation('#story/cast/cast-4', index).article, 'elin');
  assert.equal(storyLocation('#story/world/harvest', index).article, 'eloi-civilization');
  assert.equal(storyLocation('#story/plot/event-prologue', index).article, 'event-prologue');
  assert.equal(storyLocation('#story/plot', index).article, 'chronology');
  assert.equal(storyLocation('#story/wiki/kar/kaipsychology-0', index).target, 'kaipsychology-0');
  assert.match(page('chronology'), /story-flow-svg/);
  for (const node of byId.get('chronology').flow.nodes) assert.ok(page('chronology').includes('href="'+node.href+'"'));
  for (const id of ['causal-loop','restoration','event-meeting','six-beasts']) assert.match(page(id), /role="img"/);
  assert.match(page('six-beasts'), /모식도/);
  assert.match(renderStoryWorld(narrative, index, {tab:'wiki',article:'unknown'}), /문서를 찾을 수/);
});

test('text links are longest-first, do not link to self, and never interpret user HTML', () => {
  const html = linkText('엘로이 문명과 엘로이족. 카르 <img src=x> & "엘린"', index, 'kar');
  assert.match(html, /href="#story\/wiki\/eloi-civilization">엘로이 문명<\/a>/);
  assert.match(html, /href="#story\/wiki\/eloi">엘로이족<\/a>/);
  assert.doesNotMatch(html, /href="#story\/wiki\/kar"|<img/);
  assert.match(html, /&lt;img src=x&gt;/);
  assert.match(html, /&amp;/);
  assert.equal(linkText('실제로 아카이브', index), '실제로 아카이브');
  assert.equal(isWikiIndex({...index, documents:[...index.documents,index.documents[0]]}),false);
  assert.equal(isWikiDocument({...byId.get('kar'), related:['missing']},index),false);
  assert.equal(isWikiDocument({...byId.get('kar'), sections:[{id:'bad',title:'bad',items:[null]}]},index),false);
  assert.equal(isWikiDocument({...byId.get('chronology'),flow:{nodes:[],edges:[{}]}},index),false);
});

test('old text narrative imports remain valid and escaped, questions remain complete', () => {
  assert.ok(isNarrativeData(undefined));
  assert.ok(isNarrativeData({story:'old', worldbuilding:'old'}));
  assert.equal(isNarrativeData({story:'old',acts:[null]}),false);
  assert.equal(isNarrativeData({...narrative,unresolved:[42]}),false);
  assert.match(renderStoryWorld({story:'<script>bad</script>'},index), /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.deepEqual(narrative.questionGroups.flatMap(g=>g.indices).sort((a,b)=>a-b),narrative.unresolved.map((_,i)=>i));
});


test('1부 세부 에피소드와 3부 최종전이 연대표에서 누락되지 않는다', () => {
  const timeline=byId.get('chronology');
  const act1=timeline.sections.find(s=>s.id==='reading-order');
  for(const id of ["event-prologue","event-gathering","event-fieldwork","event-memory","event-premia","event-yuma","event-fake-boss","event-restoration","event-sacrifice","event-aftermath","event-meeting","event-hand","event-fourth-answer"]) assert.ok(act1.links.includes(id),id);
  assert.ok(act1.links.indexOf('event-memory') < act1.links.indexOf('event-premia'));
  assert.ok(act1.links.indexOf('event-fake-boss') < act1.links.indexOf('event-restoration'));
  const act3=timeline.sections.find(s=>s.id==='reading-order-third');
  for(const id of ['event-third-first-encounter','event-third-final-battle','event-kai-dissociation']) assert.ok(act3.links.includes(id));
  assert.match(page('chronology'),/wiki-episode-timeline/);
  for(const id of ['kar-domain','kar-duality','event-third-first-encounter','event-third-final-battle']) assert.ok(byId.has(id));
  for(const id of ['kai-domain','kai-first','kai-demon','kai-final','kai-memory','kai-lab','kai-loss']) assert.ok(timeline.flow.nodes.some(n=>n.id===id));
});

test('chronology renders a full-width readable graph with all era nodes and retains detailed SVG',()=>{
 const html=page('chronology');
 assert.match(html,/wiki-article wiki-article--chronology/);
 assert.match(html,/class="story-flow-fit"/);
 assert.match(html,/class="story-flow-expanded"/);
 assert.match(html,/class="story-flow-svg"/);
 assert.equal((html.match(/class="story-fit-era"/g)||[]).length,4);
 for(const node of byId.get('chronology').flow.nodes) assert.ok(html.includes('aria-label="'+node.title+' · '+node.era+'"'),node.id);
 assert.doesNotMatch(page('kar'),/wiki-article--chronology/);
});
