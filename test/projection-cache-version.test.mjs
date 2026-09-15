import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexHtml = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');

test('loads refreshed projection feature and guide bundles', () => {
  assert.match(indexHtml, /projection-features\.js\?v=projection-tags-20260915-3/);
  assert.match(indexHtml, /projection-feature-guides\.js\?v=projection-guides-20260915-2/);
});
