import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');

test('dashboard loads grouped projection hover guide assets', () => {
  assert.match(html, /projection-feature-guides\.css\?v=convex-hull-layers-20260927-1/);
  assert.match(html, /projection-feature-guides\.js\?v=convex-hull-layers-20260927-1/);
});
