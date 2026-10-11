import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../docs/' + file, import.meta.url), 'utf8');
const index = read('index.html');
const app = read('app.js');
const story = read('story-world.js');
const project = JSON.parse(read('data/project.json'));

test('changed JSON schema cannot be loaded with a stale cached module', () => {
  assert.match(index, /app\.js\?v=cache-schema-fix-20261011-2/);
  assert.match(index, /styles\.css\?v=cache-schema-fix-20261011-2/);
  assert.match(app, /story-world\.js\?v=cache-schema-fix-20261011-2/);
  assert.match(app, /dashboard-routing\.js\?v=cache-schema-fix-20261011-2/);
  assert.equal('worldbuilding' in project.narrative, false);
  assert.match(story, /typeof n\.story !== 'string'/);
});
