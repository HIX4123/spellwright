import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { attributeSectionFromHash, renderAttributeReference } from '../docs/attributes-view.js';

const project = JSON.parse(await readFile(new URL('../docs/data/project.json', import.meta.url), 'utf8'));
const attrs = ['해리', '소외', '초조', '고착', '반추'];

test('canonical attributes preserve five solids and game identities', () => {
  assert.deepEqual(project.attributeRules.sequence, attrs);
  assert.deepEqual(project.elements.map(element => element.name), attrs);
  assert.equal(project.elements.reduce((count, element) => count + element.projectionClasses, 0), 43);
  for (const element of project.elements) {
    assert.ok(element.motto && element.loss && element.meaning);
    assert.ok(element.motifIdeas.length >= 2);
    for (const key of ['identity', 'attack', 'defense', 'limits']) {
      assert.ok(element.gameplay[key].length > 10);
    }
  }
});

test('every Attributes sub-tab renders five entries from canonical data', () => {
  for (const hash of ['#attributes', '#attributes/motifs', '#attributes/gameplay']) {
    const html = renderAttributeReference(project, hash);
    for (const attribute of attrs) {
      assert.ok(html.includes('<h3>' + attribute + '</h3>'));
    }
    assert.equal((html.match(/class="card attribute-reference-card"/g) || []).length, 5);
    assert.ok(html.includes('href="#projections"') || html.includes('href="#attributes/gameplay"'));
  }
});

test('motifs and gameplay are separate routes with meaningful state labels', () => {
  assert.equal(attributeSectionFromHash('#attributes/motifs'), 'motifs');
  assert.equal(attributeSectionFromHash('#attributes/gameplay'), 'gameplay');
  assert.equal(attributeSectionFromHash('#attributes/unknown'), 'overview');
  const motifs = renderAttributeReference(project, '#attributes/motifs');
  assert.ok(motifs.includes('세계관 상징 · 확정'));
  assert.ok(motifs.includes('모티프 아이디어 · 검토'));
  assert.ok(!motifs.includes('공격 · 예시'));
  const play = renderAttributeReference(project, '#attributes/gameplay');
  assert.ok(play.includes('공격 · 예시'));
  assert.ok(play.includes('방어 · 예시'));
  assert.ok(play.includes('규칙 경계 · 미정 사항'));
  assert.ok(!play.includes('모티프 아이디어 · 검토'));
});

test('attribute reference escapes externally supplied text', () => {
  const injected = structuredClone(project);
  injected.elements[0].motifIdeas.push('<img src=x onerror=alert(1)>');
  const html = renderAttributeReference(injected, '#attributes/motifs');
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
});
