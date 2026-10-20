import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { attributeLocation, renderAttributeReference } from '../docs/attributes-view.js';
import { globalProjectionSerialLayout } from '../docs/projection-selector.js';

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
    assert.ok(html.includes(element.gameplay.limits.slice(0, 12)));
    assert.ok(html.includes('id="limits"'));
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

test('canonical Haeri quadrant is consistently rendered from the four projection roles', async () => {
  const projections = JSON.parse(await readFile(new URL('../docs/data/projections.json', import.meta.url), 'utf8'));
  const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));
  const tetra = projections.solids.find(solid => solid.id === 'tetrahedron');
  const expected = [
    [3, '정립', '내재', '성립', 0],
    [4, '분화', '내재', '배제', 598],
    [1, '수용', '외재', '성립', 516],
    [2, '절연', '외재', '배제', 599]
  ];
  const serials = globalProjectionSerialLayout(projections.solids, views.solids).serialsByKey;
  for (const [classId, name, domain, action, serial] of expected) {
    const item = tetra.classes.find(entry => entry.id === classId);
    assert.equal(item.role.status, 'confirmed');
    assert.equal(item.role.name, name);
    assert.equal(item.role.axisDomain, domain);
    assert.equal(item.role.axisAction, action);
    assert.equal(serials.get('tetrahedron:' + classId), serial);
  }
  const framework = project.elements.find(e => e.id === 'haeri').quadrantFramework;
  assert.equal(framework.status, 'confirmed');
  assert.deepEqual(framework.domainAxis.values, ['내재', '외재']);
  assert.deepEqual(framework.actionAxis.values, ['성립', '배제']);
  const html = renderAttributeReference(project, '#attributes/wiki/haeri',
    { projectionData: projections, viewData: views });
  for (const [classId, name, domain, action, serial] of expected) {
    assert.ok(html.includes('#' + String(serial).padStart(3, '0') + ' · ' + name));
    assert.ok(html.includes(tetra.classes.find(x => x.id === classId).role.imageMotif));
  }
  assert.equal((html.match(/<td>/g) || []).length, 4);
  assert.ok(html.includes('href="#attributes/wiki/haeri/operators"'));
  assert.ok(!renderAttributeReference(project, '#attributes/wiki/soeoe').includes('id="operators"'));
});
