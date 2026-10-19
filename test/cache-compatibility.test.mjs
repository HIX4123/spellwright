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
  assert.match(index, /styles\.css\?v=audit-20261019-1/);
  assert.match(app, /dashboard-routing\.js\?v=cache-schema-fix-20261011-3/);
  assert.equal(JSON.parse(read('data/wiki/kar.json')).sections.find(s => s.id === 'kaidesignstages-0').items.length, 4);
  assert.match(story, /kaiDesignStages/);
  assert.equal('worldbuilding' in project.narrative, false);
  assert.match(story, /typeof n\.story !== 'string'/);
});
