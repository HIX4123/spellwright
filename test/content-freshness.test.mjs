import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, snapshot, pending, syncIndex, validate } from '../scripts/content-freshness.mjs';
import { freshnessPageId, freshnessMarkup } from '../docs/freshness.js';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'spellwright-freshness-'));
  cpSync(join(ROOT,'docs'), join(root,'docs'), {recursive:true});
  t.after(() => rmSync(root,{recursive:true,force:true}));
  return root;
}
function edit(root,path,fn) {
  const file=join(root,path), value=JSON.parse(readFileSync(file,'utf8'));
  fn(value); writeFileSync(file,JSON.stringify(value,null,2)+'\n');
}

test('actual catalog and committed review fingerprints cover all pages', () => {
  assert.deepEqual(validate(), []);
  const pages=snapshot().pages;
  for(const id of ['overview','story','systems','character','attributes','projections','questions','archive','attributes/wiki/rules','attributes/wiki/haeri','story/wiki/chronology']) assert.ok(pages[id],id);
});

test('editing an event invalidates its chronology, referring articles and open questions even within the same timestamp', t => {
  const root=fixture(t), before=snapshot(root);
  edit(root,'docs/data/wiki/event-third-final-battle.json',doc => doc.sections[0].items[0].description += ' 회귀 검사');
  const ids=pending(snapshot(root),before).map(p=>p.id);
  for(const id of ['story/wiki/event-third-final-battle','story/wiki/chronology','story/wiki/third-act','story','questions']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('projections'));
  assert.ok(validate(root).some(error=>error.includes('review required')));
});

test('title/summary edits cannot bypass preview synchronization; aliases survive sync', t => {
  const root=fixture(t);
  const oldIndex=JSON.parse(readFileSync(join(root,'docs/data/wiki/index.json'),'utf8'));
  const oldAliases=oldIndex.documents.find(d=>d.id==='event-kai-dissociation').aliases;
  edit(root,'docs/data/wiki/event-kai-dissociation.json',doc => {doc.summary='새 요약';doc.aliases.push('새 별칭');});
  assert.ok(validate(root).some(error=>error.includes('index summary drift')));
  syncIndex(root);
  const index=JSON.parse(readFileSync(join(root,'docs/data/wiki/index.json'),'utf8'));
  const entry=index.documents.find(d=>d.id==='event-kai-dissociation');
  assert.equal(entry.summary,'새 요약');
  for(const alias of [...oldAliases,'새 별칭']) assert.ok(entry.aliases.includes(alias));
  assert.ok(validate(root).some(error=>error.includes('review required')));
});

test('changing reference sets and renderer code invalidates affected receipts', t => {
  const root=fixture(t), before=snapshot(root);
  edit(root,'docs/data/wiki/chronology.json',doc => doc.related.push('elin'));
  assert.ok(pending(snapshot(root),before).some(p=>p.id==='story/wiki/chronology'));
  const file=join(root,'docs/story-flow.js');writeFileSync(file,readFileSync(file,'utf8')+'\n// test change\n');
  assert.ok(pending(snapshot(root),before).some(p=>p.id==='story/wiki/chronology' && p.changed.includes('docs/story-flow.js')));
});

test('timestamps use Korean time, preserve unreviewed state, and never imply local draft review', () => {
  const html=freshnessMarkup({updatedAt:'2026-10-28T01:02:00Z',reviewedAt:null},true);
  assert.match(html,/10:02/);assert.match(html,/연관 검토 기록 없음/);assert.match(html,/로컬 초안/);
  assert.doesNotMatch(freshnessMarkup({updatedAt:'<img>',reviewedAt:null}),/<img>/);
  assert.equal(freshnessPageId('story','#story/plot',{article:'chronology'}),'story/wiki/chronology');
  assert.equal(freshnessPageId('attributes','#attributes/wiki/haeri/operators'),'attributes/wiki/haeri');
  assert.equal(freshnessPageId('attributes','#%E0%A4%A'),'attributes');
});
