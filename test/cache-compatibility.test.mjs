import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../docs/' + file, import.meta.url), 'utf8');
const index = read('index.html');
const app = read('app.js');
const story = read('story-world.js');
const project = JSON.parse(read('data/project.json'));

test('changed JSON schema cannot be loaded with a stale cached module', () => {
  // New story schema requires a fresh module URL; keep the old baseline as a regression guard.
  assert.match(index, /app\.js\?v=[\w-]+/);
  assert.match(app, /story-world\.js\?v=[\w-]+/);
  assert.doesNotMatch(index, /app\.js\?v=cache-schema-fix-20261011-3/);
  assert.doesNotMatch(app, /story-world\.js\?v=cache-schema-fix-20261011-3/);
  assert.match(index, /styles\.css\?v=soeoe-roots-20261020-1/);
  assert.match(app, /dashboard-routing\.js\?v=attributes-20261020-1/);
  assert.match(app, /attributes-view\.js\?v=gochak-rmt-20261024-1/);
  // A stale periodic-table module keeps importing the previous serial mapper even
  // when the main entrypoint is refreshed. Guard the full nested cache chain.
  assert.match(index, /app\.js\?v=magic-trials-20261024-1/);
  assert.match(app, /projection-periodic-table\.js\?v=periodic-grouping-20261020-1/);
  assert.match(index, /projection-periodic-table\.css\?v=periodic-grouping-20261020-1/);
  const periodic = read('projection-periodic-table.js');
  assert.match(periodic, /projection-selector\.js\?v=solid-origins-20261020-1/);
  assert.match(app, /projection-selector\.js\?v=solid-origins-20261020-1/);
  assert.match(read('attributes-view.js'), /projection-selector\.js\?v=solid-origins-20261020-1/);
  assert.doesNotMatch(app, /projection-periodic-table\.js\?v=audit-20261019-1/);
  assert.equal(JSON.parse(read('data/wiki/kar.json')).sections.find(s => s.id === 'kaidesignstages-0').items.length, 4);
  assert.match(story, /kaiDesignStages/);
  assert.equal('worldbuilding' in project.narrative, false);
  assert.match(story, /typeof n\.story !== 'string'/);
});

test('Gochak RMT study remains explicitly exploratory and linked from its attribute article', () => {
  const gochak = project.elements.find(element => element.id === 'gochak');
  assert.equal(gochak.projectionClasses, 14);
  assert.equal(gochak.relationStudy.status, 'review');
  assert.deepEqual(gochak.relationStudy.rmt.principles.map(group => group.code), ['CS', 'AR', 'EM', 'MP']);
  assert.equal(gochak.relationStudy.rmt.principles.reduce((count, group) => count + group.candidates.length, 0), 15);
  const attributeView = read('attributes-view.js');
  assert.match(attributeView, /function relationStudyView\(element\)/);
  assert.match(attributeView, /\['relations', '관계 모델'\]/);
  assert.match(attributeView, /\['rmt', 'RMT 작용 후보'\]/);
});
