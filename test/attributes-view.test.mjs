import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { attributeLocation, renderAttributeReference } from '../docs/attributes-view.js';

const project = JSON.parse(await readFile(new URL('../docs/data/project.json', import.meta.url), 'utf8'));
const terms = ['haeri', 'soeoe', 'chojo', 'gochak', 'banchu'];
const names = ['해리', '소외', '초조', '고착', '반추'];

test('five attributes have one canonical source and permanent glossary IDs', () => {
  assert.equal(project.project.schemaVersion, 8);
  assert.deepEqual(project.elements.map(e => e.id), terms);
  assert.deepEqual(project.elements.map(e => e.name), names);
  assert.deepEqual(project.attributeRules.sequence, names);
  assert.equal(project.elements.reduce((total, e) => total + e.projectionClasses, 0), 43);
  for (const element of project.elements) {
    assert.ok(element.summary.length > 2);
    assert.ok(element.meaning && element.loss && element.motto);
    assert.ok(element.motifIdeas.length >= 2);
    for (const key of ['identity', 'attack', 'defense', 'limits']) assert.ok(element.gameplay[key].length > 10);
  }
});

test('glossary first view shows five concise previews and links rather than detailed cards', () => {
  const html = renderAttributeReference(project, '#attributes');
  assert.equal((html.match(/class="attribute-index-entry"/g) || []).length, 5);
  for (const element of project.elements) {
    assert.ok(html.includes('href="#attributes/wiki/' + element.id + '"'));
    assert.ok(html.includes(element.summary));
    assert.ok(!html.includes(element.meaning));
    assert.ok(!html.includes(element.gameplay.attack));
  }
  assert.ok(html.includes('href="#attributes/wiki/rules"'));
  assert.ok(html.includes('href="#projections"'));
  assert.ok(!html.includes('attribute-action-pair'));
});

test('each term has one complete document, anchored headings and related links', () => {
  for (const element of project.elements) {
    const html = renderAttributeReference(project, '#attributes/wiki/' + element.id);
    assert.ok(html.includes('id="attribute-document-title"'));
    assert.ok(html.includes('<h2 id="attribute-document-title" tabindex="-1">' + element.name + '</h2>'));
    assert.ok(html.includes(element.meaning));
    assert.ok(html.includes(element.gameplay.identity));
    assert.ok(html.includes(element.gameplay.attack));
    assert.ok(html.includes(element.gameplay.defense));
    assert.ok(html.includes(element.gameplay.limits));
    for (const anchor of ['symbol', 'motifs', 'mechanics', 'examples', 'limits']) {
      assert.ok(html.includes('id="' + anchor + '"'));
      assert.ok(html.includes('href="#attributes/wiki/' + element.id + '/' + anchor + '"'));
    }
    assert.ok(html.includes('href="#attributes/wiki/rules"'));
    assert.ok(!html.includes('class="attribute-index-entry"'));
  }
});

test('the shared rules own their open questions and resolve to one topic', () => {
  const html = renderAttributeReference(project, '#attributes/wiki/rules');
  assert.ok(html.includes(project.attributeRules.initiation));
  assert.ok(html.includes(project.attributeRules.adjacency));
  for (const item of project.attributeRules.open) assert.ok(html.includes(item));
  assert.ok(html.includes('id="choice"'));
  assert.ok(html.includes('id="adjacency"'));
  assert.ok(html.includes('id="unresolved"'));
  assert.ok(!html.includes('공격 · 예시'));
});

test('deep-link routing supports headings and gracefully handles legacy and invalid links', () => {
  assert.deepEqual(attributeLocation('#attributes/wiki/banchu/limits'),
    { kind: 'article', id: 'banchu', target: 'limits' });
  assert.deepEqual(attributeLocation('#attributes/wiki/rules/adjacency'),
    { kind: 'article', id: 'rules', target: 'adjacency' });
  for (const path of ['#attributes', '#attributes/motifs', '#attributes/gameplay', '#attributes/%E0%A4%A']) {
    assert.equal(attributeLocation(path).kind, 'index');
    assert.ok(renderAttributeReference(project, path).includes('attribute-index-entry'));
  }
  assert.ok(renderAttributeReference(project, '#attributes/wiki/invalid').includes('해당 표제어가 없습니다.'));
});

test('cross references are clickable and user-supplied content is escaped', () => {
  const soeoe = renderAttributeReference(project, '#attributes/wiki/soeoe');
  assert.ok(soeoe.includes('href="#attributes/wiki/chojo"'));
  const clone = structuredClone(project);
  clone.elements[0].motifIdeas.push('<img src=x onerror=alert(1)>');
  clone.elements[0].gameplay.defense = '<script>bad()</script>';
  const html = renderAttributeReference(clone, '#attributes/wiki/haeri');
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<script>bad()'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('&lt;script&gt;'));
});
